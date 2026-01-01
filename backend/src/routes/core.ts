import { Router, Request, Response } from 'express';
import { pool } from '../db.js';

const router = Router();

router.get('/health', async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query('SELECT 1 as ok');
    res.json({ status: 'ok', db: rows });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/categories', async (_req: Request, res: Response) => {
  const [rows] = await pool.query('SELECT * FROM categories WHERE is_active = 1 ORDER BY ordre_affichage, id');
  res.json(rows);
});

router.get('/sous_categories', async (req: Request, res: Response) => {
  const { categorie_id } = req.query;
  let sql = 'SELECT * FROM sous_categories WHERE is_active = 1';
  const params: any[] = [];
  if (categorie_id) {
    sql += ' AND categorie_id = ?';
    params.push(Number(categorie_id));
  }
  sql += ' ORDER BY ordre_affichage, id';
  const [rows] = await pool.query(sql, params);
  res.json(rows);
});

router.get('/plans_abonnement', async (_req: Request, res: Response) => {
  const [rows] = await pool.query('SELECT * FROM plans_abonnement WHERE is_active = 1 ORDER BY id');
  res.json(rows);
});

router.get('/prestataires', async (req: Request, res: Response) => {
  const { ville } = req.query;
  let sql = 'SELECT * FROM prestataires WHERE 1=1';
  const params: any[] = [];
  if (ville) { sql += ' AND ville = ?'; params.push(ville); }
  sql += ' ORDER BY is_verified DESC, created_at DESC';
  const [rows] = await pool.query(sql, params);
  res.json(rows);
});

router.get('/services', async (req: Request, res: Response) => {
  const { sous_categorie_id, prestataire_id } = req.query;
  let sql = 'SELECT * FROM services WHERE is_active = 1';
  const params: any[] = [];
  if (sous_categorie_id) { sql += ' AND sous_categorie_id = ?'; params.push(Number(sous_categorie_id)); }
  if (prestataire_id) { sql += ' AND prestataire_id = ?'; params.push(Number(prestataire_id)); }
  sql += ' ORDER BY created_at DESC';
  const [rows] = await pool.query(sql, params);
  res.json(rows);
});

export default router;
