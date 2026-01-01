import { Router, Request, Response } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { promises as fs } from 'fs';
import path from 'path';

const router = Router();
const PROJECT_ROOT = process.cwd();
const BACKUP_DIR = path.resolve(PROJECT_ROOT, 'backups');
const LOG_FILE = path.resolve(PROJECT_ROOT, 'logs/app.log');
const CACHE_DIRS = [
  path.resolve(PROJECT_ROOT, 'tmp/cache'),
  path.resolve(PROJECT_ROOT, '.cache')
];

// Middleware pour vérifier les droits admin
async function requireAdmin(req: Request, res: Response, next: Function) {
  try {
    await requireAuth(req, res, () => {});
    if (!req.userId) return;

    // Vérifier que l'utilisateur est admin (role_id = 3)
    const [rows]: any = await pool.query(
      'SELECT role_id FROM users WHERE id = ? LIMIT 1',
      [req.userId]
    );

    if (rows.length === 0 || rows[0].role_id !== 3) {
      return res.status(403).json({ error: 'Accès administrateur requis' });
    }

    next();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}

async function upsertSettingValue(key: string, value: string, description?: string | null) {
  const [existing]: any = await pool.query(
    'SELECT id FROM app_settings WHERE cle = ? LIMIT 1',
    [key]
  );

  if (existing.length > 0) {
    await pool.query(
      'UPDATE app_settings SET valeur = ?, description = COALESCE(?, description), updated_at = NOW() WHERE cle = ?',
      [value, description, key]
    );
  } else {
    await pool.query(
      'INSERT INTO app_settings (cle, valeur, description, updated_at) VALUES (?, ?, ?, NOW())',
      [key, value, description || null]
    );
  }
}

// GET /api/admin/settings - Récupérer tous les paramètres
router.get('/settings', requireAdmin, async (req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query(
      'SELECT cle, valeur, description FROM app_settings ORDER BY cle'
    );

    // Convertir en objet pour faciliter l'utilisation
    const settings: Record<string, any> = {};
    rows.forEach((row: any) => {
      let value = row.valeur;
      
      // Essayer de parser les valeurs JSON
      try {
        value = JSON.parse(row.valeur);
      } catch {
        // Garder la valeur string si ce n'est pas du JSON
      }
      
      settings[row.cle] = {
        value,
        description: row.description
      };
    });

    res.json(settings);
  } catch (e: any) {
    console.error('Erreur récupération paramètres:', e);
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/admin/settings - Mettre à jour un paramètre
router.put('/settings/:key', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const { value, description } = req.body;

    if (!key || value === undefined) {
      return res.status(400).json({ error: 'Clé et valeur requises' });
    }

    // Convertir la valeur en string pour le stockage
    const valueString = typeof value === 'string' ? value : JSON.stringify(value);

    await upsertSettingValue(key, valueString, description || null);

    res.json({ ok: true, message: 'Paramètre mis à jour' });
  } catch (e: any) {
    console.error('Erreur mise à jour paramètre:', e);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/admin/settings/:key - Supprimer un paramètre
router.delete('/settings/:key', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { key } = req.params;

    const [result]: any = await pool.query(
      'DELETE FROM app_settings WHERE cle = ?',
      [key]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Paramètre introuvable' });
    }

    res.json({ ok: true, message: 'Paramètre supprimé' });
  } catch (e: any) {
    console.error('Erreur suppression paramètre:', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/admin/settings/reset - Réinitialiser aux valeurs par défaut
router.post('/settings/reset', requireAdmin, async (req: Request, res: Response) => {
  try {
    // Paramètres par défaut
    const defaultSettings = [
      { cle: 'session_duration_hours', valeur: '24', description: 'Durée des sessions en heures' },
      { cle: 'maintenance_mode', valeur: 'false', description: 'Mode maintenance activé' },
      { cle: 'max_file_size_mb', valeur: '10', description: 'Taille maximale des fichiers en MB' },
      { cle: 'notifications_enabled', valeur: 'true', description: 'Notifications activées' },
      { cle: 'default_currency', valeur: 'XOF', description: 'Devise par défaut' },
      { cle: 'max_services_free', valeur: '2', description: 'Nombre max de services gratuits' },
      { cle: 'app_version', valeur: '1.0.0', description: 'Version de l\'application' },
      { cle: 'terms_version', valeur: '1.0', description: 'Version des conditions d\'utilisation' }
    ];

    // Supprimer tous les paramètres existants
    await pool.query('DELETE FROM app_settings');

    // Insérer les paramètres par défaut
    for (const setting of defaultSettings) {
      await pool.query(
        'INSERT INTO app_settings (cle, valeur, description, updated_at) VALUES (?, ?, ?, NOW())',
        [setting.cle, setting.valeur, setting.description]
      );
    }

    res.json({ 
      ok: true, 
      message: 'Paramètres réinitialisés',
      count: defaultSettings.length 
    });
  } catch (e: any) {
    console.error('Erreur réinitialisation paramètres:', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/maintenance/status', requireAdmin, async (req: Request, res: Response) => {
  try {
    const [[modeRow]]: any = await pool.query(
      'SELECT valeur FROM app_settings WHERE cle = ? LIMIT 1',
      ['maintenance_mode']
    );
    const [[backupRow]]: any = await pool.query(
      'SELECT valeur FROM app_settings WHERE cle = ? LIMIT 1',
      ['maintenance_last_backup']
    );
    const [[cacheRow]]: any = await pool.query(
      'SELECT valeur FROM app_settings WHERE cle = ? LIMIT 1',
      ['maintenance_last_cache_clear']
    );

    const maintenanceMode = (modeRow?.valeur || 'false') === 'true';
    let lastBackupAt: string | null = null;
    let lastBackupFile: string | null = null;
    if (backupRow?.valeur) {
      try {
        const parsed = JSON.parse(backupRow.valeur);
        lastBackupAt = parsed.created_at || parsed.timestamp || null;
        lastBackupFile = parsed.file || null;
      } catch {
        lastBackupAt = backupRow.valeur;
      }
    }

    let lastCacheClearAt: string | null = null;
    if (cacheRow?.valeur) {
      try {
        const parsed = JSON.parse(cacheRow.valeur);
        lastCacheClearAt = parsed.cleared_at || parsed.timestamp || null;
      } catch {
        lastCacheClearAt = cacheRow.valeur;
      }
    }

    res.json({
      maintenanceMode,
      lastBackupAt,
      lastBackupFile,
      lastCacheClearAt
    });
  } catch (e: any) {
    console.error('Erreur statut maintenance:', e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/maintenance/clear-cache', requireAdmin, async (req: Request, res: Response) => {
  try {
    for (const dir of CACHE_DIRS) {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
      await fs.mkdir(dir, { recursive: true });
    }

    const clearedAt = new Date().toISOString();
    await upsertSettingValue(
      'maintenance_last_cache_clear',
      JSON.stringify({ cleared_at: clearedAt }),
      'Dernier vidage du cache'
    );

    res.json({ ok: true, clearedAt });
  } catch (e: any) {
    console.error('Erreur vidage cache:', e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/maintenance/backup', requireAdmin, async (req: Request, res: Response) => {
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    const timestamp = new Date().toISOString();
    const safeName = timestamp.replace(/[:.]/g, '-');

    const [settings]: any = await pool.query('SELECT cle, valeur, description FROM app_settings ORDER BY cle');
    const [userCount]: any = await pool.query('SELECT COUNT(*) as total_users FROM users');
    const [serviceCount]: any = await pool.query('SELECT COUNT(*) as total_services FROM services');
    const [reservationCount]: any = await pool.query('SELECT COUNT(*) as total_reservations FROM reservations');

    const payload = {
      generatedAt: timestamp,
      settings,
      summary: {
        users: userCount[0]?.total_users || 0,
        services: serviceCount[0]?.total_services || 0,
        reservations: reservationCount[0]?.total_reservations || 0
      }
    };

    const fileName = `admin-backup-${safeName}.json`;
    const filePath = path.join(BACKUP_DIR, fileName);
    await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');

    await upsertSettingValue(
      'maintenance_last_backup',
      JSON.stringify({ file: fileName, created_at: timestamp }),
      'Dernière sauvegarde'
    );

    res.json({ ok: true, file: fileName, createdAt: timestamp });
  } catch (e: any) {
    console.error('Erreur création sauvegarde:', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/maintenance/logs', requireAdmin, async (req: Request, res: Response) => {
  try {
    let logs = 'Aucun journal disponible';
    try {
      const content = await fs.readFile(LOG_FILE, 'utf-8');
      const lines = content.trim().split(/\r?\n/);
      logs = lines.slice(-200).join('\n') || logs;
    } catch {
      // ignore
    }
    res.json({ ok: true, logs });
  } catch (e: any) {
    console.error('Erreur lecture logs:', e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/maintenance/maintenance-mode', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'Valeur booléenne requise' });
    }

    await upsertSettingValue(
      'maintenance_mode',
      enabled ? 'true' : 'false',
      'Mode maintenance global'
    );

    res.json({ ok: true, maintenanceMode: enabled });
  } catch (e: any) {
    console.error('Erreur mise à jour mode maintenance:', e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/admin/stats - Statistiques générales de l'application
router.get('/stats', requireAdmin, async (req: Request, res: Response) => {
  try {
    const [userStats]: any = await pool.query(`
      SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN role_id = 1 THEN 1 ELSE 0 END) as clients,
        SUM(CASE WHEN role_id = 2 THEN 1 ELSE 0 END) as prestataires,
        SUM(CASE WHEN role_id = 3 THEN 1 ELSE 0 END) as admins
      FROM users
    `);

    const [serviceStats]: any = await pool.query(`
      SELECT 
        COUNT(*) as total_services,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as services_actifs
      FROM services
    `);

    const [reservationStats]: any = await pool.query(`
      SELECT 
        COUNT(*) as total_reservations,
        SUM(CASE WHEN statut_id = 2 THEN 1 ELSE 0 END) as confirmees,
        SUM(CASE WHEN statut_id = 1 THEN 1 ELSE 0 END) as en_attente
      FROM reservations
    `);

    const [notificationStats]: any = await pool.query(`
      SELECT 
        COUNT(*) as total_notifications,
        SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as non_lues
      FROM notifications
    `);

    res.json({
      users: userStats[0],
      services: serviceStats[0],
      reservations: reservationStats[0],
      notifications: notificationStats[0],
      generated_at: new Date().toISOString()
    });
  } catch (e: any) {
    console.error('Erreur statistiques admin:', e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
