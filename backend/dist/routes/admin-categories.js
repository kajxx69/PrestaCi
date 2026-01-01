import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { pool } from '../db.js';
const router = express.Router();
// Middleware d'authentification admin
router.use(requireAuth);
router.use(requireRole('admin'));
// GET /api/admin/categories - Récupérer toutes les catégories
router.get('/', async (req, res) => {
    try {
        const { include_inactive = false } = req.query;
        let whereClause = '';
        if (!include_inactive) {
            whereClause = 'WHERE c.is_active = 1';
        }
        const query = `
      SELECT 
        c.*,
        COUNT(DISTINCT sc.id) as nombre_sous_categories,
        COUNT(DISTINCT s.id) as nombre_services
      FROM categories c
      LEFT JOIN sous_categories sc ON c.id = sc.categorie_id
      LEFT JOIN services s ON sc.id = s.sous_categorie_id AND s.deleted_at IS NULL
      ${whereClause}
      GROUP BY c.id
      ORDER BY c.nom ASC
    `;
        const [categories] = await pool.execute(query);
        res.json(categories);
    }
    catch (error) {
        console.error('Erreur récupération catégories:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
// GET /api/admin/categories/:id - Récupérer une catégorie spécifique
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [categories] = await pool.execute(`SELECT 
        c.*,
        COUNT(DISTINCT sc.id) as nombre_sous_categories,
        COUNT(DISTINCT s.id) as nombre_services
      FROM categories c
      LEFT JOIN sous_categories sc ON c.id = sc.categorie_id
      LEFT JOIN services s ON sc.id = s.sous_categorie_id AND s.deleted_at IS NULL
      WHERE c.id = ?
      GROUP BY c.id`, [id]);
        if (categories.length === 0) {
            return res.status(404).json({ error: 'Catégorie non trouvée' });
        }
        // Récupérer les sous-catégories
        const [sousCategories] = await pool.execute(`SELECT 
        sc.*,
        COUNT(s.id) as nombre_services
      FROM sous_categories sc
      LEFT JOIN services s ON sc.id = s.sous_categorie_id AND s.deleted_at IS NULL
      WHERE sc.categorie_id = ?
      GROUP BY sc.id
      ORDER BY sc.nom ASC`, [id]);
        res.json({
            ...categories[0],
            sous_categories: sousCategories
        });
    }
    catch (error) {
        console.error('Erreur récupération catégorie:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
// POST /api/admin/categories - Créer une nouvelle catégorie
router.post('/', async (req, res) => {
    try {
        const { nom, description, icone, couleur } = req.body;
        // Validation
        if (!nom || !description) {
            return res.status(400).json({ error: 'Nom et description requis' });
        }
        // Vérifier que le nom n'existe pas déjà
        const [existing] = await pool.execute('SELECT id FROM categories WHERE nom = ?', [nom]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Une catégorie avec ce nom existe déjà' });
        }
        // Créer la catégorie
        const [result] = await pool.execute(`INSERT INTO categories (nom, description, icone, couleur, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, NOW(), NOW())`, [nom, description, icone || 'folder', couleur || '#3B82F6']);
        // Log de l'action admin
        await pool.execute(`INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, created_at) 
       VALUES (?, 'category_created', 'category', ?, ?, NOW())`, [
            req.user.id,
            result.insertId,
            JSON.stringify({ nom, description })
        ]);
        res.status(201).json({
            success: true,
            message: 'Catégorie créée',
            id: result.insertId
        });
    }
    catch (error) {
        console.error('Erreur création catégorie:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
// PUT /api/admin/categories/:id - Modifier une catégorie
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nom, description, icone, couleur, is_active } = req.body;
        // Vérifier que la catégorie existe
        const [existing] = await pool.execute('SELECT id, nom FROM categories WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Catégorie non trouvée' });
        }
        // Vérifier que le nouveau nom n'existe pas déjà (si changé)
        if (nom && nom !== existing[0].nom) {
            const [duplicate] = await pool.execute('SELECT id FROM categories WHERE nom = ? AND id != ?', [nom, id]);
            if (duplicate.length > 0) {
                return res.status(400).json({ error: 'Une catégorie avec ce nom existe déjà' });
            }
        }
        // Construire la requête de mise à jour
        const updates = [];
        const params = [];
        if (nom) {
            updates.push('nom = ?');
            params.push(nom);
        }
        if (description) {
            updates.push('description = ?');
            params.push(description);
        }
        if (icone) {
            updates.push('icone = ?');
            params.push(icone);
        }
        if (couleur) {
            updates.push('couleur = ?');
            params.push(couleur);
        }
        if (typeof is_active === 'boolean') {
            updates.push('is_active = ?');
            params.push(is_active);
        }
        if (updates.length === 0) {
            return res.status(400).json({ error: 'Aucune donnée à mettre à jour' });
        }
        updates.push('updated_at = NOW()');
        params.push(id);
        await pool.execute(`UPDATE categories SET ${updates.join(', ')} WHERE id = ?`, params);
        // Log de l'action admin
        await pool.execute(`INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, created_at) 
       VALUES (?, 'category_updated', 'category', ?, ?, NOW())`, [
            req.user.id,
            id,
            JSON.stringify({ nom, description, is_active })
        ]);
        res.json({ success: true, message: 'Catégorie mise à jour' });
    }
    catch (error) {
        console.error('Erreur modification catégorie:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
// DELETE /api/admin/categories/:id - Supprimer une catégorie
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // Vérifier que la catégorie existe
        const [categories] = await pool.execute('SELECT id, nom FROM categories WHERE id = ?', [id]);
        if (categories.length === 0) {
            return res.status(404).json({ error: 'Catégorie non trouvée' });
        }
        // Vérifier s'il y a des services associés
        const [services] = await pool.execute(`SELECT COUNT(*) as count FROM services s
       JOIN sous_categories sc ON s.sous_categorie_id = sc.id
       WHERE sc.categorie_id = ? AND s.deleted_at IS NULL`, [id]);
        if (services[0].count > 0) {
            return res.status(400).json({
                error: 'Impossible de supprimer une catégorie contenant des services'
            });
        }
        // Supprimer les sous-catégories associées
        await pool.execute('DELETE FROM sous_categories WHERE categorie_id = ?', [id]);
        // Supprimer la catégorie
        await pool.execute('DELETE FROM categories WHERE id = ?', [id]);
        // Log de l'action admin
        await pool.execute(`INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, created_at) 
       VALUES (?, 'category_deleted', 'category', ?, ?, NOW())`, [
            req.user.id,
            id,
            JSON.stringify({ nom: categories[0].nom })
        ]);
        res.json({ success: true, message: 'Catégorie supprimée' });
    }
    catch (error) {
        console.error('Erreur suppression catégorie:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
// GET /api/admin/categories/subcategories - Récupérer toutes les sous-catégories
router.get('/subcategories/all', async (req, res) => {
    try {
        const { categorie_id, include_inactive = false } = req.query;
        let whereClause = 'WHERE 1=1';
        const params = [];
        if (categorie_id) {
            whereClause += ' AND sc.categorie_id = ?';
            params.push(categorie_id);
        }
        if (!include_inactive) {
            whereClause += ' AND sc.is_active = 1';
        }
        const query = `
      SELECT 
        sc.*,
        c.nom as categorie_nom,
        COUNT(s.id) as nombre_services
      FROM sous_categories sc
      LEFT JOIN categories c ON sc.categorie_id = c.id
      LEFT JOIN services s ON sc.id = s.sous_categorie_id AND s.deleted_at IS NULL
      ${whereClause}
      GROUP BY sc.id
      ORDER BY c.nom ASC, sc.nom ASC
    `;
        const [sousCategories] = await pool.execute(query, params);
        res.json(sousCategories);
    }
    catch (error) {
        console.error('Erreur récupération sous-catégories:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
// POST /api/admin/categories/:id/subcategories - Créer une sous-catégorie
router.post('/:id/subcategories', async (req, res) => {
    try {
        const { id: categorieId } = req.params;
        const { nom, description } = req.body;
        // Validation
        if (!nom || !description) {
            return res.status(400).json({ error: 'Nom et description requis' });
        }
        // Vérifier que la catégorie existe
        const [categories] = await pool.execute('SELECT id FROM categories WHERE id = ?', [categorieId]);
        if (categories.length === 0) {
            return res.status(404).json({ error: 'Catégorie non trouvée' });
        }
        // Vérifier que le nom n'existe pas déjà dans cette catégorie
        const [existing] = await pool.execute('SELECT id FROM sous_categories WHERE nom = ? AND categorie_id = ?', [nom, categorieId]);
        if (existing.length > 0) {
            return res.status(400).json({
                error: 'Une sous-catégorie avec ce nom existe déjà dans cette catégorie'
            });
        }
        // Créer la sous-catégorie
        const [result] = await pool.execute(`INSERT INTO sous_categories (nom, description, categorie_id, is_active, created_at, updated_at)
       VALUES (?, ?, ?, 1, NOW(), NOW())`, [nom, description, categorieId]);
        // Log de l'action admin
        await pool.execute(`INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, created_at) 
       VALUES (?, 'subcategory_created', 'subcategory', ?, ?, NOW())`, [
            req.user.id,
            result.insertId,
            JSON.stringify({ nom, description, categorie_id: categorieId })
        ]);
        res.status(201).json({
            success: true,
            message: 'Sous-catégorie créée',
            id: result.insertId
        });
    }
    catch (error) {
        console.error('Erreur création sous-catégorie:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
// PUT /api/admin/categories/subcategories/:id - Modifier une sous-catégorie
router.put('/subcategories/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nom, description, is_active } = req.body;
        // Vérifier que la sous-catégorie existe
        const [existing] = await pool.execute('SELECT id, nom, categorie_id FROM sous_categories WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Sous-catégorie non trouvée' });
        }
        // Construire la requête de mise à jour
        const updates = [];
        const params = [];
        if (nom) {
            // Vérifier que le nouveau nom n'existe pas déjà dans la même catégorie
            if (nom !== existing[0].nom) {
                const [duplicate] = await pool.execute('SELECT id FROM sous_categories WHERE nom = ? AND categorie_id = ? AND id != ?', [nom, existing[0].categorie_id, id]);
                if (duplicate.length > 0) {
                    return res.status(400).json({
                        error: 'Une sous-catégorie avec ce nom existe déjà dans cette catégorie'
                    });
                }
            }
            updates.push('nom = ?');
            params.push(nom);
        }
        if (description) {
            updates.push('description = ?');
            params.push(description);
        }
        if (typeof is_active === 'boolean') {
            updates.push('is_active = ?');
            params.push(is_active);
        }
        if (updates.length === 0) {
            return res.status(400).json({ error: 'Aucune donnée à mettre à jour' });
        }
        updates.push('updated_at = NOW()');
        params.push(id);
        await pool.execute(`UPDATE sous_categories SET ${updates.join(', ')} WHERE id = ?`, params);
        // Log de l'action admin
        await pool.execute(`INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, created_at) 
       VALUES (?, 'subcategory_updated', 'subcategory', ?, ?, NOW())`, [
            req.user.id,
            id,
            JSON.stringify({ nom, description, is_active })
        ]);
        res.json({ success: true, message: 'Sous-catégorie mise à jour' });
    }
    catch (error) {
        console.error('Erreur modification sous-catégorie:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
// DELETE /api/admin/categories/subcategories/:id - Supprimer une sous-catégorie
router.delete('/subcategories/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // Vérifier que la sous-catégorie existe
        const [sousCategories] = await pool.execute('SELECT id, nom FROM sous_categories WHERE id = ?', [id]);
        if (sousCategories.length === 0) {
            return res.status(404).json({ error: 'Sous-catégorie non trouvée' });
        }
        // Vérifier s'il y a des services associés
        const [services] = await pool.execute('SELECT COUNT(*) as count FROM services WHERE sous_categorie_id = ? AND deleted_at IS NULL', [id]);
        if (services[0].count > 0) {
            return res.status(400).json({
                error: 'Impossible de supprimer une sous-catégorie contenant des services'
            });
        }
        // Supprimer la sous-catégorie
        await pool.execute('DELETE FROM sous_categories WHERE id = ?', [id]);
        // Log de l'action admin
        await pool.execute(`INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, created_at) 
       VALUES (?, 'subcategory_deleted', 'subcategory', ?, ?, NOW())`, [
            req.user.id,
            id,
            JSON.stringify({ nom: sousCategories[0].nom })
        ]);
        res.json({ success: true, message: 'Sous-catégorie supprimée' });
    }
    catch (error) {
        console.error('Erreur suppression sous-catégorie:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});
export default router;
