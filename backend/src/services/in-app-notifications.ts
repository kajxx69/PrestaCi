import { pool } from '../db.js';

export interface NotificationTemplate {
  id: number;
  nom: string;
  titre: string;
  message: string;
  variables: string[];
  is_active: boolean;
}

export interface InAppNotification {
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
}

export class InAppNotificationService {
  private static parseTemplateVariables(raw: any): string[] {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      const normalize = (value: string) => value
        .replace(/'/g, '"') // convertir quotes simples
        .replace(/\s+/g, ' ')
        .trim();
      
      const attemptParse = (value: string): string[] | null => {
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed : null;
        } catch {
          return null;
        }
      };

      const normalized = normalize(trimmed);
      let parsed = attemptParse(normalized);
      
      if (!parsed && !normalized.startsWith('[')) {
        parsed = attemptParse(`[${normalized}]`);
      }
      
      if (!parsed) {
        const manual = normalized
          .replace(/[\[\]]/g, '')
          .split(',')
          .map((v) => v.replace(/"/g, '').trim())
          .filter(Boolean);
        return manual;
      }

      return parsed;
    }

    return [];
  }
  
  /**
   * Récupérer un template de notification
   */
  static async getTemplate(templateName: string): Promise<NotificationTemplate | null> {
    try {
      const [rows]: any = await pool.query(
        'SELECT * FROM notification_templates WHERE nom = ? AND is_active = 1 LIMIT 1',
        [templateName]
      );
      
      if (rows.length === 0) return null;
      
      const template = rows[0];
      return {
        ...template,
        variables: this.parseTemplateVariables(template.variables)
      };
    } catch (error) {
      console.error('Erreur récupération template:', error);
      return null;
    }
  }

  /**
   * Remplacer les variables dans un message
   */
  static replaceVariables(message: string, variables: Record<string, any>): string {
    let result = message;
    
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, String(value || ''));
    });
    
    return result;
  }

  /**
   * Créer une notification avec template
   */
  static async createFromTemplate(
    userId: number,
    templateName: string,
    variables: Record<string, any> = {},
    type: 'info' | 'success' | 'warning' | 'error' = 'info'
  ): Promise<number | null> {
    try {
      const template = await this.getTemplate(templateName);
      if (!template) {
        console.error(`Template '${templateName}' introuvable`);
        return null;
      }

      const titre = this.replaceVariables(template.titre, variables);
      const message = this.replaceVariables(template.message, variables);

      const [result]: any = await pool.query(
        `INSERT INTO notifications (user_id, template_id, titre, message, type, data, sent_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [userId, template.id, titre, message, type, JSON.stringify(variables)]
      );

      console.log(`📱 Notification in-app créée pour l'utilisateur ${userId}: ${titre}`);
      return result.insertId;
    } catch (error) {
      console.error('Erreur création notification:', error);
      return null;
    }
  }

  /**
   * Créer une notification personnalisée
   */
  static async createCustom(
    userId: number,
    titre: string,
    message: string,
    type: 'info' | 'success' | 'warning' | 'error' = 'info',
    data: any = null
  ): Promise<number | null> {
    try {
      const [result]: any = await pool.query(
        `INSERT INTO notifications (user_id, titre, message, type, data, sent_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [userId, titre, message, type, JSON.stringify(data)]
      );

      console.log(`📱 Notification personnalisée créée pour l'utilisateur ${userId}: ${titre}`);
      return result.insertId;
    } catch (error) {
      console.error('Erreur création notification personnalisée:', error);
      return null;
    }
  }

  /**
   * Récupérer les notifications d'un utilisateur
   */
  static async getUserNotifications(
    userId: number,
    limit: number = 20,
    onlyUnread: boolean = false
  ): Promise<InAppNotification[]> {
    try {
      let query = `
        SELECT n.*, nt.nom as template_nom
        FROM notifications n
        LEFT JOIN notification_templates nt ON n.template_id = nt.id
        WHERE n.user_id = ?
      `;
      
      if (onlyUnread) {
        query += ' AND n.is_read = 0';
      }
      
      query += ' ORDER BY n.sent_at DESC LIMIT ?';

      const [rows]: any = await pool.query(query, [userId, limit]);
      
      return rows.map((row: any) => {
        let parsedData = null;
        if (row.data) {
          try {
            parsedData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
          } catch {
            // Données anciennes non formatées correctement
            parsedData = row.data;
          }
        }

        return {
          ...row,
          data: parsedData
        };
      });
    } catch (error) {
      console.error('Erreur récupération notifications:', error);
      return [];
    }
  }

  /**
   * Marquer une notification comme lue
   */
  static async markAsRead(notificationId: number, userId: number): Promise<boolean> {
    try {
      const [result]: any = await pool.query(
        'UPDATE notifications SET is_read = 1, read_at = NOW() WHERE id = ? AND user_id = ?',
        [notificationId, userId]
      );

      return result.affectedRows > 0;
    } catch (error) {
      console.error('Erreur marquage notification lue:', error);
      return false;
    }
  }

  /**
   * Marquer toutes les notifications comme lues
   */
  static async markAllAsRead(userId: number): Promise<number> {
    try {
      const [result]: any = await pool.query(
        'UPDATE notifications SET is_read = 1, read_at = NOW() WHERE user_id = ? AND is_read = 0',
        [userId]
      );

      return result.affectedRows;
    } catch (error) {
      console.error('Erreur marquage toutes notifications lues:', error);
      return 0;
    }
  }

  /**
   * Supprimer une notification
   */
  static async deleteNotification(notificationId: number, userId: number): Promise<boolean> {
    try {
      const [result]: any = await pool.query(
        'DELETE FROM notifications WHERE id = ? AND user_id = ?',
        [notificationId, userId]
      );

      return result.affectedRows > 0;
    } catch (error) {
      console.error('Erreur suppression notification:', error);
      return false;
    }
  }

  /**
   * Compter les notifications non lues
   */
  static async getUnreadCount(userId: number): Promise<number> {
    try {
      const [rows]: any = await pool.query(
        'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
        [userId]
      );

      return rows[0]?.count || 0;
    } catch (error) {
      console.error('Erreur comptage notifications non lues:', error);
      return 0;
    }
  }

  /**
   * Nettoyer les anciennes notifications
   */
  static async cleanupOldNotifications(daysOld: number = 30): Promise<number> {
    try {
      const [result]: any = await pool.query(
        'DELETE FROM notifications WHERE sent_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
        [daysOld]
      );

      console.log(`🧹 ${result.affectedRows} anciennes notifications supprimées`);
      return result.affectedRows;
    } catch (error) {
      console.error('Erreur nettoyage notifications:', error);
      return 0;
    }
  }
}

/**
 * Notifications automatiques pour les événements prestataires
 */
export class PrestataireInAppNotifications {
  
  static async nouvelleReservation(prestataireId: number, clientNom: string, serviceName: string, date: string, heure: string) {
    await InAppNotificationService.createFromTemplate(
      prestataireId,
      'nouvelle_reservation',
      {
        client_nom: clientNom,
        service_nom: serviceName,
        date: date,
        heure: heure
      },
      'info'
    );
  }
  
  static async reservationAnnulee(prestataireId: number, clientNom: string, serviceName: string) {
    await InAppNotificationService.createCustom(
      prestataireId,
      '❌ Réservation annulée',
      `${clientNom} a annulé sa réservation pour "${serviceName}"`,
      'warning'
    );
  }
  
  static async nouveauAvis(prestataireId: number, note: number, commentaire?: string) {
    const etoiles = '⭐'.repeat(note);
    await InAppNotificationService.createCustom(
      prestataireId,
      '🌟 Nouvel avis reçu !',
      `${etoiles} ${commentaire ? commentaire.substring(0, 100) + '...' : `Note: ${note}/5`}`,
      'success'
    );
  }
  
  static async abonnementExpire(prestataireId: number, joursRestants: number) {
    await InAppNotificationService.createCustom(
      prestataireId,
      '⚠️ Abonnement bientôt expiré',
      `Votre abonnement expire dans ${joursRestants} jour(s). Renouvelez maintenant pour continuer à recevoir des réservations !`,
      'warning'
    );
  }

  static async paiementValide(prestataireId: number, planNom: string, duree: string) {
    await InAppNotificationService.createFromTemplate(
      prestataireId,
      'paiement_valide',
      {
        plan_nom: planNom,
        duree: duree
      },
      'success'
    );
  }
}

/**
 * Notifications automatiques pour les événements clients
 */
export class ClientInAppNotifications {
  
  static async reservationConfirmee(clientId: number, prestataireNom: string, serviceName: string, date: string, heure: string) {
    await InAppNotificationService.createFromTemplate(
      clientId,
      'reservation_confirmee',
      {
        service_nom: serviceName,
        date: date,
        heure: heure,
        prestataire_nom: prestataireNom
      },
      'success'
    );
  }
  
  static async reservationRefusee(clientId: number, prestataireNom: string, serviceName: string, motif?: string) {
    await InAppNotificationService.createFromTemplate(
      clientId,
      'reservation_refusee',
      {
        prestataire_nom: prestataireNom,
        service_nom: serviceName,
        motif: motif || 'Aucun motif spécifié'
      },
      'error'
    );
  }
  
  static async serviceTermine(clientId: number, prestataireNom: string, serviceName: string) {
    await InAppNotificationService.createCustom(
      clientId,
      '🎉 Service terminé !',
      `Votre service "${serviceName}" avec ${prestataireNom} est terminé. N'oubliez pas de laisser un avis !`,
      'success'
    );
  }
  
  static async rappelRendezVous(clientId: number, prestataireNom: string, serviceName: string, heure: string) {
    await InAppNotificationService.createFromTemplate(
      clientId,
      'rappel_rdv',
      {
        heure: heure,
        prestataire_nom: prestataireNom,
        service_nom: serviceName
      },
      'info'
    );
  }
}

export default {
  InAppNotificationService,
  PrestataireInAppNotifications,
  ClientInAppNotifications
};
