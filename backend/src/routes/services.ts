import express, { Request, Response } from 'express';
import { pool } from '../db.js';
import { requireAuth, requirePrestataire } from '../middleware/auth.js';
import { validateCreateService } from '../utils/validation.js';

const router = express.Router();

// Get services for authenticated prestataire
router.get('/my-services', requireAuth, async (req: Request, res: Response) => {
  try {
    console.log('GET /services - User ID from token:', req.userId);
    
    // Utiliser une jointure pour garantir que seuls les services du prestataire connecté sont retournés
    const [rows]: any = await pool.query(
      `SELECT s.*
       FROM services s
       JOIN prestataires p ON s.prestataire_id = p.id
       WHERE p.user_id = ?
       ORDER BY s.created_at DESC`,
      [req.userId]
    );

    console.log(`Found ${rows.length} services for user_id: ${req.userId}`);
    res.json(rows);
  } catch (e: any) {
    console.error('GET /services error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Create service with plan limit enforcement
router.post('/', requireAuth, validateCreateService, async (req: Request, res: Response) => {
  try {
    console.log('POST /services - Body:', req.body);
    console.log('POST /services - User ID:', req.userId);
    
    // Récupérer le prestataire_id depuis la base de données
    const [prestataireRows]: any = await pool.query(
      'SELECT id FROM prestataires WHERE user_id = ? LIMIT 1',
      [req.userId]
    );
    
    const prestataireId = prestataireRows[0]?.id || null;
    console.log('POST /services - Prestataire ID:', prestataireId);
    
    if (!prestataireId) return res.status(403).json({ error: 'Profil prestataire introuvable' });

    // Check plan limits and expiration
    const [pRows]: any = await pool.query(
      `SELECT p.plan_actuel_id, p.abonnement_expires_at, pa.max_services
       FROM prestataires p JOIN plans_abonnement pa ON p.plan_actuel_id = pa.id WHERE p.id = ? LIMIT 1`,
      [prestataireId]
    );
    const plan = pRows[0];
    if (!plan) return res.status(400).json({ error: 'Plan introuvable' });
    if (plan.abonnement_expires_at && new Date(plan.abonnement_expires_at) < new Date()) {
      return res.status(402).json({ error: 'Abonnement expiré' });
    }
    const [countRows]: any = await pool.query('SELECT COUNT(*) as cnt FROM services WHERE prestataire_id = ?', [prestataireId]);
    const count = countRows[0]?.cnt ?? 0;
    if (plan.max_services >= 0 && count >= plan.max_services) {
      return res.status(403).json({ error: `Limite de services atteinte (${plan.max_services})` });
    }

    const { sous_categorie_id, nom, description, prix, devise, duree_minutes, photos, is_domicile } = req.body || {};
    
    console.log('POST /services - Extracted fields:', {
      sous_categorie_id,
      nom,
      prix,
      duree_minutes,
      devise,
      is_domicile
    });
    
    if (!sous_categorie_id || !nom || !prix || !duree_minutes) {
      return res.status(400).json({ 
        error: 'Champs requis manquants',
        details: {
          sous_categorie_id: !!sous_categorie_id,
          nom: !!nom,
          prix: !!prix,
          duree_minutes: !!duree_minutes
        }
      });
    }
    
    const photosJson = photos ? JSON.stringify(photos) : null;
    const [result]: any = await pool.query(
      `INSERT INTO services (prestataire_id, sous_categorie_id, nom, description, prix, devise, duree_minutes, photos, is_domicile, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, COALESCE(?, 'FCFA'), ?, ?, COALESCE(?, 0), 1, NOW(), NOW())`,
      [prestataireId, sous_categorie_id, nom, description || null, prix, devise || null, duree_minutes, photosJson, is_domicile]
    );
    
    console.log('POST /services - Service created with ID:', result.insertId);
    res.json({ id: result.insertId });
  } catch (e: any) {
    console.error('POST /services error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Update service
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    console.log('PUT /services - User ID:', req.userId);
    console.log('PUT /services - Service ID:', req.params.id);
    console.log('PUT /services - Body:', req.body);
    
    // Récupérer le prestataire_id depuis la base de données
    const [prestataireRows]: any = await pool.query(
      'SELECT id FROM prestataires WHERE user_id = ? LIMIT 1',
      [req.userId]
    );
    
    const prestataireId = prestataireRows[0]?.id || null;
    console.log('PUT /services - Prestataire ID:', prestataireId);
    
    if (!prestataireId) return res.status(403).json({ error: 'Profil prestataire introuvable' });

    const id = Number(req.params.id);
    
    // Vérifier d'abord si le service existe
    const [serviceRows]: any = await pool.query(
      'SELECT id, prestataire_id, nom FROM services WHERE id = ? LIMIT 1',
      [id]
    );
    
    if (serviceRows.length === 0) {
      return res.status(404).json({ error: 'Service introuvable' });
    }
    
    // Vérifier si le service appartient au prestataire
    if (serviceRows[0].prestataire_id !== prestataireId) {
      console.log(`Service ${id} appartient au prestataire ${serviceRows[0].prestataire_id}, pas à ${prestataireId}`);
      return res.status(403).json({ error: 'Vous n\'avez pas les droits pour modifier ce service' });
    }

    const { sous_categorie_id, nom, description, prix, devise, duree_minutes, photos, is_domicile, is_active } = req.body || {};
    const photosJson = photos ? JSON.stringify(photos) : null;
    await pool.query(
      `UPDATE services SET 
         sous_categorie_id = COALESCE(?, sous_categorie_id),
         nom = COALESCE(?, nom),
         description = COALESCE(?, description),
         prix = COALESCE(?, prix),
         devise = COALESCE(?, devise),
         duree_minutes = COALESCE(?, duree_minutes),
         photos = COALESCE(?, photos),
         is_domicile = COALESCE(?, is_domicile),
         is_active = COALESCE(?, is_active),
         updated_at = NOW()
       WHERE id = ? AND prestataire_id = ?`,
      [sous_categorie_id, nom, description, prix, devise, duree_minutes, photosJson, is_domicile, is_active, id, prestataireId]
    );
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Delete service
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    console.log('Delete service - User ID:', req.userId);
    console.log('Delete service - Service ID:', req.params.id);
    
    // Récupérer le prestataire_id depuis la base de données
    const [prestataireRows]: any = await pool.query(
      'SELECT id FROM prestataires WHERE user_id = ? LIMIT 1',
      [req.userId]
    );
    
    const prestataireId = prestataireRows[0]?.id || null;
    console.log('Delete service - Prestataire ID:', prestataireId);
    
    if (!prestataireId) {
      return res.status(403).json({ error: 'Profil prestataire introuvable' });
    }

    const id = Number(req.params.id);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ error: 'ID de service invalide' });
    }
    
    // Vérifier que le service existe et appartient au prestataire
    const [checkRows]: any = await pool.query(
      'SELECT id, nom, prestataire_id FROM services WHERE id = ? AND prestataire_id = ? LIMIT 1',
      [id, prestataireId]
    );
    
    console.log('Delete service - Service found:', checkRows.length > 0 ? checkRows[0] : 'Not found');
    
    if (checkRows.length === 0) {
      // Vérifier si le service existe mais appartient à un autre prestataire
      const [serviceExists]: any = await pool.query(
        'SELECT id, prestataire_id FROM services WHERE id = ? LIMIT 1',
        [id]
      );
      
      if (serviceExists.length > 0) {
        console.log('Service exists but belongs to prestataire:', serviceExists[0].prestataire_id);
        return res.status(403).json({ error: 'Vous n\'avez pas les droits pour supprimer ce service' });
      } else {
        return res.status(404).json({ error: 'Service introuvable' });
      }
    }
    
    // Vérifier s'il y a des réservations liées à ce service
    const [reservationRows]: any = await pool.query(
      'SELECT COUNT(*) as count FROM reservations WHERE service_id = ?',
      [id]
    );
    
    if (reservationRows[0].count > 0) {
      // Si des réservations existent, désactiver le service au lieu de le supprimer
      await pool.query(
        'UPDATE services SET is_active = 0, updated_at = NOW() WHERE id = ? AND prestataire_id = ?',
        [id, prestataireId]
      );
      return res.json({ 
        ok: true, 
        message: 'Service désactivé car des réservations existent. Le service ne peut pas être supprimé.',
        deactivated: true 
      });
    }
    
    // Supprimer le service s'il n'y a pas de réservations
    const [result]: any = await pool.query(
      'DELETE FROM services WHERE id = ? AND prestataire_id = ?',
      [id, prestataireId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(500).json({ error: 'Erreur lors de la suppression du service' });
    }
    
    res.json({ ok: true, message: 'Service supprimé avec succès', deleted: true });
  } catch (e: any) {
    console.error('Erreur suppression service:', e);
    // Gérer l'erreur de contrainte de clé étrangère
    if (e.code === 'ER_ROW_IS_REFERENCED_2' || e.code === 'ER_ROW_IS_REFERENCED') {
      return res.status(400).json({ 
        error: 'Ce service ne peut pas être supprimé car il est lié à d\'autres données (réservations, avis, etc.). Vous pouvez le désactiver à la place.' 
      });
    }
    res.status(500).json({ error: e.message });
  }
});

// Route de débogage pour vérifier l'isolation des services
router.get('/debug/my-services', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    
    // 1. Récupérer les infos de l'utilisateur
    const [userRows]: any = await pool.query(
      'SELECT id, email, nom, prenom FROM users WHERE id = ?',
      [userId]
    );
    
    // 2. Récupérer le prestataire associé
    const [prestataireRows]: any = await pool.query(
      'SELECT id, nom_commercial, user_id FROM prestataires WHERE user_id = ?',
      [userId]
    );
    
    const prestataireId = prestataireRows[0]?.id || null;
    
    // 3. Récupérer les services avec la MÊME requête que la route principale
    let servicesQuery = 'SELECT * FROM services WHERE prestataire_id = ? ORDER BY created_at DESC';
    const [services]: any = prestataireId 
      ? await pool.query(servicesQuery, [prestataireId])
      : [[]];
    
    // 4. Récupérer TOUS les services pour comparaison (debug uniquement)
    const [allServices]: any = await pool.query(
      'SELECT id, nom, prestataire_id FROM services ORDER BY id'
    );
    
    res.json({
      user: userRows[0] || null,
      prestataire: {
        found: prestataireRows.length > 0,
        id: prestataireId,
        nom_commercial: prestataireRows[0]?.nom_commercial || null
      },
      myServices: {
        count: services.length,
        query: servicesQuery,
        prestataireIdUsed: prestataireId,
        services: services.map((s: any) => ({
          id: s.id,
          nom: s.nom,
          prestataire_id: s.prestataire_id,
          is_active: s.is_active
        }))
      },
      allServicesInDB: allServices.map((s: any) => ({
        id: s.id,
        nom: s.nom,
        prestataire_id: s.prestataire_id
      })),
      analysis: {
        correctIsolation: services.every((s: any) => s.prestataire_id === prestataireId),
        problemServices: services.filter((s: any) => s.prestataire_id !== prestataireId).map((s: any) => s.id)
      }
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Route de débogage pour un service spécifique
router.get('/debug/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const serviceId = Number(req.params.id);
    const userId = req.userId;
    
    // Récupérer le prestataire_id de l'utilisateur
    const [prestataireRows]: any = await pool.query(
      'SELECT id FROM prestataires WHERE user_id = ?',
      [userId]
    );
    
    // Récupérer les infos du service
    const [serviceRows]: any = await pool.query(
      'SELECT * FROM services WHERE id = ?',
      [serviceId]
    );
    
    res.json({
      debug: {
        userId,
        prestataireId: prestataireRows[0]?.id || null,
        serviceId,
        service: serviceRows[0] || null,
        serviceExists: serviceRows.length > 0,
        belongsToUser: serviceRows[0]?.prestataire_id === prestataireRows[0]?.id
      }
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/services/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [rows]: any = await pool.query('SELECT * FROM services WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Service non trouvé' });
    }
    res.json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
