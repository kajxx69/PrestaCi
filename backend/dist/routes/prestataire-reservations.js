import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { ClientNotifications } from '../services/notifications.js';
import { ClientInAppNotifications } from '../services/in-app-notifications.js';
const router = Router();
// Middleware d'authentification pour toutes les routes
router.use(requireAuth);
async function getPrestataireIdByUserId(userId) {
    const [rows] = await pool.query('SELECT id FROM prestataires WHERE user_id = ? LIMIT 1', [userId]);
    return rows[0]?.id || null;
}
// GET /api/prestataire/reservations - Liste des réservations du prestataire
router.get('/', async (req, res) => {
    try {
        const userId = req.userId;
        const filter = req.query.filter || 'all';
        const prestataireId = await getPrestataireIdByUserId(userId);
        if (!prestataireId) {
            return res.status(403).json({ error: 'Profil prestataire requis' });
        }
        let whereClause = 'WHERE r.prestataire_id = ?';
        const params = [prestataireId];
        // Filtres par statut
        if (filter === 'en_attente') {
            whereClause += " AND sr.nom = 'en_attente'";
        }
        else if (filter === 'confirmee') {
            whereClause += " AND sr.nom IN ('confirmee', 'acceptee')";
        }
        else if (filter === 'terminee') {
            whereClause += " AND sr.nom = 'terminee'";
        }
        else if (filter === 'annulee') {
            whereClause += " AND sr.nom IN ('annulee', 'refusee')";
        }
        const [rows] = await pool.query(`
      SELECT 
        r.id,
        DATE_FORMAT(r.date_reservation, '%Y-%m-%d') as date_reservation,
        r.heure_debut,
        r.heure_fin,
        r.prix_final,
        r.notes_client,
        r.a_domicile,
        r.adresse_rdv,
        u.nom as client_nom,
        u.prenom as client_prenom,
        u.telephone as client_telephone,
        u.email as client_email,
        s.nom as service_nom,
        s.duree_minutes,
        sr.nom as statut,
        sr.couleur as statut_couleur,
        r.created_at
      FROM reservations r
      JOIN users u ON r.client_id = u.id
      JOIN services s ON r.service_id = s.id
      JOIN statuts_reservation sr ON r.statut_id = sr.id
      ${whereClause}
      ORDER BY r.date_reservation DESC, r.heure_debut DESC
    `, params);
        res.json(rows);
    }
    catch (e) {
        console.error('Erreur liste réservations prestataire:', e);
        res.status(500).json({ error: e.message });
    }
});
// PUT /api/prestataire/reservations/:id/accept - Accepter une réservation
router.put('/:id/accept', async (req, res) => {
    try {
        const userId = req.userId;
        const reservationId = parseInt(req.params.id);
        const prestataireId = await getPrestataireIdByUserId(userId);
        if (!prestataireId) {
            return res.status(403).json({ error: 'Profil prestataire requis' });
        }
        // Vérifier que la réservation appartient au prestataire
        const [reservationRows] = await pool.query(`SELECT r.*, sr.nom as statut_nom, s.nom as service_nom 
       FROM reservations r 
       JOIN statuts_reservation sr ON r.statut_id = sr.id 
       JOIN services s ON r.service_id = s.id
       WHERE r.id = ? AND r.prestataire_id = ? LIMIT 1`, [reservationId, prestataireId]);
        if (reservationRows.length === 0) {
            return res.status(404).json({ error: 'Réservation introuvable' });
        }
        const reservation = reservationRows[0];
        // Vérifier que la réservation peut être acceptée
        if (reservation.statut_nom !== 'en_attente') {
            return res.status(400).json({ error: 'Cette réservation ne peut plus être acceptée' });
        }
        // Trouver l'ID du statut "confirmee"
        const [statutRows] = await pool.query("SELECT id FROM statuts_reservation WHERE nom = 'confirmee' LIMIT 1");
        if (statutRows.length === 0) {
            return res.status(500).json({ error: 'Statut confirmee introuvable' });
        }
        const confirmedStatusId = statutRows[0].id;
        // Mettre à jour le statut
        await pool.query('UPDATE reservations SET statut_id = ?, updated_at = NOW() WHERE id = ?', [confirmedStatusId, reservationId]);
        // Ajouter à l'historique
        await pool.query(`INSERT INTO historique_reservations (reservation_id, ancien_statut_id, nouveau_statut_id, commentaire, changed_by_user_id)
       VALUES (?, ?, ?, ?, ?)`, [reservationId, reservation.statut_id, confirmedStatusId, 'Réservation acceptée par le prestataire', userId]);
        // Envoyer notification au client
        try {
            const [prestataireRows] = await pool.query('SELECT u.nom, u.prenom FROM users u JOIN prestataires p ON u.id = p.user_id WHERE p.id = ? LIMIT 1', [prestataireId]);
            if (prestataireRows.length > 0) {
                const prestataireNom = `${prestataireRows[0].prenom} ${prestataireRows[0].nom}`;
                const dateReservation = new Date(reservation.date_reservation).toLocaleDateString('fr-FR');
                const serviceNom = reservation.service_nom || 'votre service';
                await ClientNotifications.reservationConfirmee(reservation.client_id, prestataireNom, serviceNom, dateReservation);
                await ClientInAppNotifications.reservationConfirmee(reservation.client_id, prestataireNom, serviceNom, dateReservation, reservation.heure_debut || 'Non spécifiée');
            }
        }
        catch (notifError) {
            console.error('Erreur envoi notification:', notifError);
            // Ne pas faire échouer la requête pour une erreur de notification
        }
        res.json({ ok: true, message: 'Réservation acceptée avec succès' });
    }
    catch (e) {
        console.error('Erreur acceptation réservation:', e);
        res.status(500).json({ error: e.message });
    }
});
// PUT /api/prestataire/reservations/:id/reject - Refuser une réservation
router.put('/:id/reject', async (req, res) => {
    try {
        const userId = req.userId;
        const reservationId = parseInt(req.params.id);
        const { motif } = req.body;
        const prestataireId = await getPrestataireIdByUserId(userId);
        if (!prestataireId) {
            return res.status(403).json({ error: 'Profil prestataire requis' });
        }
        // Vérifier que la réservation appartient au prestataire
        const [reservationRows] = await pool.query(`SELECT r.*, sr.nom as statut_nom, s.nom as service_nom 
       FROM reservations r 
       JOIN statuts_reservation sr ON r.statut_id = sr.id 
       JOIN services s ON r.service_id = s.id
       WHERE r.id = ? AND r.prestataire_id = ? LIMIT 1`, [reservationId, prestataireId]);
        if (reservationRows.length === 0) {
            return res.status(404).json({ error: 'Réservation introuvable' });
        }
        const reservation = reservationRows[0];
        // Vérifier que la réservation peut être refusée
        if (!['en_attente', 'confirmee'].includes(reservation.statut_nom)) {
            return res.status(400).json({ error: 'Cette réservation ne peut plus être refusée' });
        }
        // Trouver l'ID du statut "refusee"
        const [statutRows] = await pool.query("SELECT id FROM statuts_reservation WHERE nom = 'refusee' LIMIT 1");
        if (statutRows.length === 0) {
            return res.status(500).json({ error: 'Statut refusee introuvable' });
        }
        const rejectedStatusId = statutRows[0].id;
        // Mettre à jour le statut
        await pool.query('UPDATE reservations SET statut_id = ?, updated_at = NOW() WHERE id = ?', [rejectedStatusId, reservationId]);
        // Ajouter à l'historique
        const commentaire = motif ? `Réservation refusée: ${motif}` : 'Réservation refusée par le prestataire';
        await pool.query(`INSERT INTO historique_reservations (reservation_id, ancien_statut_id, nouveau_statut_id, commentaire, changed_by_user_id)
       VALUES (?, ?, ?, ?, ?)`, [reservationId, reservation.statut_id, rejectedStatusId, commentaire, userId]);
        try {
            const [prestataireRows] = await pool.query('SELECT u.nom, u.prenom FROM users u JOIN prestataires p ON u.id = p.user_id WHERE p.id = ? LIMIT 1', [prestataireId]);
            if (prestataireRows.length > 0) {
                const prestataireNom = `${prestataireRows[0].prenom} ${prestataireRows[0].nom}`;
                const serviceNom = reservation.service_nom || 'votre service';
                await ClientNotifications.reservationRefusee(reservation.client_id, prestataireNom, serviceNom, motif);
                await ClientInAppNotifications.reservationRefusee(reservation.client_id, prestataireNom, serviceNom, motif);
            }
        }
        catch (notifError) {
            console.error('Erreur notification refus réservation:', notifError);
        }
        res.json({ ok: true, message: 'Réservation refusée avec succès' });
    }
    catch (e) {
        console.error('Erreur refus réservation:', e);
        res.status(500).json({ error: e.message });
    }
});
// PUT /api/prestataire/reservations/:id/complete - Marquer comme terminée
router.put('/:id/complete', async (req, res) => {
    try {
        const userId = req.userId;
        const reservationId = parseInt(req.params.id);
        const prestataireId = await getPrestataireIdByUserId(userId);
        if (!prestataireId) {
            return res.status(403).json({ error: 'Profil prestataire requis' });
        }
        // Vérifier que la réservation appartient au prestataire
        const [reservationRows] = await pool.query(`SELECT r.*, sr.nom as statut_nom, s.nom as service_nom 
       FROM reservations r 
       JOIN statuts_reservation sr ON r.statut_id = sr.id 
       JOIN services s ON r.service_id = s.id
       WHERE r.id = ? AND r.prestataire_id = ? LIMIT 1`, [reservationId, prestataireId]);
        if (reservationRows.length === 0) {
            return res.status(404).json({ error: 'Réservation introuvable' });
        }
        const reservation = reservationRows[0];
        // Vérifier que la réservation peut être terminée
        if (reservation.statut_nom !== 'confirmee') {
            return res.status(400).json({ error: 'Seules les réservations confirmées peuvent être marquées comme terminées' });
        }
        // Trouver l'ID du statut "terminee"
        const [statutRows] = await pool.query("SELECT id FROM statuts_reservation WHERE nom = 'terminee' LIMIT 1");
        if (statutRows.length === 0) {
            return res.status(500).json({ error: 'Statut terminee introuvable' });
        }
        const completedStatusId = statutRows[0].id;
        // Mettre à jour le statut
        await pool.query('UPDATE reservations SET statut_id = ?, updated_at = NOW() WHERE id = ?', [completedStatusId, reservationId]);
        // Ajouter à l'historique
        await pool.query(`INSERT INTO historique_reservations (reservation_id, ancien_statut_id, nouveau_statut_id, commentaire, changed_by_user_id)
       VALUES (?, ?, ?, ?, ?)`, [reservationId, reservation.statut_id, completedStatusId, 'Service terminé', userId]);
        try {
            const [prestataireRows] = await pool.query('SELECT u.nom, u.prenom FROM users u JOIN prestataires p ON u.id = p.user_id WHERE p.id = ? LIMIT 1', [prestataireId]);
            if (prestataireRows.length > 0) {
                const prestataireNom = `${prestataireRows[0].prenom} ${prestataireRows[0].nom}`;
                const serviceNom = reservation.service_nom || 'votre service';
                await ClientNotifications.serviceTermine(reservation.client_id, prestataireNom, serviceNom);
                await ClientInAppNotifications.serviceTermine(reservation.client_id, prestataireNom, serviceNom);
            }
        }
        catch (notifError) {
            console.error('Erreur notification completion réservation:', notifError);
        }
        res.json({ ok: true, message: 'Réservation marquée comme terminée' });
    }
    catch (e) {
        console.error('Erreur completion réservation:', e);
        res.status(500).json({ error: e.message });
    }
});
export default router;
