import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { pool } from '../db.js';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import type { PoolConnection } from 'mysql2/promise';

const router = express.Router();

const getSingleQueryParam = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    const [first] = value;
    return typeof first === 'string' ? first : undefined;
  }
  return undefined;
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

// Middleware d'authentification admin
router.use(requireAuth);
router.use(requireRole('admin'));

// Interface pour les notifications
interface NotificationRow extends RowDataPacket {
  id: number;
  user_id: number;
  template_id?: number;
  titre: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  is_read: boolean;
  data?: any;
  sent_at: string;
  read_at?: string;
  user_nom?: string;
  user_email?: string;
}

interface NotificationTemplateRow extends RowDataPacket {
  id: number;
  nom: string;
  titre: string;
  message: string;
  variables?: string | null;
  is_active: number;
  created_at: string;
  type?: 'info' | 'success' | 'warning' | 'error';
}

type NotificationType = 'info' | 'success' | 'warning' | 'error';

const parseTemplateVariables = (raw: any): string[] => {
  if (!raw) {
    return [];
  }
  if (Array.isArray(raw)) {
    return raw;
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const DEFAULT_TEMPLATE_TYPES: Record<string, NotificationType> = {
  reservation_confirmee: 'success',
  reservation_acceptee: 'success',
  reservation_refusee: 'error',
  rappel_rdv: 'warning',
  nouvelle_reservation: 'info',
  paiement_valide: 'success'
};

// GET /api/admin/notifications - Récupérer toutes les notifications
router.get('/', async (req, res) => {
  try {
    const typeFilter = getSingleQueryParam(req.query.type) ?? 'all';
    const searchTerm = getSingleQueryParam(req.query.search)?.trim() ?? '';
    const pageParam = parseInt(getSingleQueryParam(req.query.page) ?? '1', 10);
    const limitParam = parseInt(getSingleQueryParam(req.query.limit) ?? '20', 10);
    const userIdParam = getSingleQueryParam(req.query.user_id);
    const isReadParam = getSingleQueryParam(req.query.is_read);
    const dateDebutParam = getSingleQueryParam(req.query.date_debut);
    const dateFinParam = getSingleQueryParam(req.query.date_fin);

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    // Filtres
    if (typeFilter && typeFilter !== 'all') {
      whereClause += ' AND n.type = ?';
      params.push(typeFilter);
    }

    if (searchTerm !== '') {
      whereClause += ` AND (
        u.nom LIKE ? OR u.email LIKE ? OR 
        n.titre LIKE ? OR n.message LIKE ?
      )`;
      const wildcard = `%${searchTerm}%`;
      params.push(wildcard, wildcard, wildcard, wildcard);
    }

    const parsedUserId = userIdParam ? Number(userIdParam) : NaN;
    if (!Number.isNaN(parsedUserId)) {
      whereClause += ' AND n.user_id = ?';
      params.push(parsedUserId);
    }

    if (typeof isReadParam === 'string') {
      whereClause += ' AND n.is_read = ?';
      params.push(isReadParam === 'true' ? 1 : 0);
    }

    if (dateDebutParam) {
      whereClause += ' AND DATE(n.sent_at) >= ?';
      params.push(dateDebutParam);
    }

    if (dateFinParam) {
      whereClause += ' AND DATE(n.sent_at) <= ?';
      params.push(dateFinParam);
    }

    const pageNumber = Math.max(1, Number.isNaN(pageParam) ? 1 : pageParam);
    const limitSanitized = Math.max(1, Number.isNaN(limitParam) ? 20 : limitParam);
    const limitNumber = Math.min(limitSanitized, 100); // Limite à 100 max
    const offset = (pageNumber - 1) * limitNumber;

    const query = `
      SELECT 
        n.*,
        u.nom as user_nom,
        u.email as user_email
      FROM notifications n
      LEFT JOIN users u ON n.user_id = u.id
      ${whereClause}
      ORDER BY n.sent_at DESC
      LIMIT ? OFFSET ?
    `;

    params.push(limitNumber, offset);

    const [notifications] = await pool.execute<NotificationRow[]>(query, params);

    // Compter le total pour la pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM notifications n
      LEFT JOIN users u ON n.user_id = u.id
      ${whereClause}
    `;

    const countParams = params.slice(0, -2); // Retirer LIMIT et OFFSET
    const [countResult] = await pool.execute<RowDataPacket[]>(countQuery, countParams);

    const total = countResult[0]?.total || 0;
    const totalPages = Math.ceil(total / limitNumber);

    res.json({
      success: true,
      notifications,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages,
        hasNext: pageNumber < totalPages,
        hasPrev: pageNumber > 1
      }
    });
  } catch (error: any) {
    console.error('Erreur récupération notifications:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erreur serveur lors de la récupération des notifications',
      details: process.env.NODE_ENV === 'development' ? error?.message : undefined
    });
  }
});

// POST /api/admin/notifications/broadcast - Envoyer une notification à tous les utilisateurs
router.post('/broadcast', async (req, res) => {
  let connection: PoolConnection | null = null;
  try {
    const { 
      title, 
      message, 
      type = 'info',
      target_roles = ['all'],
      data = {}
    } = req.body;

    console.log('Données reçues pour broadcast:', { title, message, type, target_roles });

    // Validation des données requises
    if (!title || !title.trim() || !message || !message.trim()) {
      return res.status(400).json({ 
        success: false,
        error: 'Titre et message sont requis et ne peuvent pas être vides',
        received: { title, message }
      });
    }

    // Valider le type
    const validTypes = ['info', 'success', 'warning', 'error'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ 
        success: false,
        error: 'Type invalide. Doit être: info, success, warning ou error',
        received: type,
        validTypes
      });
    }

    // Nettoyer et valider les données
    const cleanTitle = title.trim();
    const cleanMessage = message.trim();
    const cleanTargetRoles = Array.isArray(target_roles) ? target_roles : ['all'];

    // Construire la requête pour récupérer les utilisateurs cibles
    let userQuery = 'SELECT id FROM users WHERE 1=1';
    const userParams: any[] = [];

    if (cleanTargetRoles.length > 0 && !cleanTargetRoles.includes('all')) {
      const roleConditions = [];
      if (cleanTargetRoles.includes('client')) {
        roleConditions.push('role_id = 1');
      }
      if (cleanTargetRoles.includes('prestataire')) {
        roleConditions.push('role_id = 2');
      }
      if (cleanTargetRoles.includes('admin')) {
        roleConditions.push('role_id = 3');
      }
      
      if (roleConditions.length > 0) {
        userQuery += ` AND (${roleConditions.join(' OR ')})`;
      } else {
        // Si aucun rôle valide n'est spécifié, retourner une erreur
        return res.status(400).json({
          success: false,
          error: 'Aucun rôle valide spécifié',
          received: cleanTargetRoles,
          validRoles: ['client', 'prestataire', 'admin', 'all']
        });
      }
    }

    console.log('Query utilisateurs:', userQuery, 'Params:', userParams);

    // Récupérer les utilisateurs cibles
    const [users] = await pool.execute<RowDataPacket[]>(userQuery, userParams);

    if (users.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Aucun utilisateur trouvé pour les critères spécifiés',
        query: userQuery,
        params: userParams
      });
    }

    console.log(`Nombre d'utilisateurs trouvés: ${users.length}`);

    // Préparer et insérer les notifications
    const activeConnection = await pool.getConnection();
    connection = activeConnection;
    await activeConnection.beginTransaction();

    try {
      // Utiliser des batches pour les insertions massives
      const batchSize = 100;
      const batches = [];
      
      for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize);
        const batchPromises = batch.map(user => 
          activeConnection.execute(
            `INSERT INTO notifications (user_id, type, titre, message, data, sent_at) 
             VALUES (?, ?, ?, ?, ?, NOW())`,
            [user.id, type, cleanTitle, cleanMessage, JSON.stringify(data || {})]
          )
        );
        batches.push(Promise.all(batchPromises));
      }

      // Exécuter tous les batches
      await Promise.all(batches);
      await activeConnection.commit();

      console.log(`Notifications insérées avec succès: ${users.length}`);

    } catch (transactionError) {
      if (connection) {
        await connection.rollback();
      }
      console.error('Erreur lors de la transaction:', transactionError);
      const transactionMessage = getErrorMessage(transactionError);
      throw new Error(`Erreur d'insertion des notifications: ${transactionMessage}`);
    } finally {
      if (connection) {
        connection.release();
        connection = null;
      }
    }

    // Log de l'action admin (optionnel)
    try {
      await pool.execute(
        `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, created_at) 
         VALUES (?, 'notification_broadcast', 'notification', 0, ?, NOW())`,
        [
          req.user?.id || 0,
          JSON.stringify({ 
            title: cleanTitle, 
            message: cleanMessage, 
            type, 
            target_roles: cleanTargetRoles, 
            users_count: users.length 
          })
        ]
      );
    } catch (logError) {
      console.log('Log admin non enregistré:', getErrorMessage(logError));
      // Ne pas bloquer si le log échoue
    }

    res.json({ 
      success: true, 
      message: `Notification envoyée à ${users.length} utilisateur(s)`,
      users_count: users.length,
      data: {
        title: cleanTitle,
        message: cleanMessage,
        type,
        target_roles: cleanTargetRoles
      }
    });

  } catch (error: any) {
    console.error('Erreur envoi notification broadcast:', error);
    
    // Rollback si la connexion existe toujours
    if (connection) {
      try {
        await connection.rollback();
        connection.release();
        connection = null;
      } catch (rollbackError: any) {
        console.error('Erreur lors du rollback:', rollbackError?.message);
      }
    }

    res.status(500).json({ 
      success: false,
      error: 'Erreur serveur lors de l\'envoi de la notification',
      details: process.env.NODE_ENV === 'development' ? error?.message : undefined
    });
  }
});

