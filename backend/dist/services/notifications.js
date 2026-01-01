import { pool } from '../db.js';
/**
 * Récupérer les tokens push actifs d'un utilisateur
 */
export async function getUserPushTokens(userId) {
    try {
        const [rows] = await pool.query('SELECT * FROM push_tokens WHERE user_id = ? AND is_active = 1', [userId]);
        return rows;
    }
    catch (error) {
        console.error('Erreur récupération push tokens:', error);
        return [];
    }
}
/**
 * Récupérer les tokens push de tous les prestataires
 */
export async function getPrestatairePushTokens() {
    try {
        const [rows] = await pool.query(`
      SELECT pt.* FROM push_tokens pt
      JOIN users u ON pt.user_id = u.id
      WHERE u.role_id = 2 AND pt.is_active = 1
    `);
        return rows;
    }
    catch (error) {
        console.error('Erreur récupération push tokens prestataires:', error);
        return [];
    }
}
/**
 * Envoyer une notification à un utilisateur spécifique
 */
export async function sendNotificationToUser(userId, notification) {
    try {
        const tokens = await getUserPushTokens(userId);
        if (tokens.length === 0) {
            console.log(`Aucun token push actif pour l'utilisateur ${userId}`);
            return false;
        }
        // Ici vous pouvez intégrer votre service de push (Firebase, OneSignal, etc.)
        console.log(`📱 Notification envoyée à ${tokens.length} appareil(s) pour l'utilisateur ${userId}:`, {
            title: notification.title,
            body: notification.body,
            tokens: tokens.map(t => ({ device_type: t.device_type, token: t.token.substring(0, 20) + '...' }))
        });
        // TODO: Implémenter l'envoi réel avec votre service de push
        // Exemple avec Firebase:
        // await sendFirebaseNotification(tokens, notification);
        return true;
    }
    catch (error) {
        console.error('Erreur envoi notification:', error);
        return false;
    }
}
/**
 * Envoyer une notification à tous les prestataires
 */
export async function sendNotificationToAllPrestataires(notification) {
    try {
        const tokens = await getPrestatairePushTokens();
        if (tokens.length === 0) {
            console.log('Aucun token push actif pour les prestataires');
            return 0;
        }
        console.log(`📱 Notification envoyée à ${tokens.length} prestataire(s):`, {
            title: notification.title,
            body: notification.body
        });
        // TODO: Implémenter l'envoi réel
        return tokens.length;
    }
    catch (error) {
        console.error('Erreur envoi notification prestataires:', error);
        return 0;
    }
}
/**
 * Notifications automatiques pour les événements prestataires
 */
export class PrestataireNotifications {
    static async nouvelleReservation(prestataireId, clientNom, serviceName) {
        await sendNotificationToUser(prestataireId, {
            title: '🎉 Nouvelle réservation !',
            body: `${clientNom} a réservé votre service "${serviceName}"`,
            data: {
                type: 'nouvelle_reservation',
                prestataire_id: prestataireId
            },
            badge: 1
        });
    }
    static async reservationAnnulee(prestataireId, clientNom, serviceName) {
        await sendNotificationToUser(prestataireId, {
            title: '❌ Réservation annulée',
            body: `${clientNom} a annulé sa réservation pour "${serviceName}"`,
            data: {
                type: 'reservation_annulee',
                prestataire_id: prestataireId
            }
        });
    }
    static async nouveauAvis(prestataireId, note, commentaire) {
        const etoiles = '⭐'.repeat(note);
        await sendNotificationToUser(prestataireId, {
            title: '🌟 Nouvel avis reçu !',
            body: `${etoiles} ${commentaire ? commentaire.substring(0, 50) + '...' : `Note: ${note}/5`}`,
            data: {
                type: 'nouvel_avis',
                prestataire_id: prestataireId,
                note
            },
            badge: 1
        });
    }
    static async abonnementExpire(prestataireId, joursRestants) {
        await sendNotificationToUser(prestataireId, {
            title: '⚠️ Abonnement bientôt expiré',
            body: `Votre abonnement expire dans ${joursRestants} jour(s). Renouvelez maintenant !`,
            data: {
                type: 'abonnement_expire',
                prestataire_id: prestataireId,
                jours_restants: joursRestants
            }
        });
    }
}
/**
 * Notifications automatiques pour les événements clients
 */
export class ClientNotifications {
    static async reservationConfirmee(clientId, prestataireNom, serviceName, dateReservation) {
        await sendNotificationToUser(clientId, {
            title: '✅ Réservation confirmée !',
            body: `${prestataireNom} a confirmé votre réservation pour "${serviceName}" le ${dateReservation}`,
            data: {
                type: 'reservation_confirmee',
                client_id: clientId
            },
            badge: 1
        });
    }
    static async reservationRefusee(clientId, prestataireNom, serviceName, motif) {
        await sendNotificationToUser(clientId, {
            title: '❌ Réservation refusée',
            body: `${prestataireNom} a refusé votre réservation pour "${serviceName}"${motif ? `: ${motif}` : ''}`,
            data: {
                type: 'reservation_refusee',
                client_id: clientId
            }
        });
    }
    static async serviceTermine(clientId, prestataireNom, serviceName) {
        await sendNotificationToUser(clientId, {
            title: '🎉 Service terminé !',
            body: `Votre service "${serviceName}" avec ${prestataireNom} est terminé. N'oubliez pas de laisser un avis !`,
            data: {
                type: 'service_termine',
                client_id: clientId
            },
            badge: 1
        });
    }
    static async rappelRendezVous(clientId, prestataireNom, serviceName, heureRendezVous) {
        await sendNotificationToUser(clientId, {
            title: '⏰ Rappel de rendez-vous',
            body: `Votre rendez-vous avec ${prestataireNom} pour "${serviceName}" est dans 1 heure (${heureRendezVous})`,
            data: {
                type: 'rappel_rdv',
                client_id: clientId
            }
        });
    }
}
export default {
    sendNotificationToUser,
    sendNotificationToAllPrestataires,
    getUserPushTokens,
    getPrestatairePushTokens,
    PrestataireNotifications,
    ClientNotifications
};
