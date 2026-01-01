import { Router, Request, Response } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const MAX_PHOTO_SIZE = 2 * 1024 * 1024; // 2MB

function parsePhotoArray(input: any) {
  if (!input) return null;
  let photos = input;
  if (typeof input === 'string') {
    try {
      photos = JSON.parse(input);
    } catch {
      photos = [input];
    }
  }
  if (!Array.isArray(photos)) return null;
  for (const photo of photos) {
    if (typeof photo !== 'string') continue;
    const base64Match = photo.split('base64,')[1] || photo;
    const sizeInBytes = Buffer.from(base64Match, 'base64').length;
    if (sizeInBytes > MAX_PHOTO_SIZE) {
      throw new Error('Chaque photo doit faire moins de 2MB. Compressez ou réduisez vos images.');
    }
  }
  return photos;
}

// Récupérer le profil du prestataire connecté
router.get('/profile', requireAuth, async (req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query(
      'SELECT * FROM prestataires WHERE user_id = ?',
      [(req as any).user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Profil prestataire non trouvé.' });
    }
    res.json(rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Mettre à jour le profil du prestataire connecté
router.put('/profile', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const {
      nom_commercial,
      bio,
      adresse,
      ville,
      pays,
      latitude,
      longitude,
      telephone_pro,
      horaires_ouverture, // Doit être un objet JSON
      photos_etablissement, // Doit être un tableau de chaînes JSON
    } = req.body;

    if (!nom_commercial) {
      return res.status(400).json({ error: 'Le nom commercial est requis.' });
    }

    const [existing]: any = await pool.query('SELECT id FROM prestataires WHERE user_id = ?', [userId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Profil prestataire non trouvé. Impossible de mettre à jour.' });
    }

    let photosJson: string | null = null;
    if (photos_etablissement) {
      const parsed = parsePhotoArray(photos_etablissement);
      photosJson = parsed ? JSON.stringify(parsed) : null;
    }

    await pool.query(
      `UPDATE prestataires SET
        nom_commercial = ?,
        bio = ?,
        adresse = ?,
        ville = ?,
        pays = ?,
        latitude = ?,
        longitude = ?,
        telephone_pro = ?,
        horaires_ouverture = ?,
        photos_etablissement = ?
      WHERE user_id = ?`,
      [
        nom_commercial,
        bio,
        adresse,
        ville,
        pays,
        latitude,
        longitude,
        telephone_pro,
        horaires_ouverture ? JSON.stringify(horaires_ouverture) : null,
        photosJson,
        userId
      ]
    );

    const [updatedProfile]: any = await pool.query('SELECT * FROM prestataires WHERE user_id = ?', [userId]);

    res.json({ message: 'Profil mis à jour avec succès.', prestataire: updatedProfile[0] });

  } catch (error: any) {
    console.error('Erreur lors de la mise à jour du profil prestataire:', error);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});

// Route obsolète, conservée pour la compatibilité
router.post('/setup', async (req: Request, res: Response) => {
  try {
    const token = (req as any).cookies?.session_token;
    if (!token) return res.status(401).json({ error: 'Non authentifié' });

    const [sessRows]: any = await pool.query(
      'SELECT us.user_id FROM user_sessions us WHERE us.token = ? AND us.expires_at > NOW() LIMIT 1',
      [token]
    );
    const sess = sessRows[0];
    if (!sess) return res.status(401).json({ error: 'Session invalide ou expirée' });

    const userId = Number(sess.user_id);
    const {
      nom_commercial,
      ville,
      bio,
      telephone_pro,
      adresse,
      pays,
      latitude,
      longitude,
      horaires_ouverture,
      photos_etablissement,
    } = req.body || {};
    if (!nom_commercial) return res.status(400).json({ error: 'nom_commercial requis' });

    // Prepare JSON fields
    let horairesJson: any = null;
    if (horaires_ouverture) {
      try {
        horairesJson = typeof horaires_ouverture === 'string' ? JSON.parse(horaires_ouverture) : horaires_ouverture;
      } catch {
        return res.status(400).json({ error: 'horaires_ouverture invalide (JSON attendu)' });
      }
    }
    let photosJson: any = null;
    if (photos_etablissement) {
      try {
        const parsed = parsePhotoArray(photos_etablissement);
        photosJson = parsed;
      } catch (err: any) {
        return res.status(400).json({ error: err.message || 'photos_etablissement invalide (JSON array attendu)' });
      }
    }

    // If prestataire profile exists, update it; else create it
    const [existsRows]: any = await pool.query('SELECT id FROM prestataires WHERE user_id = ? LIMIT 1', [userId]);
    if (existsRows.length > 0) {
      await pool.query(
        `UPDATE prestataires SET 
          nom_commercial = ?,
          ville = ?,
          bio = ?,
          telephone_pro = ?,
          adresse = ?,
          pays = COALESCE(?, pays),
          latitude = ?,
          longitude = ?,
          horaires_ouverture = COALESCE(?, horaires_ouverture),
          photos_etablissement = COALESCE(?, photos_etablissement),
          updated_at = NOW()
        WHERE user_id = ?`,
        [
          nom_commercial,
          ville || null,
          bio || null,
          telephone_pro || null,
          adresse || null,
          pays || null,
          latitude ?? null,
          longitude ?? null,
          horairesJson ? JSON.stringify(horairesJson) : null,
          photosJson ? JSON.stringify(photosJson) : null,
          userId,
        ]
      );
      return res.json({ ok: true, updated: true });
    }

    await pool.query(
      `INSERT INTO prestataires 
        (user_id, nom_commercial, ville, bio, telephone_pro, adresse, pays, latitude, longitude, horaires_ouverture, photos_etablissement, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, 'Côte d\'Ivoire'), ?, ?, ?, ?, NOW(), NOW())`,
      [
        userId,
        nom_commercial,
        ville || null,
        bio || null,
        telephone_pro || null,
        adresse || null,
        pays || null,
        latitude ?? null,
        longitude ?? null,
        horairesJson ? JSON.stringify(horairesJson) : null,
        photosJson ? JSON.stringify(photosJson) : null,
      ]
    );

    res.json({ ok: true, created: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/prestataires/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [rows]: any = await pool.query('SELECT * FROM prestataires WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Prestataire non trouvé' });
    }
    res.json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
