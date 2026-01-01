import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
const router = Router();
// Middleware d'authentification pour toutes les routes
router.use(requireAuth);
// GET /api/dashboard/stats - Statistiques du prestataire
router.get('/stats', async (req, res) => {
    try {
        const userId = req.userId;
        // Récupérer l'ID du prestataire
        const [prestataireRows] = await pool.query('SELECT id FROM prestataires WHERE user_id = ? LIMIT 1', [userId]);
        if (prestataireRows.length === 0) {
            return res.status(403).json({ error: 'Profil prestataire requis' });
        }
        const prestataireId = prestataireRows[0].id;
        // Statistiques des réservations
        const [reservationStats] = await pool.query(`
      SELECT 
        COUNT(*) as reservations_total,
        SUM(CASE WHEN sr.nom = 'en_attente' THEN 1 ELSE 0 END) as reservations_en_attente,
        SUM(CASE WHEN sr.nom = 'confirmee' THEN 1 ELSE 0 END) as reservations_confirmees,
        SUM(CASE WHEN sr.nom = 'terminee' THEN 1 ELSE 0 END) as reservations_terminees
      FROM reservations r
      JOIN statuts_reservation sr ON r.statut_id = sr.id
      WHERE r.prestataire_id = ?
    `, [prestataireId]);
        // Statistiques des services
        const [serviceStats] = await pool.query(`
      SELECT 
        COUNT(*) as services_total,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as services_actifs
      FROM services 
      WHERE prestataire_id = ?
    `, [prestataireId]);
        // Note moyenne du prestataire
        const [noteStats] = await pool.query(`
      SELECT 
        COALESCE(AVG(note), 0) as note_moyenne,
        COUNT(*) as nombre_avis
      FROM avis 
      WHERE prestataire_id = ?
    `, [prestataireId]);
        // Revenus du mois en cours
        const [revenusStats] = await pool.query(`
      SELECT 
        COALESCE(SUM(prix_final), 0) as revenus_mois
      FROM reservations r
      JOIN statuts_reservation sr ON r.statut_id = sr.id
      WHERE r.prestataire_id = ? 
        AND sr.nom = 'terminee'
        AND YEAR(r.date_reservation) = YEAR(CURDATE())
        AND MONTH(r.date_reservation) = MONTH(CURDATE())
    `, [prestataireId]);
        const stats = {
            reservations_total: reservationStats[0]?.reservations_total || 0,
            reservations_en_attente: reservationStats[0]?.reservations_en_attente || 0,
            reservations_confirmees: reservationStats[0]?.reservations_confirmees || 0,
            reservations_terminees: reservationStats[0]?.reservations_terminees || 0,
            services_total: serviceStats[0]?.services_total || 0,
            services_actifs: serviceStats[0]?.services_actifs || 0,
            note_moyenne: parseFloat(noteStats[0]?.note_moyenne || 0),
            nombre_avis: noteStats[0]?.nombre_avis || 0,
            revenus_mois: parseFloat(revenusStats[0]?.revenus_mois || 0)
        };
        res.json(stats);
    }
    catch (e) {
        console.error('Erreur dashboard stats:', e);
        res.status(500).json({ error: e.message });
    }
});
// GET /api/dashboard/recent-reservations - Réservations récentes
router.get('/recent-reservations', async (req, res) => {
    try {
        const userId = req.userId;
        const limit = parseInt(req.query.limit) || 5;
        // Récupérer l'ID du prestataire
        const [prestataireRows] = await pool.query('SELECT id FROM prestataires WHERE user_id = ? LIMIT 1', [userId]);
        if (prestataireRows.length === 0) {
            return res.status(403).json({ error: 'Profil prestataire requis' });
        }
        const prestataireId = prestataireRows[0].id;
        const [rows] = await pool.query(`
      SELECT 
        r.id,
        r.date_reservation,
        r.heure_debut,
        r.heure_fin,
        r.prix_final,
        r.notes_client,
        u.nom as client_nom,
        u.prenom as client_prenom,
        s.nom as service_nom,
        sr.nom as statut_nom,
        sr.couleur as statut_couleur
      FROM reservations r
      JOIN users u ON r.client_id = u.id
      JOIN services s ON r.service_id = s.id
      JOIN statuts_reservation sr ON r.statut_id = sr.id
      WHERE r.prestataire_id = ?
      ORDER BY r.created_at DESC
      LIMIT ?
    `, [prestataireId, limit]);
        res.json(rows);
    }
    catch (e) {
        console.error('Erreur recent reservations:', e);
        res.status(500).json({ error: e.message });
    }
});
export default router;
