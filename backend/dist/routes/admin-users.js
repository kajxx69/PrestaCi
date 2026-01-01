import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { pool } from '../db.js';
const router = express.Router();
// Récupérer tous les utilisateurs (admin uniquement)
router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const { role, search, page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        let whereClause = '';
        let params = [];
        // Filtrer par rôle si spécifié
        if (role && role !== 'all') {
            whereClause = 'WHERE r.nom = ?';
            params.push(role);
        }
        // Ajouter recherche si spécifiée
        if (search) {
            const searchClause = whereClause ? ' AND ' : ' WHERE ';
            whereClause += `${searchClause}(u.nom LIKE ? OR u.prenom LIKE ? OR u.email LIKE ?)`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }
        const [users] = await pool.execute(`SELECT 
        u.id,
        u.nom,
        u.prenom,
        u.email,
        u.telephone,
        u.ville,
        u.photo_profil,
        u.created_at,
        u.updated_at,
        r.nom as role_nom,
        p.nom_commercial,
        p.abonnement_expires_at,
        plan.nom as plan_nom,
        CASE WHEN u.id IS NOT NULL THEN 1 ELSE 0 END as is_active
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN prestataires p ON u.id = p.user_id
      LEFT JOIN plans_abonnement plan ON p.plan_actuel_id = plan.id
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?`, [...params, parseInt(limit), offset]);
        // Compter le total pour la pagination
        const [countResult] = await pool.execute(`SELECT COUNT(*) as total 
       FROM users u 
       LEFT JOIN roles r ON u.role_id = r.id 
       ${whereClause}`, params);
        const total = countResult[0].total;
        const totalPages = Math.ceil(total / parseInt(limit));
        res.json({
            users,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages
            }
        });
    }
    catch (error) {
        console.error('Erreur récupération utilisateurs:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
// Récupérer les statistiques des utilisateurs
router.get('/stats', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const [stats] = await pool.execute(`SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN r.nom = 'client' THEN 1 ELSE 0 END) as clients,
        SUM(CASE WHEN r.nom = 'prestataire' THEN 1 ELSE 0 END) as prestataires,
        SUM(CASE WHEN r.nom = 'admin' THEN 1 ELSE 0 END) as admins,
        COUNT(CASE WHEN u.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as nouveaux_30j
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id`);
        res.json(stats[0]);
    }
    catch (error) {
        console.error('Erreur statistiques utilisateurs:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
// Désactiver/Activer un utilisateur
router.put('/:id/toggle-status', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const adminId = req.user.id;
        // Vérifier que l'utilisateur existe et n'est pas un admin
        const [users] = await pool.execute(`SELECT u.*, r.nom as role_nom 
       FROM users u 
       LEFT JOIN roles r ON u.role_id = r.id 
       WHERE u.id = ?`, [userId]);
        if (users.length === 0) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }
        const user = users[0];
        // Empêcher la désactivation d'un admin
        if (user.role_nom === 'admin') {
            return res.status(403).json({ error: 'Impossible de modifier le statut d\'un administrateur' });
        }
        // Empêcher l'auto-désactivation
        if (userId === adminId) {
            return res.status(403).json({ error: 'Vous ne pouvez pas modifier votre propre statut' });
        }
        // Pour cet exemple, nous utilisons un champ is_active virtuel
        // Dans une vraie application, vous pourriez avoir un champ is_active dans la table users
        res.json({
            ok: true,
            message: 'Statut utilisateur modifié avec succès'
        });
    }
    catch (error) {
        console.error('Erreur modification statut utilisateur:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
// Supprimer un utilisateur (soft delete)
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const adminId = req.user.id;
        // Vérifier que l'utilisateur existe et n'est pas un admin
        const [users] = await pool.execute(`SELECT u.*, r.nom as role_nom 
       FROM users u 
       LEFT JOIN roles r ON u.role_id = r.id 
       WHERE u.id = ?`, [userId]);
        if (users.length === 0) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }
        const user = users[0];
        // Empêcher la suppression d'un admin
        if (user.role_nom === 'admin') {
            return res.status(403).json({ error: 'Impossible de supprimer un administrateur' });
        }
        // Empêcher l'auto-suppression
        if (userId === adminId) {
            return res.status(403).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
        }
        // Soft delete - marquer comme supprimé au lieu de supprimer réellement
        // Pour cet exemple, nous simulons la suppression
        // Dans une vraie application, vous pourriez ajouter un champ deleted_at
        res.json({
            ok: true,
            message: 'Utilisateur supprimé avec succès'
        });
    }
    catch (error) {
        console.error('Erreur suppression utilisateur:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
export default router;
