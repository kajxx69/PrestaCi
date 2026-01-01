import express, { Request, Response } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// GET /api/reservations?filter=all|upcoming|completed|cancelled
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const filter = String(req.query.filter || 'all');

    // Map filters to statut names per schema
    let whereStatus = '';
    if (filter === 'upcoming') {
      whereStatus = "AND s.nom IN ('en_attente','confirmee','acceptee')";
    } else if (filter === 'completed') {
      whereStatus = "AND s.nom IN ('terminee')";
    } else if (filter === 'cancelled') {
      whereStatus = "AND s.nom IN ('annulee','refusee')";
    }

    const [rows]: any = await pool.query(
      `SELECT 
         r.id, r.client_id, r.prestataire_id, r.service_id, r.statut_id, s.nom AS statut_nom, s.couleur AS statut_couleur,
         DATE_FORMAT(r.date_reservation, '%Y-%m-%d') AS date_reservation, r.heure_debut, r.heure_fin, r.prix_final, r.notes_client, r.a_domicile, r.adresse_rdv,
         sv.nom AS service_nom, sv.devise, sv.duree_minutes,
         p.nom_commercial AS prestataire_nom, p.adresse AS prestataire_adresse, p.telephone_pro AS prestataire_telephone
       FROM reservations r
       JOIN statuts_reservation s ON r.statut_id = s.id
       JOIN services sv ON r.service_id = sv.id
       JOIN prestataires p ON r.prestataire_id = p.id
       WHERE r.client_id = ? ${whereStatus}
       ORDER BY r.date_reservation DESC, r.heure_debut DESC`,
      [userId]
    );
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/reservations/:id/cancel
router.put('/:id/cancel', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const id = Number(req.params.id);

    // Ensure reservation belongs to client and is cancellable
    const [rows]: any = await pool.query(
      `SELECT r.*, s.nom AS statut_nom FROM reservations r JOIN statuts_reservation s ON r.statut_id = s.id WHERE r.id = ? AND r.client_id = ? LIMIT 1`,
      [id, userId]
    );
    const r = rows[0];
    if (!r) return res.status(404).json({ error: 'Réservation introuvable' });
    if (['terminee', 'annulee', 'refusee'].includes(r.statut_nom)) {
      return res.status(400).json({ error: 'Réservation non annulable' });
    }

    // Find statut id for 'annulee'
    const [sRows]: any = await pool.query(`SELECT id FROM statuts_reservation WHERE nom = 'annulee' LIMIT 1`);
    const cancelledId = sRows[0]?.id;
    if (!cancelledId) return res.status(500).json({ error: 'Statut annulee introuvable' });

    await pool.query(`UPDATE reservations SET statut_id = ?, updated_at = NOW() WHERE id = ?`, [cancelledId, id]);
    await pool.query(
      `INSERT INTO historique_reservations (reservation_id, ancien_statut_id, nouveau_statut_id, commentaire, changed_by_user_id)
       VALUES (?, ?, ?, ?, ?)`,
      [id, r.statut_id, cancelledId, 'Annulation par le client', userId]
    );
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/reservations
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { service_id, date_reservation, heure_debut, notes_client, a_domicile, adresse_rdv } = req.body;

    // 1. Fetch service details
    const [sRows]: any = await pool.query('SELECT * FROM services WHERE id = ? AND is_active = 1', [service_id]);
    const service = sRows[0];
    if (!service) return res.status(404).json({ error: 'Service introuvable ou inactif' });

    // 2. Calculate end time
    const [h, m] = heure_debut.split(':').map(Number);
    const startTime = new Date(`${date_reservation}T${heure_debut}`);
    const endTime = new Date(startTime.getTime() + service.duree_minutes * 60000);
    const heure_fin = endTime.toTimeString().slice(0, 5);

    // 3. Get default status 'en_attente'
    const [stRows]: any = await pool.query(`SELECT id FROM statuts_reservation WHERE nom = 'en_attente' LIMIT 1`);
    const enAttenteId = stRows[0]?.id;
    if (!enAttenteId) return res.status(500).json({ error: 'Statut par défaut introuvable' });

    // 4. Insert reservation
    const [iResult]: any = await pool.query(
      `INSERT INTO reservations (client_id, prestataire_id, service_id, statut_id, date_reservation, heure_debut, heure_fin, prix_final, notes_client, a_domicile, adresse_rdv, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [userId, service.prestataire_id, service_id, enAttenteId, date_reservation, heure_debut, heure_fin, service.prix, notes_client, a_domicile, a_domicile ? adresse_rdv : null]
    );
    const reservationId = iResult.insertId;

    // 5. Log history
    await pool.query(
      `INSERT INTO historique_reservations (reservation_id, ancien_statut_id, nouveau_statut_id, commentaire, changed_by_user_id)
       VALUES (?, ?, ?, ?, ?)`, 
      [reservationId, null, enAttenteId, 'Création de la réservation', userId]
    );

    res.status(201).json({ id: reservationId });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
