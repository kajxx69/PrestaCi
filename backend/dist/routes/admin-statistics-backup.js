import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { pool } from '../db.js';
const router = express.Router();
// Middleware d'authentification admin
router.use(requireAuth);
router.use(requireRole('admin'));
// GET /api/admin/statistics/overview - Vue d'ensemble des statistiques
router.get('/overview', async (req, res) => {
    try {
        const { period = '30d' } = req.query;
        let dateFilter = '';
        switch (period) {
            case '7d':
                dateFilter = 'DATE_SUB(NOW(), INTERVAL 7 DAY)';
                break;
            case '30d':
                dateFilter = 'DATE_SUB(NOW(), INTERVAL 30 DAY)';
                break;
            case '90d':
                dateFilter = 'DATE_SUB(NOW(), INTERVAL 90 DAY)';
                break;
            case '1y':
                dateFilter = 'DATE_SUB(NOW(), INTERVAL 1 YEAR)';
                break;
            default:
                dateFilter = 'DATE_SUB(NOW(), INTERVAL 30 DAY)';
        }
        // Statistiques générales
        const [generalStats] = await pool.execute(`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE role_id = 1) as total_clients,
        (SELECT COUNT(*) FROM users WHERE role_id = 2) as total_prestataires,
        (SELECT COUNT(*) FROM services WHERE deleted_at IS NULL) as total_services,
        (SELECT COUNT(*) FROM reservations) as total_reservations,
        (SELECT COUNT(*) FROM reservations WHERE statut_id = 4) as reservations_terminees,
        (SELECT SUM(prix_final) FROM reservations WHERE statut_id = 4) as revenus_totaux,
        (SELECT AVG(note) FROM avis WHERE is_moderated = 1 AND is_approved = 1) as note_moyenne_globale,
        (SELECT COUNT(*) FROM avis WHERE is_moderated = 1 AND is_approved = 1) as total_avis_approuves
    `);
        // Statistiques de croissance
        const [growthStats] = await pool.execute(`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE created_at >= ${dateFilter}) as nouveaux_utilisateurs,
        (SELECT COUNT(*) FROM services WHERE created_at >= ${dateFilter} AND deleted_at IS NULL) as nouveaux_services,
        (SELECT COUNT(*) FROM reservations WHERE created_at >= ${dateFilter}) as nouvelles_reservations,
        (SELECT SUM(prix_final) FROM reservations WHERE created_at >= ${dateFilter} AND statut_id = 4) as revenus_periode,
        (SELECT COUNT(*) FROM avis WHERE created_at >= ${dateFilter}) as nouveaux_avis
    `);
        // Taux de conversion
        const [conversionStats] = await pool.execute(`
      SELECT 
        ROUND(
          (SELECT COUNT(*) FROM reservations WHERE statut_id = 4) * 100.0 / 
          NULLIF((SELECT COUNT(*) FROM reservations), 0), 2
        ) as taux_completion_reservations,
        ROUND(
          (SELECT COUNT(*) FROM users WHERE role_id = 2 AND created_at >= ${dateFilter}) * 100.0 / 
          NULLIF((SELECT COUNT(*) FROM users WHERE created_at >= ${dateFilter}), 0), 2
        ) as taux_conversion_prestataire,
        ROUND(
          (SELECT COUNT(*) FROM avis WHERE is_moderated = 1 AND is_approved = 1) * 100.0 / 
          NULLIF((SELECT COUNT(*) FROM reservations WHERE statut_id = 4), 0), 2
        ) as taux_avis_laisses
    `);
        // Données pour les graphiques
        const [revenueByMonth] = await pool.execute(`
      SELECT 
        DATE_FORMAT(created_at, '%b') as month,
        SUM(prix_final) as revenue
      FROM reservations
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH) 
        AND statut_id = 4
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY created_at DESC
      LIMIT 6
    `);
        // Nouveaux utilisateurs
        const [newUsersStats] = await pool.execute(`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE DATE(created_at) = CURDATE()) as new_users_today,
        (SELECT COUNT(*) FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) as new_users_week,
        (SELECT COUNT(*) FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) as new_users_month
    `);
        res.json({
            general: generalStats[0],
            growth: growthStats[0],
            conversion: conversionStats[0],
            charts: {
                revenue_by_month: revenueByMonth.reverse(),
                new_users_today: newUsersStats[0].new_users_today,
                new_users_week: newUsersStats[0].new_users_week,
                new_users_month: newUsersStats[0].new_users_month
            },
            period
        });
    }
    catch (error) {
        console.error('Erreur statistiques overview:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
// GET /api/admin/statistics/revenue - Statistiques de revenus
router.get('/revenue', async (req, res) => {
    try {
        const { period = '30d', group_by = 'day' } = req.query;
        let dateFilter = '';
        let groupByClause = '';
        switch (period) {
            case '7d':
                dateFilter = 'DATE_SUB(NOW(), INTERVAL 7 DAY)';
                groupByClause = 'DATE(created_at)';
                break;
            case '30d':
                dateFilter = 'DATE_SUB(NOW(), INTERVAL 30 DAY)';
                groupByClause = group_by === 'week' ? 'YEARWEEK(created_at)' : 'DATE(created_at)';
                break;
            case '90d':
                dateFilter = 'DATE_SUB(NOW(), INTERVAL 90 DAY)';
                groupByClause = 'YEARWEEK(created_at)';
                break;
            case '1y':
                dateFilter = 'DATE_SUB(NOW(), INTERVAL 1 YEAR)';
                groupByClause = 'DATE_FORMAT(created_at, "%Y-%m")';
                break;
            default:
                dateFilter = 'DATE_SUB(NOW(), INTERVAL 30 DAY)';
                groupByClause = 'DATE(created_at)';
        }
        // Revenus par période
        const query = `
      SELECT 
        ${groupByClause} as periode,
        COUNT(*) as nombre_reservations,
        SUM(prix_final) as revenus_totaux,
        AVG(prix_final) as panier_moyen,
        COUNT(DISTINCT client_id) as clients_uniques,
        COUNT(DISTINCT prestataire_id) as prestataires_actifs
      FROM reservations
      WHERE created_at >= ${dateFilter} AND statut_id = 4
      GROUP BY periode
      ORDER BY periode DESC
    `;
        const [revenueByPeriod] = await pool.execute(query);
        // Revenus par catégorie
        const categoryQuery = `
      SELECT 
        c.nom as categorie,
        COUNT(r.id) as nombre_reservations,
        SUM(r.prix_final) as revenus_totaux,
        AVG(r.prix_final) as panier_moyen,
        ROUND(SUM(r.prix_final) * 100.0 / (
          SELECT SUM(prix_final) FROM reservations 
          WHERE created_at >= ${dateFilter} AND statut_id = 4
        ), 2) as pourcentage_revenus
      FROM categories c
      LEFT JOIN sous_categories sc ON c.id = sc.categorie_id
      LEFT JOIN services s ON sc.id = s.sous_categorie_id
      LEFT JOIN reservations r ON s.id = r.service_id 
        AND r.created_at >= ${dateFilter} 
        AND r.statut_id = 4
      GROUP BY c.id, c.nom
      HAVING revenus_totaux > 0
      ORDER BY revenus_totaux DESC
    `;
        const [revenueByCategory] = await pool.execute(categoryQuery);
        // Top prestataires par revenus
        const topProvidersQuery = `
      SELECT 
        u.nom as prestataire_nom,
        u.email as prestataire_email,
        COUNT(r.id) as nombre_reservations,
        SUM(r.prix_final) as revenus_totaux,
        AVG(r.prix_final) as panier_moyen,
        AVG(a.note) as note_moyenne
      FROM users u
      LEFT JOIN reservations r ON u.id = r.prestataire_id 
        AND r.created_at >= ${dateFilter} 
        AND r.statut_id = 4
      LEFT JOIN avis a ON r.id = a.reservation_id 
        AND a.is_moderated = 1 
        AND a.is_approved = 1
      WHERE u.role_id = 2
      GROUP BY u.id
      HAVING revenus_totaux > 0
      ORDER BY revenus_totaux DESC
      LIMIT 20
    `;
        const [topProviders] = await pool.execute(topProvidersQuery);
        res.json({
            revenueByPeriod,
            revenueByCategory,
            topProviders,
            period,
            group_by
        });
    }
    catch (error) {
        console.error('Erreur statistiques revenus:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
// GET /api/admin/statistics/users - Statistiques des utilisateurs
router.get('/users', async (req, res) => {
    try {
        const { period = '30d' } = req.query;
        let dateFilter = '';
        switch (period) {
            case '7d':
                dateFilter = 'DATE_SUB(NOW(), INTERVAL 7 DAY)';
                break;
            case '30d':
                dateFilter = 'DATE_SUB(NOW(), INTERVAL 30 DAY)';
                break;
            case '90d':
                dateFilter = 'DATE_SUB(NOW(), INTERVAL 90 DAY)';
                break;
            case '1y':
                dateFilter = 'DATE_SUB(NOW(), INTERVAL 1 YEAR)';
                break;
            default:
                dateFilter = 'DATE_SUB(NOW(), INTERVAL 30 DAY)';
        }
        // Inscriptions par jour
        const [registrationsByDay] = await pool.execute(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as total_inscriptions,
        COUNT(CASE WHEN role_id = 1 THEN 1 END) as clients,
        COUNT(CASE WHEN role_id = 2 THEN 1 END) as prestataires,
        COUNT(CASE WHEN role_id = 3 THEN 1 END) as admins
      FROM users
      WHERE created_at >= ${dateFilter}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);
        // Utilisateurs actifs
        const [activeUsers] = await pool.execute(`
      SELECT 
        COUNT(DISTINCT CASE WHEN last_login >= DATE_SUB(NOW(), INTERVAL 1 DAY) THEN id END) as actifs_24h,
        COUNT(DISTINCT CASE WHEN last_login >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN id END) as actifs_7j,
        COUNT(DISTINCT CASE WHEN last_login >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN id END) as actifs_30j,
        COUNT(DISTINCT CASE WHEN last_login IS NULL THEN id END) as jamais_connectes
      FROM users
      WHERE created_at >= ${dateFilter}
    `);
        // Répartition géographique (si vous avez des données de localisation)
        const [geographicDistribution] = await pool.execute(`
      SELECT 
        COALESCE(ville, 'Non spécifié') as ville,
        COUNT(*) as nombre_utilisateurs,
        COUNT(CASE WHEN role_id = 1 THEN 1 END) as clients,
        COUNT(CASE WHEN role_id = 2 THEN 1 END) as prestataires
      FROM users
      WHERE created_at >= ${dateFilter}
      GROUP BY ville
      ORDER BY nombre_utilisateurs DESC
      LIMIT 20
    `);
        // Clients les plus actifs
        const [topClients] = await pool.execute(`
      SELECT 
        u.nom as client_nom,
        u.email as client_email,
        u.created_at as date_inscription,
        COUNT(r.id) as nombre_reservations,
        SUM(r.prix_final) as total_depense,
        AVG(a.note) as note_moyenne_donnee,
        MAX(r.created_at) as derniere_reservation
      FROM users u
      LEFT JOIN reservations r ON u.id = r.client_id
      LEFT JOIN avis a ON r.id = a.reservation_id
      WHERE u.role_id = 1 AND u.created_at >= ${dateFilter}
      GROUP BY u.id
      ORDER BY total_depense DESC
      LIMIT 20
    `);
        res.json({
            registrationsByDay,
            activeUsers: activeUsers[0],
            geographicDistribution,
            topClients,
            period
        });
    }
    catch (error) {
        console.error('Erreur statistiques utilisateurs:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
// GET /api/admin/statistics/services - Statistiques des services
router.get('/services', async (req, res) => {
    try {
        const { period = '30d' } = req.query;
        let dateFilter = '';
        switch (period) {
            case '7d':
                dateFilter = 'DATE_SUB(NOW(), INTERVAL 7 DAY)';
                break;
            case '30d':
                dateFilter = 'DATE_SUB(NOW(), INTERVAL 30 DAY)';
                break;
            case '90d':
                dateFilter = 'DATE_SUB(NOW(), INTERVAL 90 DAY)';
                break;
            case '1y':
                dateFilter = 'DATE_SUB(NOW(), INTERVAL 1 YEAR)';
                break;
            default:
                dateFilter = 'DATE_SUB(NOW(), INTERVAL 30 DAY)';
        }
        // Services les plus populaires
        const [popularServices] = await pool.execute(`
      SELECT 
        s.nom as service_nom,
        u.nom as prestataire_nom,
        c.nom as categorie_nom,
        COUNT(r.id) as nombre_reservations,
        SUM(CASE WHEN r.statut_id = 4 THEN r.prix_final ELSE 0 END) as revenus_totaux,
        AVG(CASE WHEN r.statut_id = 4 THEN r.prix_final END) as prix_moyen,
        AVG(a.note) as note_moyenne,
        COUNT(a.id) as nombre_avis,
        s.prix as prix_affiche,
        s.created_at as date_creation
      FROM services s
      LEFT JOIN users u ON s.prestataire_id = u.id
      LEFT JOIN sous_categories sc ON s.sous_categorie_id = sc.id
      LEFT JOIN categories c ON sc.categorie_id = c.id
      LEFT JOIN reservations r ON s.id = r.service_id AND r.created_at >= ${dateFilter}
      LEFT JOIN avis a ON r.id = a.reservation_id AND a.is_moderated = 1 AND a.is_approved = 1
      WHERE s.deleted_at IS NULL
      GROUP BY s.id
      ORDER BY nombre_reservations DESC
      LIMIT 20
    `);
        // Répartition par catégorie
        const [categoryDistribution] = await pool.execute(`
      SELECT 
        c.nom as categorie,
        COUNT(DISTINCT s.id) as nombre_services,
        COUNT(r.id) as nombre_reservations,
        SUM(CASE WHEN r.statut_id = 4 THEN r.prix_final ELSE 0 END) as revenus_totaux,
        AVG(s.prix) as prix_moyen_services,
        AVG(a.note) as note_moyenne_categorie
      FROM categories c
      LEFT JOIN sous_categories sc ON c.id = sc.categorie_id
      LEFT JOIN services s ON sc.id = s.sous_categorie_id AND s.deleted_at IS NULL
      LEFT JOIN reservations r ON s.id = r.service_id AND r.created_at >= ${dateFilter}
      LEFT JOIN avis a ON r.id = a.reservation_id AND a.is_moderated = 1 AND a.is_approved = 1
      GROUP BY c.id, c.nom
      ORDER BY nombre_services DESC
    `);
        // Analyse des prix
        const [priceAnalysis] = await pool.execute(`
      SELECT 
        c.nom as categorie,
        MIN(s.prix) as prix_min,
        MAX(s.prix) as prix_max,
        AVG(s.prix) as prix_moyen,
        STDDEV(s.prix) as ecart_type_prix,
        COUNT(s.id) as nombre_services
      FROM categories c
      LEFT JOIN sous_categories sc ON c.id = sc.categorie_id
      LEFT JOIN services s ON sc.id = s.sous_categorie_id AND s.deleted_at IS NULL
      GROUP BY c.id, c.nom
      HAVING nombre_services > 0
      ORDER BY prix_moyen DESC
    `);
        // Services récemment créés
        const [recentServices] = await pool.execute(`
      SELECT 
        s.nom as service_nom,
        u.nom as prestataire_nom,
        c.nom as categorie_nom,
        s.prix,
        s.created_at,
        COUNT(r.id) as reservations_deja,
        s.is_active
      FROM services s
      LEFT JOIN users u ON s.prestataire_id = u.id
      LEFT JOIN sous_categories sc ON s.sous_categorie_id = sc.id
      LEFT JOIN categories c ON sc.categorie_id = c.id
      LEFT JOIN reservations r ON s.id = r.service_id
      WHERE s.created_at >= ${dateFilter} AND s.deleted_at IS NULL
      GROUP BY s.id
      ORDER BY s.created_at DESC
      LIMIT 20
    `);
        res.json({
            popularServices,
            categoryDistribution,
            priceAnalysis,
            recentServices,
            period
        });
    }
    catch (error) {
        console.error('Erreur statistiques services:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
// GET /api/admin/statistics/performance - Métriques de performance
router.get('/performance', async (req, res) => {
    try {
        const { period = '30d' } = req.query;
        let dateFilter = '';
        switch (period) {
            case '7d':
                dateFilter = 'DATE_SUB(NOW(), INTERVAL 7 DAY)';
                break;
            case '30d':
                dateFilter = 'DATE_SUB(NOW(), INTERVAL 30 DAY)';
                break;
            case '90d':
                dateFilter = 'DATE_SUB(NOW(), INTERVAL 90 DAY)';
                break;
            case '1y':
                dateFilter = 'DATE_SUB(NOW(), INTERVAL 1 YEAR)';
                break;
            default:
                dateFilter = 'DATE_SUB(NOW(), INTERVAL 30 DAY)';
        }
        // Métriques de conversion
        const [conversionMetrics] = await pool.execute(`
      SELECT 
        -- Taux de conversion inscription -> première réservation
        ROUND(
          (SELECT COUNT(DISTINCT client_id) FROM reservations WHERE created_at >= ${dateFilter}) * 100.0 /
          NULLIF((SELECT COUNT(*) FROM users WHERE role_id = 1 AND created_at >= ${dateFilter}), 0), 2
        ) as taux_conversion_premiere_reservation,
        
        -- Taux de complétion des réservations
        ROUND(
          (SELECT COUNT(*) FROM reservations WHERE statut_id = 4 AND created_at >= ${dateFilter}) * 100.0 /
          NULLIF((SELECT COUNT(*) FROM reservations WHERE created_at >= ${dateFilter}), 0), 2
        ) as taux_completion_reservations,
        
        -- Taux d'annulation
        ROUND(
          (SELECT COUNT(*) FROM reservations WHERE statut = 'annulee' AND created_at >= ${dateFilter}) * 100.0 /
          NULLIF((SELECT COUNT(*) FROM reservations WHERE created_at >= ${dateFilter}), 0), 2
        ) as taux_annulation,
        
        -- Taux de satisfaction (avis >= 4 étoiles)
        ROUND(
          (SELECT COUNT(*) FROM avis WHERE note >= 4 AND created_at >= ${dateFilter} AND is_moderated = 1 AND is_approved = 1) * 100.0 /
          NULLIF((SELECT COUNT(*) FROM avis WHERE created_at >= ${dateFilter} AND is_moderated = 1 AND is_approved = 1), 0), 2
        ) as taux_satisfaction,
        
        -- Temps moyen entre inscription et première réservation (en jours)
        ROUND(AVG(DATEDIFF(r.created_at, u.created_at)), 1) as jours_moyenne_premiere_reservation
        
      FROM users u
      LEFT JOIN reservations r ON u.id = r.client_id
      WHERE u.role_id = 1 AND u.created_at >= ${dateFilter}
        AND r.id = (SELECT MIN(id) FROM reservations WHERE client_id = u.id)
    `);
        // Analyse de rétention
        const [retentionAnalysis] = await pool.execute(`
      SELECT 
        'Clients avec 1 réservation' as segment,
        COUNT(*) as nombre_clients
      FROM (
        SELECT client_id, COUNT(*) as reservations_count
        FROM reservations 
        WHERE created_at >= ${dateFilter}
        GROUP BY client_id
        HAVING reservations_count = 1
      ) t1
      
      UNION ALL
      
      SELECT 
        'Clients avec 2-5 réservations' as segment,
        COUNT(*) as nombre_clients
      FROM (
        SELECT client_id, COUNT(*) as reservations_count
        FROM reservations 
        WHERE created_at >= ${dateFilter}
        GROUP BY client_id
        HAVING reservations_count BETWEEN 2 AND 5
      ) t2
      
      UNION ALL
      
      SELECT 
        'Clients avec 6+ réservations' as segment,
        COUNT(*) as nombre_clients
      FROM (
        SELECT client_id, COUNT(*) as reservations_count
        FROM reservations 
        WHERE created_at >= ${dateFilter}
        GROUP BY client_id
        HAVING reservations_count >= 6
      ) t3
    `);
        // Analyse temporelle des réservations
        const [timeAnalysis] = await pool.execute(`
      SELECT 
        HOUR(created_at) as heure,
        COUNT(*) as nombre_reservations,
        AVG(prix_final) as panier_moyen
      FROM reservations
      WHERE created_at >= ${dateFilter}
      GROUP BY HOUR(created_at)
      ORDER BY heure
    `);
        // Délai moyen de confirmation par les prestataires
        const [confirmationDelays] = await pool.execute(`
      SELECT 
        AVG(TIMESTAMPDIFF(HOUR, created_at, updated_at)) as heures_moyenne_confirmation,
        COUNT(CASE WHEN TIMESTAMPDIFF(HOUR, created_at, updated_at) <= 2 THEN 1 END) as confirmations_rapides_2h,
        COUNT(CASE WHEN TIMESTAMPDIFF(HOUR, created_at, updated_at) <= 24 THEN 1 END) as confirmations_24h,
        COUNT(*) as total_confirmations
      FROM reservations
      WHERE statut = 'confirmee' 
        AND created_at >= ${dateFilter}
        AND updated_at > created_at
    `);
        res.json({
            conversionMetrics: conversionMetrics[0],
            retentionAnalysis,
            timeAnalysis,
            confirmationDelays: confirmationDelays[0],
            period
        });
    }
    catch (error) {
        console.error('Erreur métriques performance:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
// GET /api/admin/statistics/export - Exporter les statistiques
router.get('/export', async (req, res) => {
    try {
        const { type = 'overview', period = '30d', format = 'json' } = req.query;
        let data = {};
        switch (type) {
            case 'overview':
                // Réutiliser la logique de /overview
                break;
            case 'revenue':
                // Réutiliser la logique de /revenue
                break;
            case 'users':
                // Réutiliser la logique de /users
                break;
            case 'services':
                // Réutiliser la logique de /services
                break;
            case 'performance':
                // Réutiliser la logique de /performance
                break;
            default:
                return res.status(400).json({ error: 'Type d\'export invalide' });
        }
        // Log de l'action admin
        await pool.execute(`INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, created_at) 
       VALUES (?, 'statistics_exported', 'statistics', 0, ?, NOW())`, [
            req.user.id,
            JSON.stringify({ type, period, format })
        ]);
        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="prestaci_stats_${type}_${period}.csv"`);
            // Convertir en CSV ici
            res.send('CSV export not implemented yet');
        }
        else {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="prestaci_stats_${type}_${period}.json"`);
            res.json({
                exported_at: new Date().toISOString(),
                type,
                period,
                data
            });
        }
    }
    catch (error) {
        console.error('Erreur export statistiques:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
export default router;