// POST /api/admin/notifications/targeted - Envoyer une notification ciblée
router.post('/targeted', async (req, res) => {
  let connection: PoolConnection | null = null;
  try {
    const { 
      user_ids, 
      title, 
      message, 
      type = 'info',
      data = {}
    } = req.body;

    console.log('Données reçues pour notification ciblée:', { user_ids, title, message, type });

    // Validation
    if (!Array.isArray(user_ids) || user_ids.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Liste d\'IDs utilisateur requise et ne peut pas être vide'
      });
    }

    // Valider que tous les user_ids sont des nombres valides
    const validUserIds = user_ids.filter(id => !isNaN(Number(id)) && Number(id) > 0);
    if (validUserIds.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Aucun ID utilisateur valide fourni'
      });
    }

    if (!title || !title.trim() || !message || !message.trim()) {
      return res.status(400).json({ 
        success: false,
        error: 'Titre et message requis et ne peuvent pas être vides'
      });
    }

    // Valider le type
    const validTypes = ['info', 'success', 'warning', 'error'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ 
        success: false,
        error: 'Type invalide. Doit être: info, success, warning ou error'
      });
    }

    const cleanTitle = title.trim();
    const cleanMessage = message.trim();

    // Vérifier que tous les utilisateurs existent
    const placeholders = validUserIds.map(() => '?').join(',');
    const [users] = await pool.execute<RowDataPacket[]>(
      `SELECT id, nom, email FROM users WHERE id IN (${placeholders})`,
      validUserIds
    );

    if (users.length !== validUserIds.length) {
      const foundIds = users.map(user => user.id);
      const missingIds = validUserIds.filter(id => !foundIds.includes(Number(id)));
      
      return res.status(400).json({ 
        success: false,
        error: 'Certains utilisateurs n\'existent pas',
        missing_ids: missingIds,
        found_count: users.length,
        requested_count: validUserIds.length
      });
    }

    // Insérer les notifications
    const activeConnection = await pool.getConnection();
    connection = activeConnection;
    await activeConnection.beginTransaction();

    try {
      const insertPromises = validUserIds.map(userId => 
        activeConnection.execute(
          `INSERT INTO notifications (user_id, type, titre, message, data, sent_at) 
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [userId, type, cleanTitle, cleanMessage, JSON.stringify(data || {})]
        )
      );

      await Promise.all(insertPromises);
      await activeConnection.commit();

      console.log(`Notifications ciblées insérées: ${validUserIds.length}`);

    } catch (transactionError) {
      if (connection) {
        await connection.rollback();
      }
      console.error('Erreur transaction notification ciblée:', transactionError);
      throw transactionError;
    } finally {
      if (connection) {
        connection.release();
        connection = null;
      }
    }

    // Log de l'action admin
    try {
      await pool.execute(
        `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, created_at) 
         VALUES (?, 'notification_targeted', 'notification', 0, ?, NOW())`,
        [
          req.user?.id || 0,
          JSON.stringify({ 
            title: cleanTitle, 
            message: cleanMessage, 
            type, 
            user_ids: validUserIds, 
            users_count: validUserIds.length 
          })
        ]
      );
    } catch (logError) {
      console.log('Log admin non enregistré:', getErrorMessage(logError));
    }

    res.json({ 
      success: true, 
      message: `Notification envoyée à ${validUserIds.length} utilisateur(s)`,
      users_count: validUserIds.length
    });
  } catch (error: any) {
    console.error('Erreur envoi notification ciblée:', error);
    
    if (connection) {
      try {
        await connection.rollback();
        connection.release();
        connection = null;
      } catch (rollbackError: any) {
        console.error('Erreur rollback:', rollbackError?.message);
      }
    }

    res.status(500).json({ 
      success: false,
      error: 'Erreur serveur lors de l\'envoi de la notification ciblée',
      details: process.env.NODE_ENV === 'development' ? error?.message : undefined
    });
  }
});

// DELETE /api/admin/notifications/:id - Supprimer une notification
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(Number(id)) || Number(id) <= 0) {
      return res.status(400).json({ 
        success: false,
        error: 'ID de notification invalide'
      });
    }

    const notificationId = Number(id);

    // Vérifier que la notification existe
    const [notifications] = await pool.execute<RowDataPacket[]>(
      'SELECT id, titre, user_id FROM notifications WHERE id = ?',
      [notificationId]
    );

    if (notifications.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Notification non trouvée'
      });
    }

    const notification = notifications[0];

    // Supprimer la notification
    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM notifications WHERE id = ?', 
      [notificationId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Notification non trouvée ou déjà supprimée'
      });
    }

    // Log de l'action admin
    try {
      await pool.execute(
        `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, created_at) 
         VALUES (?, 'notification_deleted', 'notification', ?, ?, NOW())`,
        [
          req.user?.id || 0,
          notificationId,
          JSON.stringify({ 
            titre: notification.titre,
            user_id: notification.user_id
          })
        ]
      );
    } catch (logError) {
      console.log('Log admin non enregistré:', getErrorMessage(logError));
    }

    res.json({ 
      success: true, 
      message: 'Notification supprimée avec succès',
      deleted_id: notificationId
    });
  } catch (error: any) {
    console.error('Erreur suppression notification:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erreur serveur lors de la suppression de la notification',
      details: process.env.NODE_ENV === 'development' ? error?.message : undefined
    });
  }
});

// POST /api/admin/notifications/bulk-delete - Supprimer plusieurs notifications
router.post('/bulk-delete', async (req, res) => {
  try {
    const { notification_ids } = req.body;

    if (!Array.isArray(notification_ids) || notification_ids.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Liste d\'IDs de notifications requise et ne peut pas être vide'
      });
    }

    // Filtrer et valider les IDs
    const validIds = notification_ids
      .filter(id => !isNaN(Number(id)) && Number(id) > 0)
      .map(id => Number(id));

    if (validIds.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Aucun ID de notification valide fourni'
      });
    }

    // Vérifier l'existence des notifications
    const placeholders = validIds.map(() => '?').join(',');
    const [existingNotifications] = await pool.execute<RowDataPacket[]>(
      `SELECT id FROM notifications WHERE id IN (${placeholders})`,
      validIds
    );

    const existingIds = existingNotifications.map(notif => notif.id);
    const missingIds = validIds.filter(id => !existingIds.includes(id));

    if (missingIds.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Certaines notifications n\'existent pas',
        missing_ids: missingIds
      });
    }

    // Supprimer les notifications
    const [result] = await pool.execute<ResultSetHeader>(
      `DELETE FROM notifications WHERE id IN (${placeholders})`,
      validIds
    );

    // Log de l'action admin
    try {
      await pool.execute(
        `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, created_at) 
         VALUES (?, 'notifications_bulk_deleted', 'notification', 0, ?, NOW())`,
        [
          req.user?.id || 0,
          JSON.stringify({ 
            notification_ids: validIds,
            deleted_count: result.affectedRows
          })
        ]
      );
    } catch (logError) {
      console.log('Log admin non enregistré:', getErrorMessage(logError));
    }

    res.json({ 
      success: true, 
      message: `${result.affectedRows} notification(s) supprimée(s) avec succès`,
      deleted_count: result.affectedRows,
      deleted_ids: validIds
    });
  } catch (error: any) {
    console.error('Erreur suppression en lot notifications:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erreur serveur lors de la suppression en lot des notifications',
      details: process.env.NODE_ENV === 'development' ? error?.message : undefined
    });
  }
});

// GET /api/admin/notifications/stats/overview - Statistiques des notifications
router.get('/stats/overview', async (req, res) => {
  try {
    const [stats] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        COUNT(*) as total_notifications,
        COUNT(CASE WHEN is_read = 0 THEN 1 END) as non_lues,
        COUNT(CASE WHEN is_read = 1 THEN 1 END) as lues,
        COUNT(CASE WHEN sent_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 END) as dernieres_24h,
        COUNT(CASE WHEN sent_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as derniere_semaine,
        COUNT(CASE WHEN sent_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as dernier_mois,
        ROUND(COUNT(CASE WHEN is_read = 1 THEN 1 END) * 100.0 / COUNT(*), 2) as taux_lecture_global
      FROM notifications
    `);

    const [typeDistribution] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        type,
        COUNT(*) as nombre,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM notifications), 2) as pourcentage
      FROM notifications
      GROUP BY type
      ORDER BY nombre DESC
    `);

    const [notificationsParJour] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        DATE(sent_at) as date,
        COUNT(*) as nombre_notifications,
        COUNT(CASE WHEN is_read = 1 THEN 1 END) as notifications_lues,
        ROUND(COUNT(CASE WHEN is_read = 1 THEN 1 END) * 100.0 / COUNT(*), 2) as taux_lecture
      FROM notifications
      WHERE sent_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(sent_at)
      ORDER BY date DESC
    `);

    const [utilisateursActifs] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        u.id as user_id,
        u.nom as user_nom,
        u.email as user_email,
        COUNT(n.id) as total_notifications,
        COUNT(CASE WHEN n.is_read = 0 THEN 1 END) as non_lues,
        MAX(n.sent_at) as derniere_notification
      FROM users u
      LEFT JOIN notifications n ON u.id = n.user_id
      GROUP BY u.id, u.nom, u.email
      HAVING total_notifications > 0
      ORDER BY total_notifications DESC
      LIMIT 20
    `);

    const [typesPopulaires] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        type,
        COUNT(*) as nombre_total,
        COUNT(CASE WHEN is_read = 1 THEN 1 END) as nombre_lues,
        ROUND(COUNT(CASE WHEN is_read = 1 THEN 1 END) * 100.0 / COUNT(*), 2) as taux_lecture,
        AVG(TIMESTAMPDIFF(MINUTE, sent_at, read_at)) as temps_moyen_lecture_minutes
      FROM notifications
      WHERE sent_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) AND read_at IS NOT NULL
      GROUP BY type
      ORDER BY nombre_total DESC
    `);

    res.json({
      success: true,
      overview: stats[0] || {},
      typeDistribution: typeDistribution || [],
      notificationsParJour: notificationsParJour || [],
      utilisateursActifs: utilisateursActifs || [],
      typesPopulaires: typesPopulaires || []
    });
  } catch (error: any) {
    console.error('Erreur statistiques notifications:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erreur serveur lors de la récupération des statistiques',
      details: process.env.NODE_ENV === 'development' ? error?.message : undefined
    });
  }
});

