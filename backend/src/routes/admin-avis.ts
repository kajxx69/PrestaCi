import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { pool } from '../db.js';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

const router = express.Router();

// Middleware d'authentification admin
router.use(requireAuth);
router.use(requireRole('admin'));

// Interface pour les avis
interface AvisRow extends RowDataPacket {
  id: number;
  reservation_id: number;
  client_id: number;
  client_nom: string;
  client_email: string;
  prestataire_id: number;
  prestataire_nom: string;
  prestataire_email: string;
  service_id: number;
  service_nom: string;
  note: number;
  commentaire: string;
  is_moderated: boolean;
  is_approved: boolean;
  moderation_reason: string;
  moderated_by: number;
  moderated_at: string;
  created_at: string;
  updated_at: string;
}

// GET /api/admin/avis - Récupérer tous les avis avec filtres
router.get('/', async (req, res) => {
  try {
    const { 
      status = 'all', 
      search = '', 
      page = 1, 
      limit = 20,
      note_min,
      note_max,
      prestataire_id,
      service_id
    } = req.query;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    // Filtres de modération
    if (status === 'pending') {
      whereClause += ' AND a.is_moderated = 0';
    } else if (status === 'approved') {
      whereClause += ' AND a.is_moderated = 1 AND a.is_approved = 1';
    } else if (status === 'rejected') {
      whereClause += ' AND a.is_moderated = 1 AND a.is_approved = 0';
    }

    if (search) {
      whereClause += ` AND (
        uc.nom LIKE ? OR uc.email LIKE ? OR 
        up.nom LIKE ? OR up.email LIKE ? OR 
        s.nom LIKE ? OR a.commentaire LIKE ?
      )`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (note_min) {
      whereClause += ' AND a.note >= ?';
      params.push(Number(note_min));
    }

    if (note_max) {
      whereClause += ' AND a.note <= ?';
      params.push(Number(note_max));
    }

    if (prestataire_id) {
      whereClause += ' AND r.prestataire_id = ?';
      params.push(prestataire_id);
    }

    if (service_id) {
      whereClause += ' AND r.service_id = ?';
      params.push(service_id);
    }

    const offset = (Number(page) - 1) * Number(limit);

    const query = `
      SELECT 
        a.*,
        r.prestataire_id,
        r.service_id,
        uc.nom as client_nom,
        uc.email as client_email,
        up.nom as prestataire_nom,
        up.email as prestataire_email,
        s.nom as service_nom,
        um.nom as moderated_by_nom
      FROM avis a
      LEFT JOIN reservations r ON a.reservation_id = r.id
      LEFT JOIN users uc ON a.client_id = uc.id
      LEFT JOIN users up ON r.prestataire_id = up.id
      LEFT JOIN services s ON r.service_id = s.id
      LEFT JOIN users um ON a.moderated_by = um.id
      ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `;

    params.push(Number(limit), offset);

    const [avis] = await pool.execute<AvisRow[]>(query, params);

    // Compter le total pour la pagination
    const countQuery = `
      SELECT COUNT(DISTINCT a.id) as total
      FROM avis a
      LEFT JOIN reservations r ON a.reservation_id = r.id
      LEFT JOIN users uc ON a.client_id = uc.id
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
      avis,
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
    console.error('Erreur récupération avis:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/admin/avis/:id - Récupérer un avis spécifique
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        a.*,
        r.prestataire_id,
        r.service_id,
        r.date_reservation,
        r.prix_total,
        uc.nom as client_nom,
        uc.email as client_email,
        uc.telephone as client_telephone,
        up.nom as prestataire_nom,
        up.email as prestataire_email,
        up.telephone as prestataire_telephone,
        s.nom as service_nom,
        s.description as service_description,
        um.nom as moderated_by_nom
      FROM avis a
      LEFT JOIN reservations r ON a.reservation_id = r.id
      LEFT JOIN users uc ON a.client_id = uc.id
      LEFT JOIN users up ON r.prestataire_id = up.id
      LEFT JOIN services s ON r.service_id = s.id
      LEFT JOIN users um ON a.moderated_by = um.id
      WHERE a.id = ?
    `;

    const [avis] = await pool.execute<AvisRow[]>(query, [id]);

    if (avis.length === 0) {
      return res.status(404).json({ error: 'Avis non trouvé' });
    }

    res.json(avis[0]);
  } catch (error) {
    console.error('Erreur récupération avis:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/admin/avis/:id/moderate - Modérer un avis (approuver/rejeter)
router.put('/:id/moderate', async (req, res) => {
  try {
    const { id } = req.params;
    const { is_approved, reason } = req.body;

    if (typeof is_approved !== 'boolean') {
      return res.status(400).json({ error: 'is_approved doit être un booléen' });
    }

    // Vérifier que l'avis existe
    const [avis] = await pool.execute<RowDataPacket[]>(
      `SELECT a.*, r.prestataire_id, uc.nom as client_nom, s.nom as service_nom
       FROM avis a
       LEFT JOIN reservations r ON a.reservation_id = r.id
       LEFT JOIN users uc ON a.client_id = uc.id
       LEFT JOIN services s ON r.service_id = s.id
       WHERE a.id = ?`,
      [id]
    );

    if (avis.length === 0) {
      return res.status(404).json({ error: 'Avis non trouvé' });
    }

    const avisData = avis[0];

    // Mettre à jour la modération
    await pool.execute(
      `UPDATE avis 
       SET is_moderated = 1, is_approved = ?, moderation_reason = ?, 
           moderated_by = ?, moderated_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      [is_approved, reason || null, req.user.id, id]
    );

    // Log de l'action admin
    await pool.execute(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, created_at) 
       VALUES (?, ?, 'avis', ?, ?, NOW())`,
      [
        req.user.id,
        is_approved ? 'avis_approved' : 'avis_rejected',
        id,
        JSON.stringify({ 
          client_nom: avisData.client_nom,
          service_nom: avisData.service_nom,
          note: avisData.note,
          reason 
        })
      ]
    );

    // Notifier le client
    const notificationMessage = is_approved 
      ? `Votre avis sur "${avisData.service_nom}" a été approuvé et est maintenant visible.`
      : `Votre avis sur "${avisData.service_nom}" a été rejeté. Raison: ${reason || 'Non conforme aux conditions d\'utilisation'}`;

    await pool.execute(
      `INSERT INTO notifications (user_id, type, title, message, data, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        avisData.client_id,
        is_approved ? 'avis_approved' : 'avis_rejected',
        is_approved ? 'Avis approuvé' : 'Avis rejeté',
        notificationMessage,
        JSON.stringify({ 
          avis_id: id, 
          service_nom: avisData.service_nom, 
          reason: reason || null 
        })
      ]
    );

    // Si approuvé, notifier aussi le prestataire
    if (is_approved) {
      await pool.execute(
        `INSERT INTO notifications (user_id, type, title, message, data, created_at)
         VALUES (?, 'new_avis', 'Nouvel avis approuvé', ?, ?, NOW())`,
        [
          avisData.prestataire_id,
          `Un nouvel avis ${avisData.note}/5 étoiles a été publié sur votre service "${avisData.service_nom}".`,
          JSON.stringify({ 
            avis_id: id, 
            service_nom: avisData.service_nom, 
            note: avisData.note 
          })
        ]
      );
    }

    res.json({ 
      success: true, 
      message: is_approved ? 'Avis approuvé' : 'Avis rejeté' 
    });
  } catch (error) {
    console.error('Erreur modération avis:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/admin/avis/:id - Supprimer un avis
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Vérifier que l'avis existe
    const [avis] = await pool.execute<RowDataPacket[]>(
      `SELECT a.*, r.prestataire_id, uc.nom as client_nom, s.nom as service_nom
       FROM avis a
       LEFT JOIN reservations r ON a.reservation_id = r.id
       LEFT JOIN users uc ON a.client_id = uc.id
       LEFT JOIN services s ON r.service_id = s.id
       WHERE a.id = ?`,
      [id]
    );

    if (avis.length === 0) {
      return res.status(404).json({ error: 'Avis non trouvé' });
    }

    const avisData = avis[0];

    // Supprimer l'avis
    await pool.execute('DELETE FROM avis WHERE id = ?', [id]);

    // Log de l'action admin
    await pool.execute(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, created_at) 
       VALUES (?, 'avis_deleted', 'avis', ?, ?, NOW())`,
      [
        req.user.id,
        id,
        JSON.stringify({ 
          client_nom: avisData.client_nom,
          service_nom: avisData.service_nom,
          note: avisData.note,
          commentaire: avisData.commentaire,
          reason 
        })
      ]
    );

    // Notifier le client et le prestataire
    const notifications = [
      {
        user_id: avisData.client_id,
        type: 'avis_deleted',
        title: 'Avis supprimé',
        message: `Votre avis sur "${avisData.service_nom}" a été supprimé par un administrateur. Raison: ${reason || 'Violation des conditions d\'utilisation'}`,
        data: JSON.stringify({ service_nom: avisData.service_nom, reason })
      },
      {
        user_id: avisData.prestataire_id,
        type: 'avis_deleted',
        title: 'Avis supprimé',
        message: `Un avis sur votre service "${avisData.service_nom}" a été supprimé par un administrateur.`,
        data: JSON.stringify({ service_nom: avisData.service_nom, reason })
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

    res.json({ success: true, message: 'Avis supprimé' });
  } catch (error) {
    console.error('Erreur suppression avis:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/admin/avis/stats - Statistiques des avis
router.get('/stats/overview', async (req, res) => {
  try {
    const [stats] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        COUNT(*) as total_avis,
        COUNT(CASE WHEN is_moderated = 0 THEN 1 END) as en_attente_moderation,
        COUNT(CASE WHEN is_moderated = 1 AND is_approved = 1 THEN 1 END) as approuves,
        COUNT(CASE WHEN is_moderated = 1 AND is_approved = 0 THEN 1 END) as rejetes,
        COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as nouveaux_ce_mois,
        AVG(note) as note_moyenne_globale,
        COUNT(CASE WHEN note = 5 THEN 1 END) as notes_5_etoiles,
        COUNT(CASE WHEN note = 1 THEN 1 END) as notes_1_etoile
      FROM avis
    `);

    const [notesDistribution] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        note,
        COUNT(*) as nombre_avis,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM avis), 2) as pourcentage
      FROM avis
      WHERE is_moderated = 1 AND is_approved = 1
      GROUP BY note
      ORDER BY note DESC
    `);

    const [avisParJour] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as nombre_avis,
        AVG(note) as note_moyenne
      FROM avis
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

    const [servicesLesMieuxNotes] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        s.nom as service_nom,
        u.nom as prestataire_nom,
        COUNT(a.id) as nombre_avis,
        AVG(a.note) as note_moyenne,
        COUNT(CASE WHEN a.note = 5 THEN 1 END) as avis_5_etoiles
      FROM services s
      LEFT JOIN reservations r ON s.id = r.service_id
      LEFT JOIN avis a ON r.id = a.reservation_id AND a.is_moderated = 1 AND a.is_approved = 1
      LEFT JOIN users u ON s.prestataire_id = u.id
      GROUP BY s.id
      HAVING nombre_avis >= 3
      ORDER BY note_moyenne DESC, nombre_avis DESC
      LIMIT 10
    `);

    const [avisProblematiques] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        a.id,
        a.note,
        a.commentaire,
        a.created_at,
        uc.nom as client_nom,
        s.nom as service_nom,
        up.nom as prestataire_nom
      FROM avis a
      LEFT JOIN reservations r ON a.reservation_id = r.id
      LEFT JOIN users uc ON a.client_id = uc.id
      LEFT JOIN users up ON r.prestataire_id = up.id
      LEFT JOIN services s ON r.service_id = s.id
      WHERE a.is_moderated = 0 
        AND (
          a.note <= 2 
          OR a.commentaire REGEXP '(spam|fake|bot|arnaque|escroquerie)'
          OR LENGTH(a.commentaire) < 10
        )
      ORDER BY a.created_at DESC
      LIMIT 20
    `);

    res.json({
      overview: stats[0],
      notesDistribution,
      avisParJour,
      servicesLesMieuxNotes,
      avisProblematiques
    });
  } catch (error) {
    console.error('Erreur statistiques avis:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/admin/avis/bulk-moderate - Modération en lot
router.post('/bulk-moderate', async (req, res) => {
  try {
    const { avis_ids, is_approved, reason } = req.body;

    if (!Array.isArray(avis_ids) || avis_ids.length === 0) {
      return res.status(400).json({ error: 'Liste d\'IDs d\'avis requise' });
    }

    if (typeof is_approved !== 'boolean') {
      return res.status(400).json({ error: 'is_approved doit être un booléen' });
    }

    // Vérifier que tous les avis existent
    const placeholders = avis_ids.map(() => '?').join(',');
    const [avis] = await pool.execute<RowDataPacket[]>(
      `SELECT a.id, a.client_id, r.prestataire_id, uc.nom as client_nom, s.nom as service_nom
       FROM avis a
       LEFT JOIN reservations r ON a.reservation_id = r.id
       LEFT JOIN users uc ON a.client_id = uc.id
       LEFT JOIN services s ON r.service_id = s.id
       WHERE a.id IN (${placeholders})`,
      avis_ids
    );

    if (avis.length !== avis_ids.length) {
      return res.status(400).json({ error: 'Certains avis n\'existent pas' });
    }

    // Mettre à jour tous les avis
    await pool.execute(
      `UPDATE avis 
       SET is_moderated = 1, is_approved = ?, moderation_reason = ?, 
           moderated_by = ?, moderated_at = NOW(), updated_at = NOW()
       WHERE id IN (${placeholders})`,
      [is_approved, reason || null, req.user.id, ...avis_ids]
    );

    // Log de l'action admin
    await pool.execute(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, created_at) 
       VALUES (?, ?, 'avis', 0, ?, NOW())`,
      [
        req.user.id,
        is_approved ? 'avis_bulk_approved' : 'avis_bulk_rejected',
        JSON.stringify({ 
          avis_count: avis_ids.length,
          avis_ids,
          reason 
        })
      ]
    );

    // Notifier tous les clients concernés
    for (const avisData of avis) {
      const notificationMessage = is_approved 
        ? `Votre avis sur "${avisData.service_nom}" a été approuvé et est maintenant visible.`
        : `Votre avis sur "${avisData.service_nom}" a été rejeté. Raison: ${reason || 'Non conforme aux conditions d\'utilisation'}`;

      await pool.execute(
        `INSERT INTO notifications (user_id, type, title, message, data, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [
          avisData.client_id,
          is_approved ? 'avis_approved' : 'avis_rejected',
          is_approved ? 'Avis approuvé' : 'Avis rejeté',
          notificationMessage,
          JSON.stringify({ 
            service_nom: avisData.service_nom, 
            reason: reason || null 
          })
        ]
      );
    }

    res.json({ 
      success: true, 
      message: `${avis_ids.length} avis ${is_approved ? 'approuvés' : 'rejetés'}` 
    });
  } catch (error) {
    console.error('Erreur modération en lot:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
