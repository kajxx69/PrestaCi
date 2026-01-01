import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { pool } from '../db.js';
const router = express.Router();
// Récupérer toutes les transactions Wave (admin uniquement)
router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const { statut, page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        let whereClause = '';
        let params = [];
        if (statut && statut !== 'all') {
            whereClause = 'WHERE tw.statut = ?';
            params.push(statut);
        }
        const [transactions] = await pool.execute(`SELECT 
        tw.*,
        p.id as prestataire_id_profile,
        u.nom as prestataire_nom,
        u.prenom as prestataire_prenom,
        u.email as prestataire_email,
        u.telephone as prestataire_telephone,
        pa.nom as plan_nom,
        pa.prix as plan_prix,
        admin.nom as admin_nom,
        admin.prenom as admin_prenom
      FROM transactions_wave tw
      LEFT JOIN prestataires p ON tw.prestataire_id = p.id
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN plans_abonnement pa ON tw.plan_id = pa.id
      LEFT JOIN users admin ON tw.validee_par_admin_id = admin.id
      ${whereClause}
      ORDER BY tw.created_at DESC
      LIMIT ? OFFSET ?`, [...params, parseInt(limit), offset]);
        // Compter le total pour la pagination
        const [countResult] = await pool.execute(`SELECT COUNT(*) as total FROM transactions_wave tw ${whereClause}`, params);
        const total = countResult[0].total;
        const totalPages = Math.ceil(total / parseInt(limit));
        res.json({
            transactions,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages
            }
        });
    }
    catch (error) {
        console.error('Erreur récupération transactions admin:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
// Valider une transaction Wave (admin uniquement)
router.put('/:id/validate', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const transactionId = parseInt(req.params.id);
        const adminId = req.user.id;
        // Vérifier que la transaction existe et est en attente
        const [transactions] = await pool.execute('SELECT * FROM transactions_wave WHERE id = ? AND statut = "en_attente"', [transactionId]);
        if (transactions.length === 0) {
            return res.status(404).json({
                error: 'Transaction non trouvée ou déjà traitée'
            });
        }
        const transaction = transactions[0];
        // Commencer une transaction SQL
        await pool.query('START TRANSACTION');
        try {
            // Marquer la transaction comme validée
            await pool.execute(`UPDATE transactions_wave 
         SET statut = 'valide', validee_par_admin_id = ?, date_validation = CURRENT_TIMESTAMP 
         WHERE id = ?`, [adminId, transactionId]);
            // Mettre à jour l'abonnement directement sur la table prestataires
            await pool.execute(`UPDATE prestataires 
         SET plan_actuel_id = ?, abonnement_expires_at = DATE_ADD(NOW(), INTERVAL ? DAY)
         WHERE id = ?`, [transaction.plan_id, transaction.duree_abonnement_jours, transaction.prestataire_id]);
            // Valider la transaction SQL
            await pool.query('COMMIT');
            res.json({
                ok: true,
                message: 'Transaction validée et abonnement activé avec succès'
            });
        }
        catch (error) {
            // Annuler la transaction en cas d'erreur
            await pool.query('ROLLBACK');
            throw error;
        }
    }
    catch (error) {
        console.error('Erreur validation transaction:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
// Rejeter une transaction Wave (admin uniquement)
router.put('/:id/reject', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const transactionId = parseInt(req.params.id);
        const adminId = req.user.id;
        const { motif_rejet } = req.body;
        if (!motif_rejet || motif_rejet.trim() === '') {
            return res.status(400).json({
                error: 'Le motif de rejet est requis'
            });
        }
        // Vérifier que la transaction existe et est en attente
        const [transactions] = await pool.execute('SELECT * FROM transactions_wave WHERE id = ? AND statut = "en_attente"', [transactionId]);
        if (transactions.length === 0) {
            return res.status(404).json({
                error: 'Transaction non trouvée ou déjà traitée'
            });
        }
        // Marquer la transaction comme rejetée
        await pool.execute(`UPDATE transactions_wave 
       SET statut = 'rejete', validee_par_admin_id = ?, motif_rejet = ?, date_validation = CURRENT_TIMESTAMP 
       WHERE id = ?`, [adminId, motif_rejet.trim(), transactionId]);
        res.json({
            ok: true,
            message: 'Transaction rejetée avec succès'
        });
    }
    catch (error) {
        console.error('Erreur rejet transaction:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
// Statistiques des transactions Wave (admin uniquement)
router.get('/stats', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const [stats] = await pool.execute(`SELECT 
        COUNT(*) as total_transactions,
        SUM(CASE WHEN statut = 'en_attente' THEN 1 ELSE 0 END) as en_attente,
        SUM(CASE WHEN statut = 'valide' THEN 1 ELSE 0 END) as validees,
        SUM(CASE WHEN statut = 'rejete' THEN 1 ELSE 0 END) as rejetees,
        SUM(CASE WHEN statut = 'valide' THEN montant ELSE 0 END) as revenus_total,
        AVG(CASE WHEN statut = 'valide' THEN montant ELSE NULL END) as montant_moyen
      FROM transactions_wave`);
        res.json(stats[0]);
    }
    catch (error) {
        console.error('Erreur statistiques transactions:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
export default router;
