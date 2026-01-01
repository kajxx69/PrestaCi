import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { pool } from '../db.js';
const router = express.Router();
// Créer une nouvelle transaction Wave (demande d'abonnement)
router.post('/', requireAuth, async (req, res) => {
    try {
        const user_id = req.user.id;
        // Retrouver l'ID du prestataire à partir de l'ID de l'utilisateur
        const [prestataireRows] = await pool.execute('SELECT id FROM prestataires WHERE user_id = ?', [user_id]);
        if (prestataireRows.length === 0) {
            return res.status(403).json({
                error: "Action non autorisée. Votre compte n'est pas configuré comme un compte prestataire."
            });
        }
        const prestataire_id = prestataireRows[0].id;
        const { plan_id, transaction_id_wave, montant, devise = 'FCFA', duree_abonnement_jours = 30 } = req.body;
        // Validation des données
        if (!plan_id || !transaction_id_wave || !montant) {
            return res.status(400).json({
                error: 'Plan, ID de transaction Wave et montant requis'
            });
        }
        // Vérifier que le plan existe
        const [plans] = await pool.execute('SELECT * FROM plans_abonnement WHERE id = ?', [plan_id]);
        if (plans.length === 0) {
            return res.status(404).json({ error: 'Plan non trouvé' });
        }
        const plan = plans[0];
        // Calculer le prix attendu selon la durée (prix de base = 1 mois)
        const expectedPrice = Math.round(plan.prix * (duree_abonnement_jours / 30));
        // Vérifier que le montant correspond au prix calculé
        if (parseFloat(montant) !== expectedPrice) {
            return res.status(400).json({
                error: `Le montant doit être de ${expectedPrice} ${devise} pour ${duree_abonnement_jours} jours`
            });
        }
        // Vérifier qu'il n'y a pas déjà une transaction en attente
        const [existingTransactions] = await pool.execute('SELECT * FROM transactions_wave WHERE prestataire_id = ? AND statut = "en_attente"', [prestataire_id]);
        if (existingTransactions.length > 0) {
            return res.status(400).json({
                error: 'Vous avez déjà une demande d\'abonnement en attente de validation'
            });
        }
        // Créer la transaction
        const [result] = await pool.execute(`INSERT INTO transactions_wave (
        prestataire_id, plan_id, transaction_id_wave, montant, devise, 
        duree_abonnement_jours, statut
      ) VALUES (?, ?, ?, ?, ?, ?, 'en_attente')`, [prestataire_id, plan_id, transaction_id_wave, montant, devise, duree_abonnement_jours]);
        res.json({
            ok: true,
            message: 'Demande d\'abonnement soumise avec succès. En attente de validation.',
            transaction_id: result.insertId
        });
    }
    catch (error) {
        console.error('Erreur création transaction Wave:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
// Récupérer les transactions du prestataire connecté
router.get('/my-transactions', requireAuth, async (req, res) => {
    try {
        const user_id = req.user.id;
        // Retrouver l'ID du prestataire à partir de l'ID de l'utilisateur
        const [prestataireRows] = await pool.execute('SELECT id FROM prestataires WHERE user_id = ?', [user_id]);
        if (prestataireRows.length === 0) {
            return res.status(403).json({ error: "Profil prestataire non trouvé." });
        }
        const prestataire_id = prestataireRows[0].id;
        const [transactions] = await pool.execute(`SELECT 
        tw.*,
        pa.nom as plan_nom,
        pa.prix as plan_prix,
        u.nom as admin_nom,
        u.prenom as admin_prenom
      FROM transactions_wave tw
      LEFT JOIN plans_abonnement pa ON tw.plan_id = pa.id
      LEFT JOIN users u ON tw.validee_par_admin_id = u.id
      WHERE tw.prestataire_id = ?
      ORDER BY tw.created_at DESC`, [prestataire_id]);
        res.json(transactions);
    }
    catch (error) {
        console.error('Erreur récupération transactions:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
// Récupérer le statut de la dernière transaction
router.get('/status', requireAuth, async (req, res) => {
    try {
        const user_id = req.user.id;
        // Retrouver l'ID du prestataire à partir de l'ID de l'utilisateur
        const [prestataireRows] = await pool.execute('SELECT id FROM prestataires WHERE user_id = ?', [user_id]);
        if (prestataireRows.length === 0) {
            return res.status(403).json({ error: "Profil prestataire non trouvé." });
        }
        const prestataire_id = prestataireRows[0].id;
        const [transactions] = await pool.execute(`SELECT 
        tw.*,
        pa.nom as plan_nom
      FROM transactions_wave tw
      LEFT JOIN plans_abonnement pa ON tw.plan_id = pa.id
      WHERE tw.prestataire_id = ?
      ORDER BY tw.created_at DESC
      LIMIT 1`, [prestataire_id]);
        if (transactions.length === 0) {
            return res.json({ hasTransaction: false });
        }
        res.json({
            hasTransaction: true,
            transaction: transactions[0]
        });
    }
    catch (error) {
        console.error('Erreur récupération statut transaction:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
export default router;
