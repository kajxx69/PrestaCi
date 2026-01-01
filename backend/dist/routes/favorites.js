import express from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
const router = express.Router();
// Providers favorites
router.get('/providers', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const [rows] = await pool.query(`SELECT fp.prestataire_id AS id, p.nom_commercial, p.ville, p.bio, p.adresse, p.photos_etablissement, p.is_verified,
              p.note_moyenne, p.nombre_avis
         FROM favoris_prestataires fp
         JOIN prestataires p ON p.id = fp.prestataire_id
        WHERE fp.client_id = ?
        ORDER BY fp.created_at DESC`, [userId]);
        const result = rows.map((r) => {
            let photos = [];
            if (typeof r.photos_etablissement === 'string') {
                try {
                    photos = JSON.parse(r.photos_etablissement);
                }
                catch (e) {
                    // Ignorer l'erreur si ce n'est pas un JSON valide
                }
            }
            else if (Array.isArray(r.photos_etablissement)) {
                photos = r.photos_etablissement;
            }
            return {
                ...r,
                photos_etablissement: photos,
            };
        });
        res.json(result);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post('/providers/:id', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const id = Number(req.params.id);
        await pool.query(`INSERT IGNORE INTO favoris_prestataires (client_id, prestataire_id, created_at) VALUES (?, ?, NOW())`, [userId, id]);
        res.json({ ok: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.delete('/providers/:id', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const id = Number(req.params.id);
        await pool.query(`DELETE FROM favoris_prestataires WHERE client_id = ? AND prestataire_id = ?`, [userId, id]);
        res.json({ ok: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// Services favorites
router.get('/services', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const [rows] = await pool.query(`SELECT fs.service_id AS id, sv.nom, sv.description, sv.photos, sv.prix, sv.devise, sv.duree_minutes,
              sv.prestataire_id, p.nom_commercial AS prestataire_nom
         FROM favoris_services fs
         JOIN services sv ON sv.id = fs.service_id
         JOIN prestataires p ON p.id = sv.prestataire_id
        WHERE fs.client_id = ?
        ORDER BY fs.created_at DESC`, [userId]);
        const result = rows.map((r) => {
            let photos = [];
            if (typeof r.photos === 'string') {
                try {
                    photos = JSON.parse(r.photos);
                }
                catch (e) { }
            }
            else if (Array.isArray(r.photos)) {
                photos = r.photos;
            }
            return {
                ...r,
                photos,
                note_moyenne: 0,
                nombre_avis: 0,
            };
        });
        res.json(result);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post('/services/:id', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const id = Number(req.params.id);
        await pool.query(`INSERT IGNORE INTO favoris_services (client_id, service_id, created_at) VALUES (?, ?, NOW())`, [userId, id]);
        res.json({ ok: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.delete('/services/:id', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const id = Number(req.params.id);
        await pool.query(`DELETE FROM favoris_services WHERE client_id = ? AND service_id = ?`, [userId, id]);
        res.json({ ok: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// Publications favorites
router.get('/publications', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const [rows] = await pool.query(`SELECT fp.publication_id AS id, pub.description, pub.photos, pub.videos, pub.nombre_likes, pub.created_at,
              pub.client_id, u.prenom AS client_prenom, u.nom AS client_nom, u.photo_profil,
              pub.prestataire_id, p.nom_commercial AS prestataire_nom,
              pub.service_id, sv.nom AS service_nom,
              EXISTS(SELECT 1 FROM likes l WHERE l.publication_id = pub.id AND l.user_id = ?) AS liked
         FROM favoris_publications fp
         JOIN publications pub ON pub.id = fp.publication_id
         JOIN users u ON u.id = pub.client_id
         LEFT JOIN prestataires p ON p.id = pub.prestataire_id
         LEFT JOIN services sv ON sv.id = pub.service_id
        WHERE fp.client_id = ?
        ORDER BY fp.created_at DESC`, [userId, userId]);
        const result = rows.map((r) => {
            let photos = [];
            if (typeof r.photos === 'string') {
                try {
                    photos = JSON.parse(r.photos);
                }
                catch (e) { }
            }
            else if (Array.isArray(r.photos)) {
                photos = r.photos;
            }
            let videos = [];
            if (typeof r.videos === 'string') {
                try {
                    videos = JSON.parse(r.videos);
                }
                catch (e) { }
            }
            else if (Array.isArray(r.videos)) {
                videos = r.videos;
            }
            return {
                ...r,
                photos,
                videos,
                liked: !!r.liked,
                nombre_commentaires: 0,
            };
        });
        res.json(result);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post('/publications/:id', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const id = Number(req.params.id);
        await pool.query(`INSERT IGNORE INTO favoris_publications (client_id, publication_id, created_at) VALUES (?, ?, NOW())`, [userId, id]);
        res.json({ ok: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.delete('/publications/:id', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const id = Number(req.params.id);
        await pool.query(`DELETE FROM favoris_publications WHERE client_id = ? AND publication_id = ?`, [userId, id]);
        res.json({ ok: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
export default router;
