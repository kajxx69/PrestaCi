import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { pool } from '../db.js';
const router = express.Router();
// Créer un avis
router.post('/', requireAuth, async (req, res) => {
    try {
        const { reservation_id, note, commentaire, photos } = req.body;
        const client_id = req.user.id;
        // Vérifier que la réservation existe et appartient au client
        const [reservations] = await pool.execute(`SELECT r.id, r.prestataire_id, r.service_id, r.statut_id, s.nom as statut_nom
       FROM reservations r
       JOIN statuts_reservation s ON r.statut_id = s.id
       WHERE r.id = ? AND r.client_id = ?`, [reservation_id, client_id]);
        if (reservations.length === 0) {
            return res.status(404).json({ error: 'Réservation non trouvée' });
        }
        const reservation = reservations[0];
        // Vérifier que la réservation est terminée
        if (reservation.statut_nom !== 'terminee') {
            return res.status(400).json({ error: 'Vous ne pouvez noter que les services terminés' });
        }
        // Vérifier qu'un avis n'existe pas déjà
        const [existingAvis] = await pool.execute('SELECT id FROM avis WHERE reservation_id = ?', [reservation_id]);
        if (existingAvis.length > 0) {
            return res.status(400).json({ error: 'Vous avez déjà noté ce service' });
        }
        // Validation de la note
        if (!note || note < 1 || note > 5) {
            return res.status(400).json({ error: 'La note doit être entre 1 et 5' });
        }
        // Créer l'avis
        const [result] = await pool.execute(`INSERT INTO avis (reservation_id, client_id, prestataire_id, service_id, note, commentaire, photos)
       VALUES (?, ?, ?, ?, ?, ?, ?)`, [
            reservation_id,
            client_id,
            reservation.prestataire_id,
            reservation.service_id,
            note,
            commentaire || null,
            photos ? JSON.stringify(photos) : null
        ]);
        // Mettre à jour les moyennes
        await updateAverageRatings(reservation.prestataire_id, reservation.service_id);
        res.json({
            ok: true,
            id: result.insertId,
            message: 'Avis créé avec succès'
        });
    }
    catch (error) {
        console.error('Erreur création avis:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
// Récupérer les avis d'un prestataire
router.get('/prestataire/:id', async (req, res) => {
    try {
        const prestataire_id = parseInt(req.params.id);
        const [avis] = await pool.execute(`SELECT a.*, 
              u.prenom, u.nom, u.photo_profil,
              s.nom as service_nom,
              DATE_FORMAT(a.created_at, '%d/%m/%Y') as date_avis
       FROM avis a
       JOIN users u ON a.client_id = u.id
       JOIN services s ON a.service_id = s.id
       WHERE a.prestataire_id = ?
       ORDER BY a.created_at DESC`, [prestataire_id]);
        // Parser les photos JSON
        const avisWithPhotos = avis.map((avisItem) => ({
            ...avisItem,
            photos: avisItem.photos ? JSON.parse(avisItem.photos) : []
        }));
        res.json(avisWithPhotos);
    }
    catch (error) {
        console.error('Erreur récupération avis prestataire:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
// Récupérer les avis d'un service
router.get('/service/:id', async (req, res) => {
    try {
        const service_id = parseInt(req.params.id);
        const [avis] = await pool.execute(`SELECT a.*, 
              u.prenom, u.nom, u.photo_profil,
              DATE_FORMAT(a.created_at, '%d/%m/%Y') as date_avis
       FROM avis a
       JOIN users u ON a.client_id = u.id
       WHERE a.service_id = ?
       ORDER BY a.created_at DESC`, [service_id]);
        // Parser les photos JSON
        const avisWithPhotos = avis.map((avisItem) => ({
            ...avisItem,
            photos: avisItem.photos ? JSON.parse(avisItem.photos) : []
        }));
        res.json(avisWithPhotos);
    }
    catch (error) {
        console.error('Erreur récupération avis service:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
// Récupérer les avis d'un client
router.get('/client', requireAuth, async (req, res) => {
    try {
        const client_id = req.user.id;
        const [avis] = await pool.execute(`SELECT a.*, 
              s.nom as service_nom,
              p.nom_commercial as prestataire_nom,
              DATE_FORMAT(a.created_at, '%d/%m/%Y') as date_avis
       FROM avis a
       JOIN services s ON a.service_id = s.id
       JOIN prestataires p ON a.prestataire_id = p.id
       WHERE a.client_id = ?
       ORDER BY a.created_at DESC`, [client_id]);
        // Parser les photos JSON
        const avisWithPhotos = avis.map((avisItem) => ({
            ...avisItem,
            photos: avisItem.photos ? JSON.parse(avisItem.photos) : []
        }));
        res.json(avisWithPhotos);
    }
    catch (error) {
        console.error('Erreur récupération avis client:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
// Supprimer un avis (client seulement)
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const avis_id = parseInt(req.params.id);
        const client_id = req.user.id;
        // Vérifier que l'avis appartient au client
        const [avis] = await pool.execute('SELECT prestataire_id, service_id FROM avis WHERE id = ? AND client_id = ?', [avis_id, client_id]);
        if (avis.length === 0) {
            return res.status(404).json({ error: 'Avis non trouvé' });
        }
        // Supprimer l'avis
        await pool.execute('DELETE FROM avis WHERE id = ?', [avis_id]);
        // Mettre à jour les moyennes
        await updateAverageRatings(avis[0].prestataire_id, avis[0].service_id);
        res.json({ ok: true, message: 'Avis supprimé avec succès' });
    }
    catch (error) {
        console.error('Erreur suppression avis:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
// Fonction pour mettre à jour les moyennes
async function updateAverageRatings(prestataire_id, service_id) {
    try {
        // Mettre à jour la moyenne du prestataire
        await pool.execute(`UPDATE prestataires 
       SET note_moyenne = (
         SELECT COALESCE(AVG(note), 0) FROM avis WHERE prestataire_id = ?
       ),
       nombre_avis = (
         SELECT COUNT(*) FROM avis WHERE prestataire_id = ?
       )
       WHERE id = ?`, [prestataire_id, prestataire_id, prestataire_id]);
        // Mettre à jour la moyenne du service
        await pool.execute(`UPDATE services 
       SET note_moyenne = (
         SELECT COALESCE(AVG(note), 0) FROM avis WHERE service_id = ?
       ),
       nombre_avis = (
         SELECT COUNT(*) FROM avis WHERE service_id = ?
       )
       WHERE id = ?`, [service_id, service_id, service_id]);
    }
    catch (error) {
        console.error('Erreur mise à jour moyennes:', error);
    }
}
export default router;
