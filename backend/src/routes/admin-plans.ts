import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { pool } from '../db.js';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

const router = express.Router();

// Middleware d'authentification admin
router.use(requireAuth);
router.use(requireRole('admin'));

// Interface pour les plans
interface PlanRow extends RowDataPacket {
  id: number;
  nom: string;
  description: string;
  prix: number;
  duree_mois: number;
  max_services: number;
  max_photos_par_service: number;
  commission_percentage: number;
  features: string;
  is_active: boolean;
  is_popular: boolean;
  created_at: string;
  updated_at: string;
  nombre_abonnements_actifs: number;
  revenus_totaux: number;
}

// GET /api/admin/plans - Récupérer tous les plans
router.get('/', async (req, res) => {
  try {
    const { include_inactive = false } = req.query;

    let whereClause = '';
    if (!include_inactive) {
      whereClause = 'WHERE p.is_active = 1';
    }

    const query = `
      SELECT 
        p.*,
        COUNT(DISTINCT t.id) as nombre_abonnements_actifs,
        SUM(CASE WHEN t.statut = 'valide' THEN p.prix ELSE 0 END) as revenus_totaux
      FROM plans_abonnement p
      LEFT JOIN transactions_wave t ON p.id = t.plan_id AND t.statut = 'valide'
      ${whereClause}
      GROUP BY p.id
      ORDER BY p.prix ASC
    `;

    const [plans] = await pool.execute<PlanRow[]>(query);

    res.json(plans);
  } catch (error) {
    console.error('Erreur récupération plans:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/admin/plans/:id - Récupérer un plan spécifique
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [plans] = await pool.execute<PlanRow[]>(
      `SELECT 
        p.*,
        COUNT(DISTINCT t.id) as nombre_abonnements_actifs,
        COUNT(DISTINCT CASE WHEN t.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN t.id END) as nouveaux_abonnements_30j,
        SUM(CASE WHEN t.statut = 'valide' THEN p.prix ELSE 0 END) as revenus_mensuels_recurrents
      FROM plans_abonnement p
      LEFT JOIN transactions_wave t ON p.id = t.plan_id
      WHERE p.id = ?
      GROUP BY p.id`,
      [id]
    );

    if (plans.length === 0) {
      return res.status(404).json({ error: 'Plan non trouvé' });
    }

    // Récupérer les abonnements récents pour ce plan
    const [recentSubscriptions] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        s.*,
        u.nom as user_nom,
        u.email as user_email
      FROM transactions_wave s
      LEFT JOIN users u ON s.prestataire_id = u.id
      WHERE s.plan_id = ?
      ORDER BY s.created_at DESC
      LIMIT 10`,
      [id]
    );

    res.json({
      ...plans[0],
      recent_subscriptions: recentSubscriptions
    });
  } catch (error) {
    console.error('Erreur récupération plan:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/admin/plans - Créer un nouveau plan
router.post('/', async (req, res) => {
  try {
    const {
      nom,
      description,
      prix,
      duree_mois = 1,
      max_services,
      max_photos_par_service = 5,
      commission_percentage = 0,
      features = [],
      is_popular = false
    } = req.body;

    // Validation
    if (!nom || !description || prix === undefined || !max_services) {
      return res.status(400).json({ 
        error: 'Nom, description, prix et nombre max de services requis' 
      });
    }

    if (prix < 0) {
      return res.status(400).json({ error: 'Le prix ne peut pas être négatif' });
    }

    // Vérifier que le nom n'existe pas déjà
    const [existing] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM plans_abonnement WHERE nom = ?',
      [nom]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Un plan avec ce nom existe déjà' });
    }

    // Si ce plan est marqué comme populaire, retirer le flag des autres
    if (is_popular) {
      await pool.execute(
        'UPDATE plans_abonnement SET is_popular = 0 WHERE is_popular = 1'
      );
    }

    // Créer le plan
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO plans_abonnement 
       (nom, description, prix, duree_mois, max_services, max_photos_par_service, 
        commission_percentage, features, is_active, is_popular, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, NOW(), NOW())`,
      [
        nom, 
        description, 
        prix, 
        duree_mois, 
        max_services, 
        max_photos_par_service,
        commission_percentage,
        JSON.stringify(features),
        is_popular
      ]
    );

    // Log de l'action admin
    await pool.execute(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, created_at) 
       VALUES (?, 'plan_created', 'subscription_plan', ?, ?, NOW())`,
      [
        req.user.id,
        result.insertId,
        JSON.stringify({ nom, prix, max_services })
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Plan créé',
      id: result.insertId
    });
  } catch (error) {
    console.error('Erreur création plan:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/admin/plans/:id - Modifier un plan
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nom,
      description,
      prix,
      duree_mois,
      max_services,
      max_photos_par_service,
      commission_percentage,
      features,
      is_active,
      is_popular
    } = req.body;

    // Vérifier que le plan existe
    const [existing] = await pool.execute<RowDataPacket[]>(
      'SELECT id, nom FROM plans_abonnement WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Plan non trouvé' });
    }

    // Vérifier que le nouveau nom n'existe pas déjà (si changé)
    if (nom && nom !== existing[0].nom) {
      const [duplicate] = await pool.execute<RowDataPacket[]>(
        'SELECT id FROM plans_abonnement WHERE nom = ? AND id != ?',
        [nom, id]
      );

      if (duplicate.length > 0) {
        return res.status(400).json({ error: 'Un plan avec ce nom existe déjà' });
      }
    }

    // Si ce plan est marqué comme populaire, retirer le flag des autres
    if (is_popular) {
      await pool.execute(
        'UPDATE plans_abonnement SET is_popular = 0 WHERE is_popular = 1 AND id != ?',
        [id]
      );
    }

    // Construire la requête de mise à jour
    const updates: string[] = [];
    const params: any[] = [];

    if (nom) {
      updates.push('nom = ?');
      params.push(nom);
    }
    if (description) {
      updates.push('description = ?');
      params.push(description);
    }
    if (prix !== undefined) {
      if (prix < 0) {
        return res.status(400).json({ error: 'Le prix ne peut pas être négatif' });
      }
      updates.push('prix = ?');
      params.push(prix);
    }
    if (duree_mois) {
      updates.push('duree_mois = ?');
      params.push(duree_mois);
    }
    if (max_services) {
      updates.push('max_services = ?');
      params.push(max_services);
    }
    if (max_photos_par_service) {
      updates.push('max_photos_par_service = ?');
      params.push(max_photos_par_service);
    }
    if (commission_percentage !== undefined) {
      updates.push('commission_percentage = ?');
      params.push(commission_percentage);
    }
    if (features) {
      updates.push('features = ?');
      params.push(JSON.stringify(features));
    }
    if (typeof is_active === 'boolean') {
      updates.push('is_active = ?');
      params.push(is_active);
    }
    if (typeof is_popular === 'boolean') {
      updates.push('is_popular = ?');
      params.push(is_popular);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucune donnée à mettre à jour' });
    }

    updates.push('updated_at = NOW()');
    params.push(id);

    await pool.execute(
      `UPDATE plans_abonnement SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    // Log de l'action admin
    await pool.execute(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, created_at) 
       VALUES (?, 'plan_updated', 'subscription_plan', ?, ?, NOW())`,
      [
        req.user.id,
        id,
        JSON.stringify({ nom, prix, max_services, is_active })
      ]
    );

    res.json({ success: true, message: 'Plan mis à jour' });
  } catch (error) {
    console.error('Erreur modification plan:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/admin/plans/:id - Supprimer un plan
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que le plan existe
    const [plans] = await pool.execute<RowDataPacket[]>(
      'SELECT id, nom FROM plans_abonnement WHERE id = ?',
      [id]
    );

    if (plans.length === 0) {
      return res.status(404).json({ error: 'Plan non trouvé' });
    }

    // Vérifier s'il y a des abonnements actifs
    const [activeSubscriptions] = await pool.execute<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM subscriptions WHERE plan_id = ? AND statut = "actif"',
      [id]
    );

    if (activeSubscriptions[0].count > 0) {
      return res.status(400).json({ 
        error: 'Impossible de supprimer un plan avec des abonnements actifs' 
      });
    }

    // Supprimer le plan
    await pool.execute('DELETE FROM plans_abonnement WHERE id = ?', [id]);

    // Log de l'action admin
    await pool.execute(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, created_at) 
       VALUES (?, 'plan_deleted', 'subscription_plan', ?, ?, NOW())`,
      [
        req.user.id,
        id,
        JSON.stringify({ nom: plans[0].nom })
      ]
    );

    res.json({ success: true, message: 'Plan supprimé' });
  } catch (error) {
    console.error('Erreur suppression plan:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/admin/plans/subscriptions - Récupérer tous les abonnements
router.get('/subscriptions/all', async (req, res) => {
  try {
    const { 
      statut = 'all', 
      plan_id, 
      search = '', 
      page = 1, 
      limit = 20 
    } = req.query;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (statut !== 'all') {
      whereClause += ' AND s.statut = ?';
      params.push(statut);
    }

    if (plan_id) {
      whereClause += ' AND s.plan_id = ?';
      params.push(plan_id);
    }

    if (search) {
      whereClause += ' AND (u.nom LIKE ? OR u.email LIKE ? OR p.nom LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    const offset = (Number(page) - 1) * Number(limit);

    const query = `
      SELECT 
        s.*,
        u.nom as user_nom,
        u.email as user_email,
        p.nom as plan_nom,
        p.prix as plan_prix,
        p.duree_mois as plan_duree
      FROM transactions_wave s
      LEFT JOIN users u ON s.prestataire_id = u.id
      LEFT JOIN plans_abonnement p ON s.plan_id = p.id
      ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT ? OFFSET ?
    `;

    params.push(Number(limit), offset);

    const [subscriptions] = await pool.execute<RowDataPacket[]>(query, params);

    // Compter le total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM transactions_wave s
      LEFT JOIN users u ON s.prestataire_id = u.id
      LEFT JOIN plans_abonnement p ON s.plan_id = p.id
      ${whereClause.replace('LIMIT ? OFFSET ?', '')}
    `;

    const [countResult] = await pool.execute<RowDataPacket[]>(
      countQuery, 
      params.slice(0, -2)
    );

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / Number(limit));

    res.json({
      subscriptions,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages,
        hasNext: Number(page) < totalPages,
        hasPrev: Number(page) > 1
      }
    });
  } catch (error) {
    console.error('Erreur récupération abonnements:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/admin/plans/subscriptions/:id/status - Changer le statut d'un abonnement
router.put('/subscriptions/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { statut, reason } = req.body;

    const validStatuts = ['actif', 'suspendu', 'expire', 'annule'];
    if (!validStatuts.includes(statut)) {
      return res.status(400).json({ error: 'Statut invalide' });
    }

    // Vérifier que l'abonnement existe
    const [subscriptions] = await pool.execute<RowDataPacket[]>(
      `SELECT s.*, u.nom as user_nom, p.nom as plan_nom
       FROM transactions_wave s
       LEFT JOIN users u ON s.prestataire_id = u.id
       LEFT JOIN plans_abonnement p ON s.plan_id = p.id
       WHERE s.id = ?`,
      [id]
    );

    if (subscriptions.length === 0) {
      return res.status(404).json({ error: 'Abonnement non trouvé' });
    }

    const subscription = subscriptions[0];

    // Mettre à jour le statut
    await pool.execute(
      'UPDATE subscriptions SET statut = ?, updated_at = NOW() WHERE id = ?',
      [statut, id]
    );

    // Log de l'action admin
    await pool.execute(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, created_at) 
       VALUES (?, 'subscription_status_changed', 'subscription', ?, ?, NOW())`,
      [
        req.user.id,
        id,
        JSON.stringify({ 
          old_status: subscription.statut, 
          new_status: statut, 
          user_nom: subscription.user_nom,
          plan_nom: subscription.plan_nom,
          reason 
        })
      ]
    );

    // Notifier l'utilisateur
    await pool.execute(
      `INSERT INTO notifications (user_id, type, title, message, data, created_at)
       VALUES (?, 'subscription_status_changed', 'Statut d''abonnement modifié', ?, ?, NOW())`,
      [
        subscription.user_id,
        `Le statut de votre abonnement "${subscription.plan_nom}" a été modifié vers "${statut}". ${reason ? `Raison: ${reason}` : ''}`,
        JSON.stringify({ 
          subscription_id: id, 
          new_status: statut, 
          plan_nom: subscription.plan_nom,
          reason 
        })
      ]
    );

    res.json({ 
      success: true, 
      message: `Statut de l'abonnement modifié vers "${statut}"` 
    });
  } catch (error) {
    console.error('Erreur changement statut abonnement:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/admin/plans/stats - Statistiques des plans et abonnements
router.get('/stats/overview', async (req, res) => {
  try {
    const [planStats] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        COUNT(*) as total_plans,
        COUNT(CASE WHEN is_active = 1 THEN 1 END) as plans_actifs,
        AVG(prix) as prix_moyen,
        MIN(prix) as prix_min,
        MAX(prix) as prix_max
      FROM plans_abonnement
    `);

    const [subscriptionStats] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        COUNT(*) as total_abonnements,
        COUNT(CASE WHEN statut = 'actif' THEN 1 END) as abonnements_actifs,
        COUNT(CASE WHEN statut = 'suspendu' THEN 1 END) as abonnements_suspendus,
        COUNT(CASE WHEN statut = 'expire' THEN 1 END) as abonnements_expires,
        COUNT(CASE WHEN statut = 'annule' THEN 1 END) as abonnements_annules,
        COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as nouveaux_ce_mois
      FROM subscriptions
    `);

    const [revenueStats] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        SUM(CASE WHEN s.statut = 'valide' THEN p.prix ELSE 0 END) as revenus_mensuels_recurrents,
        SUM(CASE WHEN s.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN p.prix ELSE 0 END) as revenus_ce_mois,
        AVG(CASE WHEN s.statut = 'valide' THEN p.prix END) as panier_moyen_actif
      FROM transactions_wave s
      LEFT JOIN plans_abonnement p ON s.plan_id = p.id
    `);

    const [planPopularity] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        p.nom as plan_nom,
        p.prix as plan_prix,
        COUNT(s.id) as nombre_abonnements,
        COUNT(CASE WHEN s.statut = 'valide' THEN 1 END) as abonnements_actifs,
        SUM(CASE WHEN s.statut = 'valide' THEN p.prix ELSE 0 END) as revenus_mensuels,
        ROUND(COUNT(s.id) * 100.0 / (SELECT COUNT(*) FROM subscriptions), 2) as pourcentage_total
      FROM plans_abonnement p
      LEFT JOIN transactions_wave s ON p.id = s.plan_id
      WHERE p.is_active = 1
      GROUP BY p.id, p.nom, p.prix
      ORDER BY nombre_abonnements DESC
    `);

    const [churnAnalysis] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        DATE_FORMAT(updated_at, '%Y-%m') as mois,
        COUNT(CASE WHEN statut = 'annule' THEN 1 END) as abonnements_annules,
        COUNT(CASE WHEN statut = 'expire' THEN 1 END) as abonnements_expires,
        COUNT(*) as total_modifications
      FROM subscriptions
      WHERE updated_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
        AND statut IN ('annule', 'expire')
      GROUP BY DATE_FORMAT(updated_at, '%Y-%m')
      ORDER BY mois DESC
    `);

    res.json({
      planStats: planStats[0],
      subscriptionStats: subscriptionStats[0],
      revenueStats: revenueStats[0],
      planPopularity,
      churnAnalysis
    });
  } catch (error) {
    console.error('Erreur statistiques plans:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
