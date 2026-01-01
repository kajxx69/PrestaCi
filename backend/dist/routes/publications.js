import express from 'express';
import { pool } from '../db.js';
const router = express.Router();
async function getUserIdFromSession(req) {
    const token = req.cookies?.session_token;
    if (!token)
        return null;
    const [rows] = await pool.query('SELECT us.user_id FROM user_sessions us WHERE us.token = ? AND us.expires_at > NOW() LIMIT 1', [token]);
    return rows[0]?.user_id || null;
}
// GET /api/publications?mine=0|1
router.get('/', async (req, res) => {
    try {
        const userId = await getUserIdFromSession(req);
        if (!userId)
            return res.status(401).json({ error: 'Non authentifié' });
        const mine = String(req.query.mine || '0') === '1';
        const where = mine ? 'WHERE pub.client_id = ?' : '';
        const params = mine ? [userId] : [];
        const [rows] = await pool.query(`SELECT pub.id, pub.client_id, pub.prestataire_id, pub.service_id, pub.description, pub.photos, pub.videos,
              pub.nombre_likes, (SELECT COUNT(*) FROM commentaires c WHERE c.publication_id = pub.id) AS nombre_commentaires, pub.is_visible, pub.created_at,
              u.prenom AS client_prenom, u.nom AS client_nom, u.photo_profil,
              p.nom_commercial AS prestataire_nom,
              sv.nom AS service_nom,
              EXISTS(SELECT 1 FROM likes l WHERE l.publication_id = pub.id AND l.user_id = ?) AS liked
         FROM publications pub
         JOIN users u ON u.id = pub.client_id
         LEFT JOIN prestataires p ON p.id = pub.prestataire_id
         LEFT JOIN services sv ON sv.id = pub.service_id
         ${where}
         ORDER BY pub.created_at DESC
         LIMIT 200`, [userId, ...params]);
        const safeJsonParse = (data) => {
            if (!data)
                return [];
            const jsonString = String(data);
            // Si la chaîne commence comme un tableau JSON, on la parse
            if (jsonString.startsWith('[')) {
                try {
                    return JSON.parse(jsonString);
                }
                catch (e) {
                    return []; // En cas d'erreur de parsing, retourne un tableau vide
                }
            }
            // Si c'est une simple chaîne (probablement une ancienne donnée base64), on l'encapsule dans un tableau
            if (jsonString.startsWith('data:')) {
                return [jsonString];
            }
            // Sinon, on retourne un tableau vide
            return [];
        };
        const result = rows.map((r) => ({
            ...r,
            photos: safeJsonParse(r.photos),
            videos: safeJsonParse(r.videos),
            liked: !!r.liked,
            nombre_likes: Number(r.nombre_likes) || 0,
            nombre_commentaires: Number(r.nombre_commentaires) || 0,
        }));
        res.json(result);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// POST /api/publications
router.post('/', async (req, res) => {
    try {
        const userId = await getUserIdFromSession(req);
        if (!userId)
            return res.status(401).json({ error: 'Non authentifié' });
        const { prestataire_id, service_id, description, photos, videos } = req.body || {};
        if (!prestataire_id || !description)
            return res.status(400).json({ error: 'prestataire_id et description requis' });
        console.log('Creating publication:', { userId, prestataire_id, service_id, description, photos, videos });
        const photosJson = photos ? JSON.stringify(photos) : JSON.stringify([]);
        const videosJson = videos ? JSON.stringify(videos) : JSON.stringify([]);
        const [result] = await pool.query(`INSERT INTO publications (client_id, prestataire_id, service_id, description, photos, videos, nombre_likes, is_visible, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, 1, NOW(), NOW())`, [userId, prestataire_id, service_id || null, description, photosJson, videosJson]);
        res.json({ id: result.insertId });
    }
    catch (e) {
        console.error('Error creating publication:', e.message, e.stack);
        res.status(500).json({ error: e.message });
    }
});
// POST /api/publications/:id/like
router.post('/:id/like', async (req, res) => {
    try {
        const userId = await getUserIdFromSession(req);
        if (!userId)
            return res.status(401).json({ error: 'Non authentifié' });
        const pubId = Number(req.params.id);
        const [result] = await pool.query(`INSERT IGNORE INTO likes (publication_id, user_id, created_at) VALUES (?, ?, NOW())`, [pubId, userId]);
        if (result.affectedRows > 0) {
            // Recalculer le nombre de likes basé sur la table likes
            await pool.query(`UPDATE publications SET nombre_likes = (SELECT COUNT(*) FROM likes WHERE publication_id = ?) WHERE id = ?`, [pubId, pubId]);
        }
        res.json({ ok: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// DELETE /api/publications/:id/like
router.delete('/:id/like', async (req, res) => {
    try {
        const userId = await getUserIdFromSession(req);
        if (!userId)
            return res.status(401).json({ error: 'Non authentifié' });
        const pubId = Number(req.params.id);
        const [del] = await pool.query(`DELETE FROM likes WHERE publication_id = ? AND user_id = ?`, [pubId, userId]);
        if (del.affectedRows > 0) {
            // Recalculer le nombre de likes basé sur la table likes
            await pool.query(`UPDATE publications SET nombre_likes = (SELECT COUNT(*) FROM likes WHERE publication_id = ?) WHERE id = ?`, [pubId, pubId]);
        }
        res.json({ ok: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// GET /api/publications/:id/comments
router.get('/:id/comments', async (req, res) => {
    try {
        const pubId = Number(req.params.id);
        const [rows] = await pool.query(`SELECT c.id, c.contenu, c.created_at, u.prenom AS client_prenom, u.nom AS client_nom, u.photo_profil
         FROM commentaires c
         JOIN users u ON u.id = c.user_id
         WHERE c.publication_id = ?
         ORDER BY c.created_at ASC`, [pubId]);
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// POST /api/publications/:id/comments
router.post('/:id/comments', async (req, res) => {
    try {
        const userId = await getUserIdFromSession(req);
        if (!userId)
            return res.status(401).json({ error: 'Non authentifié' });
        const pubId = Number(req.params.id);
        const { contenu } = req.body;
        if (!contenu)
            return res.status(400).json({ error: 'Le contenu est requis' });
        const [result] = await pool.query('INSERT INTO commentaires (publication_id, user_id, contenu, created_at) VALUES (?, ?, ?, NOW())', [pubId, userId, contenu]);
        const insertId = result.insertId;
        // Retourner le commentaire fraîchement créé avec les infos utilisateur
        const [rows] = await pool.query(`SELECT c.id, c.contenu, c.created_at, u.prenom AS client_prenom, u.nom AS client_nom, u.photo_profil
         FROM commentaires c
         JOIN users u ON u.id = c.user_id
         WHERE c.id = ?`, [insertId]);
        res.status(201).json(rows[0]);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
export default router;
