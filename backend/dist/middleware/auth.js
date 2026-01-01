import { pool } from '../db.js';
import { verifyToken, extractTokenFromHeader } from '../utils/jwt.js';
export async function getUserIdFromSession(req) {
    // Essayer d'abord JWT
    const jwtUserId = await getUserIdFromJWT(req);
    if (jwtUserId)
        return jwtUserId;
    // Fallback vers les cookies pour la compatibilité
    const token = req.cookies?.session_token;
    if (!token)
        return null;
    try {
        const [rows] = await pool.query('SELECT us.user_id FROM user_sessions us WHERE us.token = ? AND us.expires_at > NOW() LIMIT 1', [token]);
        return rows[0]?.user_id || null;
    }
    catch {
        return null;
    }
}
export async function getUserIdFromJWT(req) {
    try {
        const authHeader = req.headers.authorization;
        const token = extractTokenFromHeader(authHeader);
        if (!token)
            return null;
        const payload = verifyToken(token);
        return payload.userId;
    }
    catch {
        return null;
    }
}
export async function requireAuth(req, res, next) {
    try {
        const userId = await getUserIdFromSession(req);
        if (!userId) {
            return res.status(401).json({ error: 'Non authentifié' });
        }
        // Optionally fetch user details
        const [rows] = await pool.query('SELECT id, email, nom, prenom, telephone, ville, photo_profil, role_id FROM users WHERE id = ? LIMIT 1', [userId]);
        req.userId = userId;
        req.user = rows[0] || null;
        next();
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
}
export async function requirePrestataire(req, res, next) {
    try {
        await requireAuth(req, res, () => { });
        if (!req.userId)
            return;
        const [rows] = await pool.query('SELECT id FROM prestataires WHERE user_id = ? LIMIT 1', [req.userId]);
        if (rows.length === 0) {
            return res.status(403).json({ error: 'Profil prestataire requis' });
        }
        req.prestataireId = rows[0].id;
        next();
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
}
export function requireRole(roleName) {
    return async (req, res, next) => {
        try {
            // S'assurer que l'utilisateur est authentifié
            if (!req.user) {
                return res.status(401).json({ error: 'Non authentifié' });
            }
            // Récupérer le rôle de l'utilisateur
            const [roleRows] = await pool.query('SELECT r.nom FROM roles r WHERE r.id = ?', [req.user.role_id]);
            if (roleRows.length === 0 || roleRows[0].nom !== roleName) {
                return res.status(403).json({
                    error: `Accès refusé. Rôle ${roleName} requis.`
                });
            }
            next();
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    };
}