// GET /api/admin/notifications/templates - Récupérer les templates de notifications
router.get('/templates', async (req, res) => {
  try {
    const [rows] = await pool.execute<NotificationTemplateRow[]>(
      `SELECT id, nom, titre, message, variables, is_active, created_at 
       FROM notification_templates
       ORDER BY created_at DESC`
    );

    const templates = rows.map((row) => ({
      id: row.id,
      name: row.nom,
      title: row.titre,
      message: row.message,
      variables: parseTemplateVariables(row.variables),
      is_active: Boolean(row.is_active),
      created_at: row.created_at
    }));

    res.json({
      success: true,
      templates,
      total: templates.length
    });
  } catch (error: any) {
    console.error('Erreur récupération templates:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erreur serveur lors de la récupération des templates',
      details: process.env.NODE_ENV === 'development' ? error?.message : undefined
    });
  }
});

// POST /api/admin/notifications/template - Envoyer une notification à partir d'un template
router.post('/template', async (req, res) => {
  let connection: PoolConnection | null = null;
  try {
    const { 
      template_id,
      template_nom,
      variables = {}, 
      target_roles = ['all'],
      user_ids = null,
      type
    } = req.body;

    console.log('Utilisation template:', { template_id, template_nom, target_roles, user_ids });

    if (!template_id && !template_nom) {
      return res.status(400).json({
        success: false,
        error: 'ID ou nom du template requis'
      });
    }

    const identifierField = template_id ? 'id' : 'nom';
    const identifierValue = template_id ?? template_nom;
    
    const [templateRows] = await pool.execute<NotificationTemplateRow[]>(
      `SELECT id, nom, titre, message, variables 
       FROM notification_templates 
       WHERE ${identifierField} = ? AND is_active = 1 
       LIMIT 1`,
      [identifierValue]
    );

    if (templateRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Template non trouvé ou inactif'
      });
    }

    const template = templateRows[0];
    const templateVariables = parseTemplateVariables(template.variables);
    const providedVariables = (variables && typeof variables === 'object' && !Array.isArray(variables)) ? variables : {};

    const missingVariables = templateVariables.filter((variable) => {
      const value = providedVariables[variable];
      return value === undefined || value === null || value === '';
    });

    if (missingVariables.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Certaines variables obligatoires sont manquantes',
        missing_variables: missingVariables
      });
    }

    const replacePlaceholders = (text: string) => {
      let result = text;
      Object.entries(providedVariables).forEach(([key, value]) => {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        result = result.replace(regex, String(value ?? ''));
      });
      return result;
    };

    const processedTitle = replacePlaceholders(template.titre).trim();
    const processedMessage = replacePlaceholders(template.message).trim();

    const placeholderRegex = /{{\s*([^}]+)\s*}}/g;
    const remainingTitlePlaceholders = processedTitle.match(placeholderRegex) || [];
    const remainingMessagePlaceholders = processedMessage.match(placeholderRegex) || [];

    if (remainingTitlePlaceholders.length > 0 || remainingMessagePlaceholders.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Certaines variables du template n\'ont pas été remplacées',
        missing_variables: {
          title: remainingTitlePlaceholders,
          message: remainingMessagePlaceholders
        }
      });
    }

    const templateType: NotificationType = (type && ['info', 'success', 'warning', 'error'].includes(type))
      ? type
      : (DEFAULT_TEMPLATE_TYPES[template.nom] || 'info');

    const notificationDataPayload = {
      template_id: template.id,
      template_nom: template.nom,
      variables: providedVariables,
      is_template_based: true
    };

    let targetUsers: RowDataPacket[] = [];

    if (user_ids && Array.isArray(user_ids) && user_ids.length > 0) {
      const validUserIds = user_ids
        .map((id: any) => Number(id))
        .filter((id: number) => !isNaN(id) && id > 0);

      if (validUserIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Aucun ID utilisateur valide fourni'
        });
      }

      const placeholders = validUserIds.map(() => '?').join(',');
      const [users] = await pool.execute<RowDataPacket[]>(
        `SELECT id FROM users WHERE id IN (${placeholders})`,
        validUserIds
      );

      if (users.length !== validUserIds.length) {
        return res.status(400).json({
          success: false,
          error: 'Certains utilisateurs n\'existent pas',
          requested: validUserIds,
          found: users.map(u => u.id)
        });
      }

      targetUsers = users;
    } else {
      let userQuery = 'SELECT id FROM users WHERE 1=1';
      const userParams: any[] = [];
      const cleanTargetRoles = Array.isArray(target_roles) ? target_roles : ['all'];

      if (cleanTargetRoles.length > 0 && !cleanTargetRoles.includes('all')) {
        const roleConditions = [];
        if (cleanTargetRoles.includes('client')) {
          roleConditions.push('role_id = 1');
        }
        if (cleanTargetRoles.includes('prestataire')) {
          roleConditions.push('role_id = 2');
        }
        if (cleanTargetRoles.includes('admin')) {
          roleConditions.push('role_id = 3');
        }

        if (roleConditions.length > 0) {
          userQuery += ` AND (${roleConditions.join(' OR ')})`;
        }
      }

      const [users] = await pool.execute<RowDataPacket[]>(userQuery, userParams);
      targetUsers = users;
    }

    if (targetUsers.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Aucun utilisateur trouvé pour les critères spécifiés'
      });
    }

    try {
      const activeConnection = await pool.getConnection();
      connection = activeConnection;
      await activeConnection.beginTransaction();

      const insertPromises = targetUsers.map(user =>
        activeConnection.execute(
          `INSERT INTO notifications (user_id, template_id, type, titre, message, data, sent_at) 
           VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [user.id, template.id, templateType, processedTitle, processedMessage, JSON.stringify(notificationDataPayload)]
        )
      );

      await Promise.all(insertPromises);
      await activeConnection.commit();

      try {
        await pool.execute(
          `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, created_at) 
           VALUES (?, 'notification_template', 'notification', 0, ?, NOW())`,
          [
            req.user?.id || 0,
            JSON.stringify({
              template_id: template.id,
              template_nom: template.nom,
              title: processedTitle,
              message: processedMessage,
              type: templateType,
              users_count: targetUsers.length,
              variables: providedVariables
            })
          ]
        );
      } catch (logError) {
        console.log('Log admin non enregistré:', getErrorMessage(logError));
      }

      res.json({
        success: true,
        message: `Notification envoyée à partir du template à ${targetUsers.length} utilisateur(s)`,
        template_id: template.id,
        processed_title: processedTitle,
        processed_message: processedMessage,
        users_count: targetUsers.length
      });

    } catch (templateError) {
      if (connection) {
        try {
          await connection.rollback();
        } catch (rollbackError: any) {
          console.error('Erreur rollback template:', rollbackError?.message);
        }
      }
      throw templateError;
    } finally {
      if (connection) {
        connection.release();
        connection = null;
      }
    }
  } catch (error: any) {
    console.error('Erreur envoi notification template:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erreur serveur lors de l\'envoi de la notification à partir du template',
      details: process.env.NODE_ENV === 'development' ? error?.message : undefined
    });
  }
});

// GET /api/admin/notifications/test - Route de test
router.get('/test', async (req, res) => {
  try {
    // Test de la connexion à la base de données
    const [users] = await pool.execute<RowDataPacket[]>('SELECT COUNT(*) as user_count FROM users');
    const [notifications] = await pool.execute<RowDataPacket[]>('SELECT COUNT(*) as notification_count FROM notifications');
    
    res.json({
      success: true,
      message: 'API Notifications fonctionnelle',
      database: {
        users: users[0]?.user_count || 0,
        notifications: notifications[0]?.notification_count || 0
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Erreur test notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur de test',
      details: error?.message
    });
  }
});

export default router;
