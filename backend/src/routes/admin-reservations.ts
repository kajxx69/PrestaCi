import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { pool } from '../db.js';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

const router = express.Router();

// Middleware d'authentification admin
router.use(requireAuth);
router.use(requireRole('admin'));

// Interface pour les réservations
interface ReservationRow extends RowDataPacket {
  id: number;
  client_id: number;
  client_nom: string;
  client_email: string;
  client_telephone: string;
  prestataire_id: number;
  prestataire_nom: string;
  prestataire_email: string;
  service_id: number;
  service_nom: string;
  service_prix: number;
  date_reservation: string;
  heure_debut: string;
  heure_fin: string;
  statut: string;
  prix_total: number;
  notes_client: string;
  notes_prestataire: string;
  created_at: string;
  updated_at: string;
  has_avis: boolean;
  avis_note: number;
  avis_commentaire: string;
}

// GET /api/admin/reservations - Récupérer toutes les réservations avec filtres
router.get('/', async (req, res) => {
  try {
    const { 
      statut = 'all', 
      search = '', 
      page = 1, 
      limit = 20,
      date_debut,
      date_fin,
      prestataire_id,
      client_id
    } = req.query;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    // Filtres
    if (statut !== 'all') {
      whereClause += ' AND r.statut = ?';
      params.push(statut);
    }

    if (search) {
      whereClause += ` AND (
        uc.nom LIKE ? OR uc.email LIKE ? OR 
        up.nom LIKE ? OR up.email LIKE ? OR 
        s.nom LIKE ?
      )`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (date_debut) {
      whereClause += ' AND r.date_reservation >= ?';
      params.push(date_debut);
    }

    if (date_fin) {
      whereClause += ' AND r.date_reservation <= ?';
      params.push(date_fin);
    }

    if (prestataire_id) {
      whereClause += ' AND r.prestataire_id = ?';
      params.push(prestataire_id);
    }

    if (client_id) {
      whereClause += ' AND r.client_id = ?';
      params.push(client_id);
    }

    const offset = (Number(page) - 1) * Number(limit);

    const query = `
      SELECT 
        r.*,
        uc.nom as client_nom,
        uc.email as client_email,
        uc.telephone as client_telephone,
        p.nom_commercial as prestataire_nom,
        up.email as prestataire_email,
        s.nom as service_nom,
        s.prix as service_prix,
        CASE WHEN a.id IS NOT NULL THEN 1 ELSE 0 END as has_avis,
        a.note as avis_note,
        a.commentaire as avis_commentaire
      FROM reservations r
      LEFT JOIN users uc ON r.client_id = uc.id
      LEFT JOIN prestataires p ON r.prestataire_id = p.id
      LEFT JOIN users up ON p.user_id = up.id
      LEFT JOIN services s ON r.service_id = s.id
      LEFT JOIN avis a ON r.id = a.reservation_id
      ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `;

    params.push(Number(limit), offset);

    const [reservations] = await pool.execute<ReservationRow[]>(query, params);

    // Compter le total pour la pagination
    const countQuery = `
      SELECT COUNT(DISTINCT r.id) as total
      FROM reservations r
      LEFT JOIN users uc ON r.client_id = uc.id
      LEFT JOIN users up ON r.prestataire_id = up.id
      LEFT JOIN services s ON r.service_id = s.id
      ${whereClause.replace('LIMIT ? OFFSET ?', '')}
    `;

    const [countResult] = await pool.execute<RowDataPacket[]>(
      countQuery, 
      params.slice(0, -2)
    );

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / Number(limit));

    res.json({
      reservations,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages,
        hasNext: Number(page) < totalPages,
        hasPrev: Number(page) > 1
      }
    });
  } catch (error) {
    console.error('Erreur récupération réservations:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/admin/reservations/:id - Récupérer une réservation spécifique
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        r.*,
        uc.nom as client_nom,
        uc.email as client_email,
        uc.telephone as client_telephone,
        p.nom_commercial as prestataire_nom,
        up.email as prestataire_email,
        up.telephone as prestataire_telephone,
        s.nom as service_nom,
        s.description as service_description,
        s.prix as service_prix,
        s.duree as service_duree,
        CASE WHEN a.id IS NOT NULL THEN 1 ELSE 0 END as has_avis,
        a.note as avis_note,
        a.commentaire as avis_commentaire,
        a.created_at as avis_date
      FROM reservations r
      LEFT JOIN users uc ON r.client_id = uc.id
      LEFT JOIN prestataires p ON r.prestataire_id = p.id
      LEFT JOIN users up ON p.user_id = up.id
      LEFT JOIN services s ON r.service_id = s.id
      LEFT JOIN avis a ON r.id = a.reservation_id
      WHERE r.id = ?
    `;

    const [reservations] = await pool.execute<ReservationRow[]>(query, [id]);

    if (reservations.length === 0) {
      return res.status(404).json({ error: 'Réservation non trouvée' });
    }

    res.json(reservations[0]);
  } catch (error) {
    console.error('Erreur récupération réservation:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/admin/reservations/:id/status - Changer le statut d'une réservation
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { statut, reason } = req.body;

    const validStatuts = ['en_attente', 'confirmee', 'terminee', 'annulee'];
    if (!validStatuts.includes(statut)) {
      return res.status(400).json({ error: 'Statut invalide' });
    }

    // Vérifier que la réservation existe
    const [reservations] = await pool.execute<RowDataPacket[]>(
      `SELECT r.*, uc.nom as client_nom, p.nom_commercial as prestataire_nom, s.nom as service_nom
       FROM reservations r
       LEFT JOIN users uc ON r.client_id = uc.id
       LEFT JOIN prestataires p ON r.prestataire_id = p.id
       LEFT JOIN services s ON r.service_id = s.id
       WHERE r.id = ?`,
      [id]
    );

    if (reservations.length === 0) {
      return res.status(404).json({ error: 'Réservation non trouvée' });
    }

    const reservation = reservations[0];

    // Mettre à jour le statut
    await pool.execute(
      'UPDATE reservations SET statut = ?, updated_at = NOW() WHERE id = ?',
      [statut, id]
    );

    // Log de l'action admin
    await pool.execute(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, created_at) 
       VALUES (?, 'reservation_status_changed', 'reservation', ?, ?, NOW())`,
      [
        req.user.id,
        id,
        JSON.stringify({ 
          old_status: reservation.statut, 
          new_status: statut, 
          reason 
        })
      ]
    );

    // Notifier le client et le prestataire
    const notifications = [
      {
        user_id: reservation.client_id,
        type: 'reservation_status_changed',
        title: 'Statut de réservation modifié',
        message: `Le statut de votre réservation "${reservation.service_nom}" a été modifié par un administrateur.`,
        data: JSON.stringify({ 
          reservation_id: id, 
          new_status: statut, 
          reason: reason || 'Modification administrative'
        })
      },
      {
        user_id: reservation.prestataire_id,
        type: 'reservation_status_changed',
        title: 'Statut de réservation modifié',
        message: `Le statut de la réservation "${reservation.service_nom}" a été modifié par un administrateur.`,
        data: JSON.stringify({ 
          reservation_id: id, 
          new_status: statut, 
          reason: reason || 'Modification administrative'
        })
      }
    ];

    for (const notification of notifications) {
      await pool.execute(
        `INSERT INTO notifications (user_id, type, title, message, data, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [
          notification.user_id,
          notification.type,
          notification.title,
          notification.message,
          notification.data
        ]
      );
    }

    res.json({ 
      success: true, 
      message: `Statut de la réservation modifié vers "${statut}"` 
    });
  } catch (error) {
    console.error('Erreur changement statut réservation:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/admin/reservations/:id - Supprimer une réservation
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Vérifier que la réservation existe
    const [reservations] = await pool.execute<RowDataPacket[]>(
      `SELECT r.*, uc.nom as client_nom, up.nom as prestataire_nom, s.nom as service_nom
       FROM reservations r
       LEFT JOIN users uc ON r.client_id = uc.id
       LEFT JOIN users up ON r.prestataire_id = up.id
       LEFT JOIN services s ON r.service_id = s.id
       WHERE r.id = ?`,
      [id]
    );

    if (reservations.length === 0) {
      return res.status(404).json({ error: 'Réservation non trouvée' });
    }

    const reservation = reservations[0];

    // Vérifier si la réservation peut être supprimée
    if (reservation.statut === 'terminee') {
      return res.status(400).json({ 
        error: 'Impossible de supprimer une réservation terminée' 
      });
    }

    // Supprimer les avis associés
    await pool.execute(
      'DELETE FROM avis WHERE reservation_id = ?',
      [id]
    );

    // Supprimer la réservation
    await pool.execute(
      'DELETE FROM reservations WHERE id = ?',
      [id]
    );

    // Log de l'action admin
    await pool.execute(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, created_at) 
       VALUES (?, 'reservation_deleted', 'reservation', ?, ?, NOW())`,
      [
        req.user.id,
        id,
        JSON.stringify({ 
          client_nom: reservation.client_nom,
          prestataire_nom: reservation.prestataire_nom,
          service_nom: reservation.service_nom,
          reason 
        })
      ]
    );

    // Notifier le client et le prestataire
    const notifications = [
      {
        user_id: reservation.client_id,
        type: 'reservation_deleted',
        title: 'Réservation supprimée',
        message: `Votre réservation "${reservation.service_nom}" a été supprimée par un administrateur. Raison: ${reason || 'Non spécifiée'}`,
        data: JSON.stringify({ service_nom: reservation.service_nom, reason })
      },
      {
        user_id: reservation.prestataire_id,
        type: 'reservation_deleted',
        title: 'Réservation supprimée',
        message: `La réservation "${reservation.service_nom}" a été supprimée par un administrateur. Raison: ${reason || 'Non spécifiée'}`,
        data: JSON.stringify({ service_nom: reservation.service_nom, reason })
      }
    ];

    for (const notification of notifications) {
      await pool.execute(
        `INSERT INTO notifications (user_id, type, title, message, data, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [
          notification.user_id,
          notification.type,
          notification.title,
          notification.message,
          notification.data
        ]
      );
    }

    res.json({ success: true, message: 'Réservation supprimée' });
  } catch (error) {
    console.error('Erreur suppression réservation:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/admin/reservations/stats - Statistiques des réservations
router.get('/stats/overview', async (req, res) => {
  try {
    const [stats] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        COUNT(*) as total_reservations,
        COUNT(CASE WHEN statut = 'en_attente' THEN 1 END) as en_attente,
        COUNT(CASE WHEN statut = 'confirmee' THEN 1 END) as confirmees,
        COUNT(CASE WHEN statut = 'terminee' THEN 1 END) as terminees,
        COUNT(CASE WHEN statut = 'annulee' THEN 1 END) as annulees,
        COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as nouvelles_ce_mois,
        SUM(CASE WHEN statut = 'terminee' THEN prix_total ELSE 0 END) as revenus_totaux,
        AVG(CASE WHEN statut = 'terminee' THEN prix_total END) as panier_moyen
      FROM reservations
    `);

    const [reservationsParJour] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as nombre_reservations,
        SUM(CASE WHEN statut = 'terminee' THEN prix_total ELSE 0 END) as revenus
      FROM reservations
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

    const [topServices] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        s.nom as service_nom,
        u.nom as prestataire_nom,
        COUNT(r.id) as nombre_reservations,
        SUM(CASE WHEN r.statut = 'terminee' THEN r.prix_total ELSE 0 END) as revenus_totaux,
        AVG(CASE WHEN a.note IS NOT NULL THEN a.note END) as moyenne_avis
      FROM services s
      LEFT JOIN reservations r ON s.id = r.service_id
      LEFT JOIN users u ON s.prestataire_id = u.id
      LEFT JOIN avis a ON r.id = a.reservation_id
      GROUP BY s.id
      HAVING nombre_reservations > 0
      ORDER BY nombre_reservations DESC
      LIMIT 10
    `);

    const [topClients] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        u.nom as client_nom,
        u.email as client_email,
        COUNT(r.id) as nombre_reservations,
        SUM(CASE WHEN r.statut = 'terminee' THEN r.prix_total ELSE 0 END) as total_depense,
        AVG(CASE WHEN a.note IS NOT NULL THEN a.note END) as moyenne_avis_donnees
      FROM users u
      LEFT JOIN reservations r ON u.id = r.client_id
      LEFT JOIN avis a ON r.id = a.reservation_id
      WHERE u.role_id = 1
      GROUP BY u.id
      HAVING nombre_reservations > 0
      ORDER BY total_depense DESC
      LIMIT 10
    `);

    res.json({
      overview: stats[0],
      reservationsParJour,
      topServices,
      topClients
    });
  } catch (error) {
    console.error('Erreur statistiques réservations:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/admin/reservations/conflicts - Détecter les conflits de réservations
router.get('/conflicts', async (req, res) => {
  try {
    const query = `
      SELECT 
        r1.id as reservation1_id,
        r1.date_reservation,
        r1.heure_debut,
        r1.heure_fin,
        r1.prestataire_id,
        up.nom as prestataire_nom,
        r2.id as reservation2_id,
        CONCAT(uc1.nom, ' vs ', uc2.nom) as clients_en_conflit,
        s1.nom as service1_nom,
        s2.nom as service2_nom
      FROM reservations r1
      JOIN reservations r2 ON r1.id < r2.id
        AND r1.prestataire_id = r2.prestataire_id
        AND r1.date_reservation = r2.date_reservation
        AND r1.heure_debut < r2.heure_fin
        AND r1.heure_fin > r2.heure_debut
      LEFT JOIN prestataires p ON r1.prestataire_id = p.id
      LEFT JOIN users up ON p.user_id = up.id
      LEFT JOIN users uc1 ON r1.client_id = uc1.id
      LEFT JOIN users uc2 ON r2.client_id = uc2.id
      LEFT JOIN services s1 ON r1.service_id = s1.id
      LEFT JOIN services s2 ON r2.service_id = s2.id
      WHERE r1.statut = 'confirmee' AND r2.statut = 'confirmee'
      ORDER BY r1.prestataire_id, r1.date_reservation, r1.heure_debut;
    `;

    const [conflicts] = await pool.execute<RowDataPacket[]>(query);

    res.json(conflicts);
  } catch (error) {
    console.error('Erreur détection conflits:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;

