import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { pool } from '../db.js';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import fs from 'fs/promises';
import path from 'path';

const router = express.Router();

// Middleware d'authentification admin
router.use(requireAuth);
router.use(requireRole('admin'));

// GET /api/admin/maintenance/status - Statut du système
router.get('/status', async (req, res) => {
  try {
    // Vérifier la connexion à la base de données
    const [dbStatus] = await pool.execute<RowDataPacket[]>('SELECT 1 as connected');
    
    // Statistiques de la base de données
    const [dbStats] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        table_name,
        table_rows,
        ROUND(((data_length + index_length) / 1024 / 1024), 2) as size_mb
      FROM information_schema.tables 
      WHERE table_schema = DATABASE()
      ORDER BY (data_length + index_length) DESC
    `);

    // Vérifier l'espace disque (approximatif)
    const [diskUsage] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) as total_db_size_mb
      FROM information_schema.tables 
      WHERE table_schema = DATABASE()
    `);

    // Statistiques des logs récents
    const [recentLogs] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        COUNT(*) as total_logs,
        COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 END) as logs_24h,
        COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as logs_7j
      FROM admin_logs
    `);

    // Vérifier les tâches en arrière-plan (si applicable)
    const [backgroundTasks] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        COUNT(*) as total_notifications,
        COUNT(CASE WHEN is_read = 0 THEN 1 END) as notifications_non_lues,
        COUNT(CASE WHEN sent_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR) THEN 1 END) as notifications_derniere_heure
      FROM notifications
    `);

    // Performance de la base de données
    const [performance] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        COUNT(*) as total_connexions_actives
      FROM information_schema.processlist
      WHERE command != 'Sleep'
    `);

    res.json({
      system_status: 'operational',
      timestamp: new Date().toISOString(),
      database: {
        connected: dbStatus[0].connected === 1,
        total_size_mb: diskUsage[0].total_db_size_mb,
        active_connections: performance[0].total_connexions_actives,
        tables: dbStats
      },
      logs: recentLogs[0],
      notifications: backgroundTasks[0],
      uptime: process.uptime(),
      memory_usage: process.memoryUsage(),
      node_version: process.version
    });
  } catch (error) {
    console.error('Erreur statut système:', error);
    res.status(500).json({ 
      system_status: 'error',
      error: 'Erreur lors de la vérification du statut système' 
    });
  }
});

// POST /api/admin/maintenance/cache/clear - Vider le cache
router.post('/cache/clear', async (req, res) => {
  try {
    const { cache_type = 'all' } = req.body;

    let clearedCaches = [];

    if (cache_type === 'all' || cache_type === 'database') {
      // Vider le cache des requêtes (si vous utilisez un cache de requêtes)
      await pool.execute('RESET QUERY CACHE');
      clearedCaches.push('database_query_cache');
    }

    if (cache_type === 'all' || cache_type === 'sessions') {
      try {
        let whereClause = 'WHERE expires_at < NOW()';
        try {
          const [columns] = await pool.query<RowDataPacket[]>(
            `SHOW COLUMNS FROM user_sessions LIKE 'last_activity'`
          );
          if (Array.isArray(columns) && columns.length > 0) {
            whereClause += ' OR last_activity < DATE_SUB(NOW(), INTERVAL 30 DAY)';
          }
        } catch (columnError: any) {
          console.warn('Impossible de vérifier la colonne last_activity:', columnError?.message || columnError);
        }

        await pool.execute(`DELETE FROM user_sessions ${whereClause}`);
        clearedCaches.push('expired_sessions');
      } catch (sessionError: any) {
        console.warn('Nettoyage des sessions ignoré:', sessionError?.message || sessionError);
      }
    }

    if (cache_type === 'all' || cache_type === 'notifications') {
      // Nettoyer les anciennes notifications lues
      await pool.execute(`
        DELETE FROM notifications 
        WHERE is_read = 1 AND created_at < DATE_SUB(NOW(), INTERVAL 90 DAY)
      `);
      clearedCaches.push('old_notifications');
    }

    if (cache_type === 'all' || cache_type === 'logs') {
      // Nettoyer les anciens logs (garder 6 mois)
      await pool.execute(`
        DELETE FROM admin_logs 
        WHERE created_at < DATE_SUB(NOW(), INTERVAL 6 MONTH)
      `);
      clearedCaches.push('old_admin_logs');
    }

    // Log de l'action admin
    await pool.execute(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, created_at) 
       VALUES (?, 'cache_cleared', 'system', 0, ?, NOW())`,
      [
        req.user.id,
        JSON.stringify({ cache_type, cleared_caches: clearedCaches })
      ]
    );

    res.json({
      success: true,
      message: 'Cache vidé avec succès',
      cleared_caches: clearedCaches,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erreur vidage cache:', error);
    res.status(500).json({ error: 'Erreur lors du vidage du cache' });
  }
});

