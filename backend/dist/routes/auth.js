import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { pool } from '../db.js';
import { validateRegister, validateLogin } from '../utils/validation.js';
import { generateToken } from '../utils/jwt.js';
const router = express.Router();
async function getSessionDurationHours() {
    try {
        const [rows] = await pool.query('SELECT valeur FROM configurations WHERE cle = ? LIMIT 1', ['session_duration_hours']);
        const v = rows?.[0]?.valeur;
        const n = Number(v);
        return Number.isFinite(n) && n > 0 ? n : 24;
    }
    catch {
        return 24;
    }
}
router.post('/register', validateRegister, async (req, res) => {
    try {
        const { email, password, nom, prenom, telephone, role_id = 1, nom_commercial, ville, adresse, latitude, longitude } = req.body || {};
        if (!email || !password || !nom || !prenom) {
            return res.status(400).json({ error: 'Champs requis manquants' });
        }
        // Validation spécifique pour les prestataires
        if (role_id === 2) {
            if (!nom_commercial || !ville || !adresse) {
                return res.status(400).json({ error: 'Les champs nom_commercial, ville et adresse sont requis pour un compte prestataire' });
            }
        }
        const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(409).json({ error: 'Email déjà utilisé' });
        }
        const password_hash = await bcrypt.hash(password, 10);
        const [result] = await pool.query('INSERT INTO users (email, password_hash, role_id, nom, prenom, telephone) VALUES (?, ?, ?, ?, ?, ?)', [email, password_hash, role_id, nom, prenom, telephone || null]);
        const userId = result.insertId;
        // Si c'est un prestataire, créer le profil prestataire
        if (role_id === 2) {
            await pool.query('INSERT INTO prestataires (user_id, nom_commercial, ville, adresse, pays, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?)', [userId, nom_commercial, ville, adresse, 'Côte d\'Ivoire', latitude || null, longitude || null]);
        }
        const [userRows] = await pool.query('SELECT u.id, u.email, u.role_id, u.nom, u.prenom, u.telephone, r.nom AS role_nom FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ? LIMIT 1', [userId]);
        const user = userRows[0];
        const token = crypto.randomBytes(48).toString('hex');
        const hours = await getSessionDurationHours();
        await pool.query('INSERT INTO user_sessions (user_id, token, device_info, ip_address, expires_at) VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR))', [user.id, token, req.headers['user-agent'] || '', req.ip || '', hours]);
        res.cookie('session_token', token, {
            httpOnly: true,
            sameSite: 'lax',
            secure: false,
            maxAge: hours * 60 * 60 * 1000,
            path: '/',
        });
        // Générer aussi un token JWT
        const jwtToken = generateToken({
            userId: user.id,
            email: user.email,
            role_id: user.role_id
        });
        res.json({
            user,
            token: jwtToken // Ajouter le token JWT à la réponse
        });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post('/login', validateLogin, async (req, res) => {
    try {
        const { email, password } = req.body || {};
        if (!email || !password)
            return res.status(400).json({ error: 'Email et mot de passe requis' });
        const [rows] = await pool.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
        const user = rows[0];
        if (!user)
            return res.status(401).json({ error: 'Identifiants invalides' });
        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok)
            return res.status(401).json({ error: 'Identifiants invalides' });
        const [roleRows] = await pool.query('SELECT nom FROM roles WHERE id = ? LIMIT 1', [user.role_id]);
        user.role_nom = roleRows?.[0]?.nom || null;
        const token = crypto.randomBytes(48).toString('hex');
        const hours = await getSessionDurationHours();
        await pool.query('INSERT INTO user_sessions (user_id, token, device_info, ip_address, expires_at) VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR))', [user.id, token, req.headers['user-agent'] || '', req.ip || '', hours]);
        await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
        res.cookie('session_token', token, {
            httpOnly: true,
            sameSite: 'lax',
            secure: false,
            maxAge: hours * 60 * 60 * 1000,
            path: '/',
        });
        const safeUser = {
            id: user.id,
            email: user.email,
            role_id: user.role_id,
            nom: user.nom,
            prenom: user.prenom,
            telephone: user.telephone,
            role_nom: user.role_nom,
        };
        // Générer aussi un token JWT
        const jwtToken = generateToken({
            userId: user.id,
            email: user.email,
            role_id: user.role_id
        });
        res.json({
            user: safeUser,
            token: jwtToken // Ajouter le token JWT à la réponse
        });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get('/me', async (req, res) => {
    try {
        const token = req.cookies?.session_token;
        if (!token)
            return res.status(401).json({ error: 'Non authentifié' });
        const [sessRows] = await pool.query('SELECT us.user_id FROM user_sessions us WHERE us.token = ? AND us.expires_at > NOW() LIMIT 1', [token]);
        const sess = sessRows[0];
        if (!sess)
            return res.status(401).json({ error: 'Session invalide ou expirée' });
        const [rows] = await pool.query('SELECT u.id, u.email, u.role_id, u.nom, u.prenom, u.telephone, r.nom AS role_nom FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ? LIMIT 1', [sess.user_id]);
        const user = rows[0];
        if (!user)
            return res.status(404).json({ error: 'Utilisateur introuvable' });
        res.json({ user });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post('/logout', async (req, res) => {
    try {
        const token = req.cookies?.session_token;
        if (token) {
            await pool.query('DELETE FROM user_sessions WHERE token = ?', [token]);
        }
        res.clearCookie('session_token', { path: '/' });
        res.json({ ok: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
export default router;
