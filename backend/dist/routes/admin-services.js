import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { pool } from '../db.js';
const router = express.Router();
// Middleware d'authentification admin
router.use(requireAuth);
router.use(requireRole('admin'));
// GET /api/admin/services - Récupérer tous les services avec filtres
router.get('/', async (req, res) => {
    try {
        const { status = 'all', search = '', page = 1, limit = 20, prestataire_id, categorie_id } = req.query;
        let whereClause = 'WHERE 1=1';
        const params = [];
        // Filtres
        if (status !== 'all') {
            if (status === 'active') {
                whereClause += ' AND s.is_active = 1';
            }
            else if (status === 'inactive') {
                whereClause += ' AND s.is_active = 0';
            }
        }
        if (search) {
            whereClause += ' AND (s.nom LIKE ? OR s.description LIKE ? OR u.nom LIKE ? OR u.email LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }
        if (prestataire_id) {
            whereClause += ' AND s.prestataire_id = ?';
            params.push(prestataire_id);
        }
        if (categorie_id) {
            whereClause += ' AND sc.categorie_id = ?';
            params.push(categorie_id);
        }
        const offset = (Number(page) - 1) * Number(limit);
        const query = `
      SELECT 
        s.*,
        p.nom_commercial as prestataire_nom,
        u.email as prestataire_email,
        c.nom as categorie_nom,
        sc.nom as sous_categorie_nom,
        COUNT(DISTINCT r.id) as total_reservations,
        COALESCE(AVG(a.note), 0) as moyenne_avis
      FROM services s
      LEFT JOIN prestataires p ON s.prestataire_id = p.id
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN sous_categories sc ON s.sous_categorie_id = sc.id
      LEFT JOIN categories c ON sc.categorie_id = c.id
      LEFT JOIN reservations r ON s.id = r.service_id
      LEFT JOIN avis a ON r.id = a.reservation_id
      ${whereClause}
      GROUP BY s.id
      ORDER BY s.created_at DESC
      LIMIT ? OFFSET ?
    `;
        params.push(Number(limit), offset);
        const [services] = await pool.execute(query, params);
        // Compter le total pour la pagination
        const countQuery = `
      SELECT COUNT(DISTINCT s.id) as total
      FROM services s
      LEFT JOIN users u ON s.prestataire_id = u.id
      LEFT JOIN sous_categories sc ON s.sous_categorie_id = sc.id
      LEFT JOIN categories c ON sc.categorie_id = c.id
      ${whereClause.replace('LIMIT ? OFFSET ?', '')}
    `;
        const [countResult] = await pool.execute(countQuery, params.slice(0, -2));
        const total = countResult[0].total;
        const totalPages = Math.ceil(total / Number(limit));
        res.json({
            services,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages,
                hasNext: Number(page) < totalPages,
                hasPrev: Number(page) > 1
            }
        });
    }
    catch (error) {
        console.error('Erreur récupération services:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
// GET /api/admin/services/:id - Récupérer un service spécifique
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const query = `
      SELECT 
        s.*,
        p.nom_commercial as prestataire_nom,
        u.email as prestataire_email,
        u.telephone as prestataire_telephone,
        c.nom as categorie_nom,
        sc.nom as sous_categorie_nom,
        COUNT(DISTINCT r.id) as total_reservations,
        COUNT(DISTINCT CASE WHEN r.statut = 'terminee' THEN r.id END) as reservations_terminees,
        COALESCE(AVG(a.note), 0) as moyenne_avis,
        COUNT(DISTINCT a.id) as nombre_avis
      FROM services s
      LEFT JOIN prestataires p ON s.prestataire_id = p.id
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN sous_categories sc ON s.sous_categorie_id = sc.id
      LEFT JOIN categories c ON sc.categorie_id = c.id
      LEFT JOIN reservations r ON s.id = r.service_id
      LEFT JOIN avis a ON r.id = a.reservation_id
      WHERE s.id = ?
      GROUP BY s.id
    `;
        const [services] = await pool.execute(query, [id]);
        if (services.length === 0) {
            return res.status(404).json({ error: 'Service non trouvé' });
        }
        res.json(services[0]);
    }
    catch (error) {
        console.error('Erreur récupération service:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
// PUT /api/admin/services/:id/status - Changer le statut d'un service
router.put('/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { is_active, reason } = req.body;
        // Vérifier que le service existe
        const [services] = await pool.execute('SELECT id, prestataire_id FROM services WHERE id = ?', [id]);
        if (services.length === 0) {
            return res.status(404).json({ error: 'Service non trouvé' });
        }
        // Mettre à jour le statut
        await pool.execute('UPDATE services SET is_active = ?, updated_at = NOW() WHERE id = ?', [is_active, id]);
        // Log de l'action admin
        await pool.execute(`INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, created_at) 
       VALUES (?, ?, 'service', ?, ?, NOW())`, [
            req.user.id,
            is_active ? 'service_activated' : 'service_suspended',
            id,
            JSON.stringify({ reason })
        ]);
        // Notifier le prestataire si suspendu
        if (!is_active) {
            await pool.execute(`INSERT INTO notifications (user_id, type, title, message, data, created_at)
         VALUES (?, 'service_suspended', 'Service suspendu', ?, ?, NOW())`, [
                services[0].prestataire_id,
                `Votre service a été suspendu. Raison: ${reason || 'Non spécifiée'}`,
                JSON.stringify({ service_id: id, reason })
            ]);
        }
        res.json({
            success: true,
            message: is_active ? 'Service activé' : 'Service suspendu'
        });
    }
    catch (error) {
        console.error('Erreur changement statut service:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
// DELETE /api/admin/services/:id - Supprimer un service
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        // Vérifier que le service existe et récupérer les infos
        const [services] = await pool.execute('SELECT id, prestataire_id, nom FROM services WHERE id = ?', [id]);
        if (services.length === 0) {
            return res.status(404).json({ error: 'Service non trouvé' });
        }
        const service = services[0];
        // Vérifier s'il y a des réservations actives
        const [activeReservations] = await pool.execute(`SELECT COUNT(*) as count FROM reservations 
       WHERE service_id = ? AND statut IN ('en_attente', 'confirmee')`, [id]);
        if (activeReservations[0].count > 0) {
            return res.status(400).json({
                error: 'Impossible de supprimer un service avec des réservations actives'
            });
        }
        // Supprimer le service (soft delete)
        await pool.execute('UPDATE services SET deleted_at = NOW() WHERE id = ?', [id]);
        // Log de l'action admin
        await pool.execute(`INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, created_at) 
       VALUES (?, 'service_deleted', 'service', ?, ?, NOW())`, [
            req.user.id,
            id,
            JSON.stringify({ service_name: service.nom, reason })
        ]);
        // Notifier le prestataire
        await pool.execute(`INSERT INTO notifications (user_id, type, title, message, data, created_at)
       VALUES (?, 'service_deleted', 'Service supprimé', ?, ?, NOW())`, [
            service.prestataire_id,
            `Votre service "${service.nom}" a été supprimé. Raison: ${reason || 'Non spécifiée'}`,
            JSON.stringify({ service_id: id, service_name: service.nom, reason })
        ]);
        res.json({ success: true, message: 'Service supprimé' });
    }
    catch (error) {
        console.error('Erreur suppression service:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
// GET /api/admin/services/stats - Statistiques des services
router.get('/stats/overview', async (req, res) => {
    try {
        const [stats] = await pool.execute(`
      SELECT 
        COUNT(*) as total_services,
        COUNT(CASE WHEN is_active = 1 THEN 1 END) as services_actifs,
        COUNT(CASE WHEN is_active = 0 THEN 1 END) as services_suspendus,
        COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as nouveaux_ce_mois,
        AVG(prix) as prix_moyen
      FROM services 
      WHERE deleted_at IS NULL
    `);
        const [topCategories] = await pool.execute(`
      SELECT 
        c.nom as categorie,
        COUNT(s.id) as nombre_services
      FROM categories c
      LEFT JOIN sous_categories sc ON c.id = sc.categorie_id
      LEFT JOIN services s ON sc.id = s.sous_categorie_id AND s.deleted_at IS NULL
      GROUP BY c.id, c.nom
      ORDER BY nombre_services DESC
      LIMIT 5
    `);
        const [topPrestataires] = await pool.execute(`
      SELECT 
        p.nom_commercial as prestataire,
        u.email,
        COUNT(s.id) as nombre_services,
        AVG(COALESCE(avis_avg.moyenne, 0)) as moyenne_avis
      FROM prestataires p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN services s ON p.id = s.prestataire_id AND s.deleted_at IS NULL
      LEFT JOIN (
        SELECT 
          s.prestataire_id,
          AVG(a.note) as moyenne
        FROM services s
        LEFT JOIN reservations r ON s.id = r.service_id
        LEFT JOIN avis a ON r.id = a.reservation_id
        WHERE s.deleted_at IS NULL
        GROUP BY s.prestataire_id
      ) avis_avg ON p.id = avis_avg.prestataire_id
      WHERE u.role_id = 2
      GROUP BY p.id, u.id
      HAVING nombre_services > 0
      ORDER BY nombre_services DESC, moyenne_avis DESC
      LIMIT 10
    `);
        res.json({
            overview: stats[0],
            topCategories,
            topPrestataires
        });
    }
    catch (error) {
        console.error('Erreur statistiques services:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
export default router;
