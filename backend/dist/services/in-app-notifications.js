import { pool } from '../db.js';
export class InAppNotificationService {
    /**
     * Récupérer un template de notification
     */
    static async getTemplate(templateName) {
        try {
            const [rows] = await pool.query('SELECT * FROM notification_templates WHERE nom = ? AND is_active = 1 LIMIT 1', [templateName]);
            if (rows.length === 0)
                return null;
            const template = rows[0];
            return {
                ...template,
                variables: JSON.parse(template.variables || '[]')
            };
        }
        catch (error) {
            console.error('Erreur récupération template:', error);
            return null;
        }
    }
    /**
     * Remplacer les variables dans un message
     */
    static replaceVariables(message, variables) {
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
    static async createFromTemplate(userId, templateName, variables = {}, type = 'info') {
        try {
            const template = await this.getTemplate(templateName);
            if (!template) {
                console.error(`Template '${templateName}' introuvable`);
                return null;
            }
            const titre = this.replaceVariables(template.titre, variables);
            const message = this.replaceVariables(template.message, variables);
            const [result] = await pool.query(`INSERT INTO notifications (user_id, template_id, titre, message, type, data, sent_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`, [userId, template.id, titre, message, type, JSON.stringify(variables)]);
            console.log(`📱 Notification in-app créée pour l'utilisateur ${userId}: ${titre}`);
            return result.insertId;
        }
        catch (error) {
            console.error('Erreur création notification:', error);
            return null;
        }
    }
    /**
     * Créer une notification personnalisée
     */
    static async createCustom(userId, titre, message, type = 'info', data = null) {
        try {
            const [result] = await pool.query(`INSERT INTO notifications (user_id, titre, message, type, data, sent_at)
         VALUES (?, ?, ?, ?, ?, NOW())`, [userId, titre, message, type, JSON.stringify(data)]);
            console.log(`📱 Notification personnalisée créée pour l'utilisateur ${userId}: ${titre}`);
            return result.insertId;
        }
        catch (error) {
            console.error('Erreur création notification personnalisée:', error);
            return null;
        }
    }
    /**
     * Récupérer les notifications d'un utilisateur
     */
    static async getUserNotifications(userId, limit = 20, onlyUnread = false) {
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
            const [rows] = await pool.query(query, [userId, limit]);
            return rows.map((row) => {
                let parsedData = null;
                if (row.data) {
                    try {
                        parsedData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
                    }
                    catch {
                        // Données anciennes non formatées correctement
                        parsedData = row.data;
                    }
                }
                return {
                    ...row,
                    data: parsedData
                };
            });
        }
        catch (error) {
            console.error('Erreur récupération notifications:', error);
            return [];
        }
    }
    /**
     * Marquer une notification comme lue
     */
    static async markAsRead(notificationId, userId) {
        try {
            const [result] = await pool.query('UPDATE notifications SET is_read = 1, read_at = NOW() WHERE id = ? AND user_id = ?', [notificationId, userId]);
            return result.affectedRows > 0;
        }
        catch (error) {
            console.error('Erreur marquage notification lue:', error);
            return false;
        }
    }
    /**
     * Marquer toutes les notifications comme lues
     */
    static async markAllAsRead(userId) {
        try {
            const [result] = await pool.query('UPDATE notifications SET is_read = 1, read_at = NOW() WHERE user_id = ? AND is_read = 0', [userId]);
            return result.affectedRows;
        }
        catch (error) {
            console.error('Erreur marquage toutes notifications lues:', error);
            return 0;
        }
    }
    /**
     * Supprimer une notification
     */
    static async deleteNotification(notificationId, userId) {
        try {
            const [result] = await pool.query('DELETE FROM notifications WHERE id = ? AND user_id = ?', [notificationId, userId]);
            return result.affectedRows > 0;
        }
        catch (error) {
            console.error('Erreur suppression notification:', error);
            return false;
        }
    }
    /**
     * Compter les notifications non lues
     */
    static async getUnreadCount(userId) {
        try {
            const [rows] = await pool.query('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0', [userId]);
            return rows[0]?.count || 0;
        }
        catch (error) {
            console.error('Erreur comptage notifications non lues:', error);
            return 0;
        }
    }
    /**
     * Nettoyer les anciennes notifications
     */
    static async cleanupOldNotifications(daysOld = 30) {
        try {
            const [result] = await pool.query('DELETE FROM notifications WHERE sent_at < DATE_SUB(NOW(), INTERVAL ? DAY)', [daysOld]);
            console.log(`🧹 ${result.affectedRows} anciennes notifications supprimées`);
            return result.affectedRows;
        }
        catch (error) {
            console.error('Erreur nettoyage notifications:', error);
            return 0;
        }
    }
}
/**
 * Notifications automatiques pour les événements prestataires
 */
export class PrestataireInAppNotifications {
    static async nouvelleReservation(prestataireId, clientNom, serviceName, date, heure) {
        await InAppNotificationService.createFromTemplate(prestataireId, 'nouvelle_reservation', {
            client_nom: clientNom,
            service_nom: serviceName,
            date: date,
            heure: heure
        }, 'info');
    }
    static async reservationAnnulee(prestataireId, clientNom, serviceName) {
        await InAppNotificationService.createCustom(prestataireId, '❌ Réservation annulée', `${clientNom} a annulé sa réservation pour "${serviceName}"`, 'warning');
    }
    static async nouveauAvis(prestataireId, note, commentaire) {
        const etoiles = '⭐'.repeat(note);
        await InAppNotificationService.createCustom(prestataireId, '🌟 Nouvel avis reçu !', `${etoiles} ${commentaire ? commentaire.substring(0, 100) + '...' : `Note: ${note}/5`}`, 'success');
    }
    static async abonnementExpire(prestataireId, joursRestants) {
        await InAppNotificationService.createCustom(prestataireId, '⚠️ Abonnement bientôt expiré', `Votre abonnement expire dans ${joursRestants} jour(s). Renouvelez maintenant pour continuer à recevoir des réservations !`, 'warning');
    }
    static async paiementValide(prestataireId, planNom, duree) {
        await InAppNotificationService.createFromTemplate(prestataireId, 'paiement_valide', {
            plan_nom: planNom,
            duree: duree
        }, 'success');
    }
}
/**
 * Notifications automatiques pour les événements clients
 */
export class ClientInAppNotifications {
    static async reservationConfirmee(clientId, prestataireNom, serviceName, date, heure) {
        await InAppNotificationService.createFromTemplate(clientId, 'reservation_confirmee', {
            service_nom: serviceName,
            date: date,
            heure: heure,
            prestataire_nom: prestataireNom
        }, 'success');
    }
    static async reservationRefusee(clientId, prestataireNom, serviceName, motif) {
        await InAppNotificationService.createFromTemplate(clientId, 'reservation_refusee', {
            prestataire_nom: prestataireNom,
            service_nom: serviceName,
            motif: motif || 'Aucun motif spécifié'
        }, 'error');
    }
    static async serviceTermine(clientId, prestataireNom, serviceName) {
        await InAppNotificationService.createCustom(clientId, '🎉 Service terminé !', `Votre service "${serviceName}" avec ${prestataireNom} est terminé. N'oubliez pas de laisser un avis !`, 'success');
    }
    static async rappelRendezVous(clientId, prestataireNom, serviceName, heure) {
        await InAppNotificationService.createFromTemplate(clientId, 'rappel_rdv', {
            heure: heure,
            prestataire_nom: prestataireNom,
            service_nom: serviceName
        }, 'info');
    }
}
export default {
    InAppNotificationService,
    PrestataireInAppNotifications,
    ClientInAppNotifications
};