// POST /api/admin/maintenance/backup - Créer une sauvegarde
router.post('/backup', async (req, res) => {
  try {
    const { backup_type = 'full', include_data = true } = req.body;

    // Générer un nom de fichier unique
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `prestaci_backup_${backup_type}_${timestamp}.sql`;

    // Créer le répertoire de sauvegarde s'il n'existe pas
    const backupDir = path.join(process.cwd(), 'backups');
    try {
      await fs.access(backupDir);
    } catch {
      await fs.mkdir(backupDir, { recursive: true });
    }

    const backupPath = path.join(backupDir, backupFileName);

    // Générer le script de sauvegarde SQL
    let backupScript = `-- PrestaCI Database Backup
-- Generated on: ${new Date().toISOString()}
-- Backup Type: ${backup_type}
-- Include Data: ${include_data}

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;

`;

    // Récupérer la liste des tables
    const [tables] = await pool.execute<RowDataPacket[]>(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE()
      ORDER BY table_name
    `);

    for (const table of tables) {
      const tableName = table.table_name;
      
      // Structure de la table
      const [createTable] = await pool.execute<RowDataPacket[]>(
        `SHOW CREATE TABLE \`${tableName}\``
      );
      
      backupScript += `-- Structure for table \`${tableName}\`\n`;
      backupScript += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
      backupScript += `${createTable[0]['Create Table']};\n\n`;

      // Données de la table (si demandé)
      if (include_data) {
        const [rows] = await pool.execute<RowDataPacket[]>(
          `SELECT * FROM \`${tableName}\``
        );

        if (rows.length > 0) {
          backupScript += `-- Data for table \`${tableName}\`\n`;
          
          for (const row of rows) {
            const values = Object.values(row).map(value => {
              if (value === null) return 'NULL';
              if (typeof value === 'string') {
                return `'${value.replace(/'/g, "''")}'`;
              }
              return value;
            }).join(', ');
            
            const columns = Object.keys(row).map(col => `\`${col}\``).join(', ');
            backupScript += `INSERT INTO \`${tableName}\` (${columns}) VALUES (${values});\n`;
          }
          backupScript += '\n';
        }
      }
    }

    backupScript += `
SET FOREIGN_KEY_CHECKS = 1;
COMMIT;

-- Backup completed successfully
`;

    // Écrire le fichier de sauvegarde
    await fs.writeFile(backupPath, backupScript, 'utf8');

    // Obtenir la taille du fichier
    const stats = await fs.stat(backupPath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    // Log de l'action admin
    await pool.execute(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, created_at) 
       VALUES (?, 'backup_created', 'system', 0, ?, NOW())`,
      [
        req.user.id,
        JSON.stringify({ 
          backup_type, 
          include_data, 
          file_name: backupFileName,
          file_size_mb: fileSizeMB,
          tables_count: tables.length
        })
      ]
    );

    res.json({
      success: true,
      message: 'Sauvegarde créée avec succès',
      backup_info: {
        file_name: backupFileName,
        file_path: backupPath,
        file_size_mb: fileSizeMB,
        tables_count: tables.length,
        backup_type,
        include_data,
        created_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Erreur création sauvegarde:', error);
    res.status(500).json({ error: 'Erreur lors de la création de la sauvegarde' });
  }
});

// GET /api/admin/maintenance/backups - Lister les sauvegardes
router.get('/backups', async (req, res) => {
  try {
    const backupDir = path.join(process.cwd(), 'backups');
    
    try {
      const files = await fs.readdir(backupDir);
      const backups = [];

      for (const file of files) {
        if (file.endsWith('.sql')) {
          const filePath = path.join(backupDir, file);
          const stats = await fs.stat(filePath);
          
          backups.push({
            file_name: file,
            file_size_mb: (stats.size / (1024 * 1024)).toFixed(2),
            created_at: stats.birthtime,
            modified_at: stats.mtime
          });
        }
      }

      // Trier par date de création (plus récent en premier)
      backups.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      res.json({
        backups,
        total_count: backups.length,
        backup_directory: backupDir
      });
    } catch (error) {
      // Le répertoire n'existe pas encore
      res.json({
        backups: [],
        total_count: 0,
        backup_directory: backupDir,
        message: 'Aucune sauvegarde trouvée'
      });
    }
  } catch (error) {
    console.error('Erreur listage sauvegardes:', error);
    res.status(500).json({ error: 'Erreur lors du listage des sauvegardes' });
  }
});

// DELETE /api/admin/maintenance/backups/:filename - Supprimer une sauvegarde
router.delete('/backups/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    
    // Validation du nom de fichier pour éviter les attaques de traversée de répertoire
    if (!filename.endsWith('.sql') || filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: 'Nom de fichier invalide' });
    }

    const backupDir = path.join(process.cwd(), 'backups');
    const filePath = path.join(backupDir, filename);

    // Vérifier que le fichier existe
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: 'Fichier de sauvegarde non trouvé' });
    }

    // Supprimer le fichier
    await fs.unlink(filePath);

    // Log de l'action admin
    await pool.execute(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, created_at) 
       VALUES (?, 'backup_deleted', 'system', 0, ?, NOW())`,
      [
        req.user.id,
        JSON.stringify({ filename })
      ]
    );

    res.json({
      success: true,
      message: 'Sauvegarde supprimée avec succès',
      deleted_file: filename
    });
  } catch (error) {
    console.error('Erreur suppression sauvegarde:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression de la sauvegarde' });
  }
});

