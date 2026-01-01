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
// GET /api/users/me
router.get('/me', async (req, res) => {
    try {
        const userId = await getUserIdFromSession(req);
        if (!userId)
            return res.status(401).json({ error: 'Non authentifié' });
        const [rows] = await pool.query(`SELECT id, email, nom, prenom, telephone, ville, photo_profil, role_id FROM users WHERE id = ? LIMIT 1`, [userId]);
        res.json({ user: rows[0] || null });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// PUT /api/users/me
router.put('/me', async (req, res) => {
    try {
        const userId = await getUserIdFromSession(req);
        if (!userId)
            return res.status(401).json({ error: 'Non authentifié' });
        const { nom, prenom, telephone, ville, photo_profil } = req.body || {};
        await pool.query(`UPDATE users SET 
         nom = COALESCE(?, nom),
         prenom = COALESCE(?, prenom),
         telephone = COALESCE(?, telephone),
         ville = COALESCE(?, ville),
         photo_profil = COALESCE(?, photo_profil),
         updated_at = NOW()
       WHERE id = ?`, [nom, prenom, telephone, ville, photo_profil, userId]);
        const [rows] = await pool.query(`SELECT id, email, nom, prenom, telephone, ville, photo_profil, role_id FROM users WHERE id = ?`, [userId]);
        res.json({ user: rows[0] });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
export default router;
