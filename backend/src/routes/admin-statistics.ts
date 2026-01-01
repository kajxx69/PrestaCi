import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { pool } from '../db.js';
import { RowDataPacket } from 'mysql2';

const router = express.Router();
const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

// Middleware d'authentification admin
router.use(requireAuth);
router.use(requireRole('admin'));

// GET /api/admin/statistics/overview - Vue d'ensemble des statistiques
router.get('/overview', async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    // Statistiques générales
    const [generalStats] = await pool.execute<RowDataPacket[]>(`
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

    // Statistiques de croissance avec période fixe pour éviter l'injection SQL
    let daysInterval = 30;
    switch (period) {
      case '7d': daysInterval = 7; break;
      case '30d': daysInterval = 30; break;
      case '90d': daysInterval = 90; break;
      case '1y': daysInterval = 365; break;
    }

    const [growthStats] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)) as nouveaux_utilisateurs,
        (SELECT COUNT(*) FROM services WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY) AND deleted_at IS NULL) as nouveaux_services,
        (SELECT COUNT(*) FROM reservations WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)) as nouvelles_reservations,
        (SELECT SUM(prix_final) FROM reservations WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY) AND statut_id = 4) as revenus_periode,
        (SELECT COUNT(*) FROM avis WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)) as nouveaux_avis
    `, [daysInterval, daysInterval, daysInterval, daysInterval, daysInterval]);

    // Taux de conversion
    const [conversionStats] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        ROUND(
          (SELECT COUNT(*) FROM reservations WHERE statut_id = 4) * 100.0 / 
          NULLIF((SELECT COUNT(*) FROM reservations), 0), 2
        ) as taux_completion_reservations,
        ROUND(
          (SELECT COUNT(*) FROM users WHERE role_id = 2 AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)) * 100.0 / 
          NULLIF((SELECT COUNT(*) FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)), 0), 2
        ) as taux_conversion_prestataire,
        ROUND(
          (SELECT COUNT(*) FROM avis WHERE is_moderated = 1 AND is_approved = 1) * 100.0 / 
          NULLIF((SELECT COUNT(*) FROM reservations WHERE statut_id = 4), 0), 2
        ) as taux_avis_laisses
    `, [daysInterval, daysInterval]);

    // Données pour les graphiques
    const [revenueByMonth] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        DATE_FORMAT(created_at, '%b') as month,
        SUM(prix_final) as revenue
      FROM reservations
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH) 
        AND statut_id = 4
      GROUP BY DATE_FORMAT(created_at, '%Y-%m'), DATE_FORMAT(created_at, '%b'), created_at
      ORDER BY MIN(created_at) DESC
      LIMIT 6
    `);

    // Nouveaux utilisateurs
    const [newUsersStats] = await pool.execute<RowDataPacket[]>(`
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
  } catch (error) {
    console.error('Erreur statistiques overview:', error);
    res.status(500).json({ error: 'Erreur serveur', details: getErrorMessage(error) });
  }
});

// GET /api/admin/statistics/revenue - Statistiques de revenus  
router.get('/revenue', async (req, res) => {
  try {
    const { period = '30d', group_by = 'day' } = req.query;
    
    let daysInterval = 30;
    let groupByClause = 'DATE(created_at)';
    
    switch (period) {
      case '7d':
        daysInterval = 7;
        groupByClause = 'DATE(created_at)';
        break;
      case '30d':
        daysInterval = 30;
        groupByClause = group_by === 'week' ? 'YEARWEEK(created_at)' : 'DATE(created_at)';
        break;
      case '90d':
        daysInterval = 90;
        groupByClause = 'YEARWEEK(created_at)';
        break;
      case '1y':
        daysInterval = 365;
        groupByClause = 'DATE_FORMAT(created_at, "%Y-%m")';
        break;
    }

    // Revenus par période
    const [revenueByPeriod] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        ${groupByClause} as periode,
        COUNT(*) as nombre_reservations,
        SUM(prix_final) as revenus_totaux,
        AVG(prix_final) as panier_moyen,
        COUNT(DISTINCT client_id) as clients_uniques,
        COUNT(DISTINCT prestataire_id) as prestataires_actifs
      FROM reservations
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY) AND statut_id = 4
      GROUP BY periode
      ORDER BY periode DESC
    `, [daysInterval]);

    // Revenus par catégorie
    const [revenueByCategory] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        c.nom as categorie,
        COUNT(r.id) as nombre_reservations,
        SUM(r.prix_final) as revenus_totaux,
        AVG(r.prix_final) as panier_moyen,
        ROUND(SUM(r.prix_final) * 100.0 / (
          SELECT SUM(prix_final) FROM reservations 
          WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY) AND statut_id = 4
        ), 2) as pourcentage_revenus
      FROM categories c
      LEFT JOIN sous_categories sc ON c.id = sc.categorie_id
      LEFT JOIN services s ON sc.id = s.sous_categorie_id
      LEFT JOIN reservations r ON s.id = r.service_id 
        AND r.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY) 
        AND r.statut_id = 4
      GROUP BY c.id, c.nom
      HAVING revenus_totaux > 0
      ORDER BY revenus_totaux DESC
    `, [daysInterval, daysInterval]);

    // Top prestataires par revenus
    const [topProviders] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        u.nom as prestataire_nom,
        u.email as prestataire_email,
        COUNT(r.id) as nombre_reservations,
        SUM(r.prix_final) as revenus_totaux,
        AVG(r.prix_final) as panier_moyen,
        AVG(a.note) as note_moyenne
      FROM users u
      LEFT JOIN reservations r ON u.id = r.prestataire_id 
        AND r.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY) 
        AND r.statut_id = 4
      LEFT JOIN avis a ON r.id = a.reservation_id 
        AND a.is_moderated = 1 
        AND a.is_approved = 1
      WHERE u.role_id = 2
      GROUP BY u.id, u.nom, u.email
      HAVING revenus_totaux > 0
      ORDER BY revenus_totaux DESC
      LIMIT 20
    `, [daysInterval]);

    res.json({
      revenueByPeriod,
      revenueByCategory,
      topProviders,
      period,
      group_by
    });
  } catch (error) {
    console.error('Erreur statistiques revenus:', error);
    res.status(500).json({ error: 'Erreur serveur', details: getErrorMessage(error) });
  }
});

export default router;