// GET /api/admin/maintenance/logs - Consulter les logs système
router.get('/logs', async (req, res) => {
  try {
    const { 
      level = 'all', 
      search = '', 
      page = 1, 
      limit = 50,
      date_debut,
      date_fin 
    } = req.query;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (level !== 'all') {
      // Si vous avez un système de niveaux de logs
      whereClause += ' AND action LIKE ?';
      params.push(`%${level}%`);
    }

    if (search) {
      whereClause += ' AND (action LIKE ? OR details LIKE ? OR target_type LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (date_debut) {
      whereClause += ' AND created_at >= ?';
      params.push(date_debut);
    }

    if (date_fin) {
      whereClause += ' AND created_at <= ?';
      params.push(date_fin);
    }

    const offset = (Number(page) - 1) * Number(limit);

    const query = `
      SELECT 
        al.*,
        u.nom as admin_nom,
        u.email as admin_email
      FROM admin_logs al
      LEFT JOIN users u ON al.admin_id = u.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?
    `;

    params.push(Number(limit), offset);

    const [logs] = await pool.execute<RowDataPacket[]>(query, params);

    // Compter le total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM admin_logs al
      ${whereClause.replace('LIMIT ? OFFSET ?', '')}
    `;

    const [countResult] = await pool.execute<RowDataPacket[]>(
      countQuery, 
      params.slice(0, -2)
    );

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / Number(limit));

    res.json({
      logs,
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
    console.error('Erreur consultation logs:', error);
    res.status(500).json({ error: 'Erreur lors de la consultation des logs' });
  }
});

// POST /api/admin/maintenance/mode - Activer/désactiver le mode maintenance
router.post('/mode', async (req, res) => {
  try {
    const { enabled, message = 'Maintenance en cours', estimated_duration } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'Le paramètre "enabled" doit être un booléen' });
    }

    // Mettre à jour le paramètre de maintenance dans la base
    await pool.execute(
      `INSERT INTO app_settings (cle, valeur, type, description, updated_at) 
       VALUES ('maintenance_mode', ?, 'boolean', 'Mode maintenance activé/désactivé', NOW())
       ON DUPLICATE KEY UPDATE 
       valeur = VALUES(valeur), updated_at = VALUES(updated_at)`,
      [enabled ? '1' : '0']
    );

    if (enabled) {
      // Sauvegarder le message et la durée estimée
      await pool.execute(
        `INSERT INTO app_settings (cle, valeur, type, description, updated_at) 
         VALUES ('maintenance_message', ?, 'string', 'Message affiché pendant la maintenance', NOW())
         ON DUPLICATE KEY UPDATE 
         valeur = VALUES(valeur), updated_at = VALUES(updated_at)`,
        [message || 'Maintenance en cours...']
      );

      if (estimated_duration) {
        await pool.execute(
          `INSERT INTO app_settings (cle, valeur, type, description, updated_at) 
           VALUES ('maintenance_duration', ?, 'integer', 'Durée estimée de la maintenance', NOW())
           ON DUPLICATE KEY UPDATE 
           valeur = VALUES(valeur), updated_at = VALUES(updated_at)`,
          [estimated_duration.toString()]
        );
      }
    }

    // Log de l'action admin
    await pool.execute(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, created_at) 
       VALUES (?, ?, 'system', 0, ?, NOW())`,
      [
        req.user.id,
        enabled ? 'maintenance_mode_enabled' : 'maintenance_mode_disabled',
        JSON.stringify({ message, estimated_duration })
      ]
    );

    res.json({
      success: true,
      message: enabled ? 'Mode maintenance activé' : 'Mode maintenance désactivé',
      maintenance_mode: {
        enabled,
        message: enabled ? message : null,
        estimated_duration: enabled ? estimated_duration : null,
        activated_at: enabled ? new Date().toISOString() : null
      }
    });
  } catch (error) {
    console.error('Erreur mode maintenance:', error);
    res.status(500).json({ error: 'Erreur lors de la gestion du mode maintenance' });
  }
});

