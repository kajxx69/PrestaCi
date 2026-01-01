import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
const router = Router();
// Middleware pour vérifier les droits admin
async function requireAdmin(req, res, next) {
    try {
        await requireAuth(req, res, () => { });
        if (!req.userId)
            return;
        // Vérifier que l'utilisateur est admin (role_id = 3)
        const [rows] = await pool.query('SELECT role_id FROM users WHERE id = ? LIMIT 1', [req.userId]);
        if (rows.length === 0 || rows[0].role_id !== 3) {
            return res.status(403).json({ error: 'Accès administrateur requis' });
        }
        next();
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
}
// GET /api/admin/settings - Récupérer tous les paramètres
router.get('/settings', requireAdmin, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT cle, valeur, description FROM app_settings ORDER BY cle');
        // Convertir en objet pour faciliter l'utilisation
        const settings = {};
        rows.forEach((row) => {
            let value = row.valeur;
            // Essayer de parser les valeurs JSON
            try {
                value = JSON.parse(row.valeur);
            }
            catch {
                // Garder la valeur string si ce n'est pas du JSON
            }
            settings[row.cle] = {
                value,
                description: row.description
            };
        });
        res.json(settings);
    }
    catch (e) {
        console.error('Erreur récupération paramètres:', e);
        res.status(500).json({ error: e.message });
    }
});
// PUT /api/admin/settings - Mettre à jour un paramètre
router.put('/settings/:key', requireAdmin, async (req, res) => {
    try {
        const { key } = req.params;
        const { value, description } = req.body;
        if (!key || value === undefined) {
            return res.status(400).json({ error: 'Clé et valeur requises' });
        }
        // Convertir la valeur en string pour le stockage
        const valueString = typeof value === 'string' ? value : JSON.stringify(value);
        // Vérifier si le paramètre existe
        const [existingRows] = await pool.query('SELECT id FROM app_settings WHERE cle = ? LIMIT 1', [key]);
        if (existingRows.length > 0) {
            // Mettre à jour
            await pool.query('UPDATE app_settings SET valeur = ?, description = COALESCE(?, description), updated_at = NOW() WHERE cle = ?', [valueString, description, key]);
        }
        else {
            // Créer
            await pool.query('INSERT INTO app_settings (cle, valeur, description, updated_at) VALUES (?, ?, ?, NOW())', [key, valueString, description || '']);
        }
        res.json({ ok: true, message: 'Paramètre mis à jour' });
    }
    catch (e) {
        console.error('Erreur mise à jour paramètre:', e);
        res.status(500).json({ error: e.message });
    }
});
// DELETE /api/admin/settings/:key - Supprimer un paramètre
router.delete('/settings/:key', requireAdmin, async (req, res) => {
    try {
        const { key } = req.params;
        const [result] = await pool.query('DELETE FROM app_settings WHERE cle = ?', [key]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Paramètre introuvable' });
        }
        res.json({ ok: true, message: 'Paramètre supprimé' });
    }
    catch (e) {
        console.error('Erreur suppression paramètre:', e);
        res.status(500).json({ error: e.message });
    }
});
// POST /api/admin/settings/reset - Réinitialiser aux valeurs par défaut
router.post('/settings/reset', requireAdmin, async (req, res) => {
    try {
        // Paramètres par défaut
        const defaultSettings = [
            { cle: 'session_duration_hours', valeur: '24', description: 'Durée des sessions en heures' },
            { cle: 'maintenance_mode', valeur: 'false', description: 'Mode maintenance activé' },
            { cle: 'max_file_size_mb', valeur: '10', description: 'Taille maximale des fichiers en MB' },
            { cle: 'notifications_enabled', valeur: 'true', description: 'Notifications activées' },
            { cle: 'default_currency', valeur: 'XOF', description: 'Devise par défaut' },
            { cle: 'max_services_free', valeur: '2', description: 'Nombre max de services gratuits' },
            { cle: 'app_version', valeur: '1.0.0', description: 'Version de l\'application' },
            { cle: 'terms_version', valeur: '1.0', description: 'Version des conditions d\'utilisation' }
        ];
        // Supprimer tous les paramètres existants
        await pool.query('DELETE FROM app_settings');
        // Insérer les paramètres par défaut
        for (const setting of defaultSettings) {
            await pool.query('INSERT INTO app_settings (cle, valeur, description, updated_at) VALUES (?, ?, ?, NOW())', [setting.cle, setting.valeur, setting.description]);
        }
        res.json({
            ok: true,
            message: 'Paramètres réinitialisés',
            count: defaultSettings.length
        });
    }
    catch (e) {
        console.error('Erreur réinitialisation paramètres:', e);
        res.status(500).json({ error: e.message });
    }
});
// GET /api/admin/stats - Statistiques générales de l'application
router.get('/stats', requireAdmin, async (req, res) => {
    try {
        const [userStats] = await pool.query(`
      SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN role_id = 1 THEN 1 ELSE 0 END) as clients,
        SUM(CASE WHEN role_id = 2 THEN 1 ELSE 0 END) as prestataires,
        SUM(CASE WHEN role_id = 3 THEN 1 ELSE 0 END) as admins
      FROM users
    `);
        const [serviceStats] = await pool.query(`
      SELECT 
        COUNT(*) as total_services,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as services_actifs
      FROM services
    `);
        const [reservationStats] = await pool.query(`
      SELECT 
        COUNT(*) as total_reservations,
        SUM(CASE WHEN statut_id = 2 THEN 1 ELSE 0 END) as confirmees,
        SUM(CASE WHEN statut_id = 1 THEN 1 ELSE 0 END) as en_attente
      FROM reservations
    `);
        const [notificationStats] = await pool.query(`
      SELECT 
        COUNT(*) as total_notifications,
        SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as non_lues
      FROM notifications
    `);
        res.json({
            users: userStats[0],
            services: serviceStats[0],
            reservations: reservationStats[0],
            notifications: notificationStats[0],
            generated_at: new Date().toISOString()
        });
    }
    catch (e) {
        console.error('Erreur statistiques admin:', e);
        res.status(500).json({ error: e.message });
    }
});
export default router;
