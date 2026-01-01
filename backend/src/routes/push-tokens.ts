import { Router, Request, Response } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Middleware d'authentification pour toutes les routes
router.use(requireAuth);

// POST /api/push-tokens - Enregistrer un token de notification push
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    const { token, device_type, device_id } = req.body;
    
    if (!token || !device_type) {
      return res.status(400).json({ error: 'Token et type d\'appareil requis' });
    }
    
    // Vérifier si le token existe déjà pour cet utilisateur
    const [existingRows]: any = await pool.query(
      'SELECT id FROM push_tokens WHERE user_id = ? AND token = ? LIMIT 1',
      [userId, token]
    );
    
    if (existingRows.length > 0) {
      // Mettre à jour le token existant
      await pool.query(
        'UPDATE push_tokens SET device_type = ?, device_id = ?, is_active = 1, updated_at = NOW() WHERE id = ?',
        [device_type, device_id, existingRows[0].id]
      );
      
      res.json({ ok: true, message: 'Token mis à jour' });
    } else {
      // Créer un nouveau token
      const [result]: any = await pool.query(
        'INSERT INTO push_tokens (user_id, token, device_type, device_id, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, NOW(), NOW())',
        [userId, token, device_type, device_id]
      );
      
      res.json({ ok: true, id: result.insertId, message: 'Token enregistré' });
    }
  } catch (e: any) {
    console.error('Erreur enregistrement push token:', e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/push-tokens - Récupérer les tokens de l'utilisateur
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    
    const [rows]: any = await pool.query(
      'SELECT id, token, device_type, device_id, is_active, created_at, updated_at FROM push_tokens WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    
    res.json(rows);
  } catch (e: any) {
    console.error('Erreur récupération push tokens:', e);
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/push-tokens/:id/toggle - Activer/désactiver un token
router.put('/:id/toggle', async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    const tokenId = parseInt(req.params.id);
    
    // Vérifier que le token appartient à l'utilisateur
    const [tokenRows]: any = await pool.query(
      'SELECT id, is_active FROM push_tokens WHERE id = ? AND user_id = ? LIMIT 1',
      [tokenId, userId]
    );
    
    if (tokenRows.length === 0) {
      return res.status(404).json({ error: 'Token introuvable' });
    }
    
    const newStatus = tokenRows[0].is_active ? 0 : 1;
    
    await pool.query(
      'UPDATE push_tokens SET is_active = ?, updated_at = NOW() WHERE id = ?',
      [newStatus, tokenId]
    );
    
    res.json({ ok: true, is_active: newStatus });
  } catch (e: any) {
    console.error('Erreur toggle push token:', e);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/push-tokens/:id - Supprimer un token
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    const tokenId = parseInt(req.params.id);
    
    // Vérifier que le token appartient à l'utilisateur
    const [result]: any = await pool.query(
      'DELETE FROM push_tokens WHERE id = ? AND user_id = ?',
      [tokenId, userId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Token introuvable' });
    }
    
    res.json({ ok: true, message: 'Token supprimé' });
  } catch (e: any) {
    console.error('Erreur suppression push token:', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/push-tokens/cleanup - Nettoyer les anciens tokens inactifs
router.post('/cleanup', async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    
    // Supprimer les tokens inactifs de plus de 30 jours
    const [result]: any = await pool.query(
      'DELETE FROM push_tokens WHERE user_id = ? AND is_active = 0 AND updated_at < DATE_SUB(NOW(), INTERVAL 30 DAY)',
      [userId]
    );
    
    res.json({ ok: true, deleted: result.affectedRows });
  } catch (e: any) {
    console.error('Erreur nettoyage push tokens:', e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