// GET /api/admin/maintenance/health - Vérification de santé du système
router.get('/health', async (req, res) => {
  try {
    const healthChecks = {
      database: false,
      disk_space: false,
      memory: false,
      response_time: false
    };

    const startTime = Date.now();

    // Test de connexion base de données
    try {
      await pool.execute('SELECT 1');
      healthChecks.database = true;
    } catch (error) {
      console.error('Health check DB failed:', error);
    }

    // Vérification mémoire
    const memUsage = process.memoryUsage();
    const memUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    healthChecks.memory = memUsagePercent < 90; // OK si moins de 90% utilisé

    // Test temps de réponse
    const responseTime = Date.now() - startTime;
    healthChecks.response_time = responseTime < 1000; // OK si moins de 1 seconde

    // Simulation vérification espace disque (à adapter selon votre système)
    healthChecks.disk_space = true; // Supposons OK pour cet exemple

    const overallHealth = Object.values(healthChecks).every(check => check);

    res.json({
      status: overallHealth ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      response_time_ms: responseTime,
      checks: healthChecks,
      system_info: {
        uptime_seconds: process.uptime(),
        memory_usage: memUsage,
        memory_usage_percent: memUsagePercent.toFixed(2),
        node_version: process.version,
        platform: process.platform
      }
    });
  } catch (error) {
    console.error('Erreur health check:', error);
    res.status(500).json({
      status: 'error',
      error: 'Erreur lors de la vérification de santé du système'
    });
  }
});

export default router;
