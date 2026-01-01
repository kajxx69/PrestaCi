import express, { Request, Response } from 'express';
import { pool } from '../db.js';

const router = express.Router();

async function getUserIdFromSession(req: Request): Promise<number | null> {
  const token = req.cookies?.session_token as string | undefined;
  if (!token) return null;
  const [rows]: any = await pool.query(
    'SELECT us.user_id FROM user_sessions us WHERE us.token = ? AND us.expires_at > NOW() LIMIT 1',
    [token]
  );
  return rows[0]?.user_id || null;
}

// List available plans
router.get('/plans', async (_req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query('SELECT id, nom, prix, prix_promo, devise, max_services, max_reservations_mois, mise_en_avant, description, avantages FROM plans_abonnement WHERE is_active = 1 ORDER BY id');
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Get current subscription for connected prestataire
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = await getUserIdFromSession(req);
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });
    const [rows]: any = await pool.query(
      `SELECT p.id as prestataire_id, p.plan_actuel_id, p.abonnement_expires_at, pa.nom as plan_nom, pa.max_services, pa.max_reservations_mois
       FROM prestataires p JOIN plans_abonnement pa ON p.plan_actuel_id = pa.id WHERE p.user_id = ? LIMIT 1`,
      [userId]
    );
    const sub = rows[0] || null;
    res.json({ subscription: sub });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Start/Renew subscription (mock)
router.post('/start', async (req: Request, res: Response) => {
  try {
    const userId = await getUserIdFromSession(req);
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });
    const { plan_id, duree_jours = 30 } = req.body || {};
    if (!plan_id) return res.status(400).json({ error: 'plan_id requis' });

    const [pRows]: any = await pool.query('SELECT id FROM prestataires WHERE user_id = ? LIMIT 1', [userId]);
    if (pRows.length === 0) return res.status(403).json({ error: 'Prestataire introuvable' });

    await pool.query(
      `UPDATE prestataires 
       SET plan_actuel_id = ?, abonnement_expires_at = DATE_ADD(NOW(), INTERVAL ? DAY), updated_at = NOW()
       WHERE user_id = ?`,
      [plan_id, duree_jours, userId]
    );

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
