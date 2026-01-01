import { useEffect, useState } from 'react';
import { Bell, BellOff, Settings, X } from 'lucide-react';
import { notificationService } from '../services/notifications';
import { api } from '../lib/api';

interface NotificationManagerProps {
  onClose?: () => void;
}

export default function NotificationManager({ onClose }: NotificationManagerProps) {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<'granted' | 'denied' | 'default'>('default');
  const [tokens, setTokens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkNotificationSupport();
    loadPushTokens();
  }, []);

  const checkNotificationSupport = () => {
    const supported = notificationService.isSupported();
    setIsSupported(supported);
    
    if (supported) {
      const status = notificationService.getPermissionStatus();
      if (status.granted) setPermission('granted');
      else if (status.denied) setPermission('denied');
      else setPermission('default');
    }
  };

  const loadPushTokens = async () => {
    try {
      setLoading(true);
      const tokensList = await api.pushTokens.list();
      setTokens(tokensList);
    } catch (error) {
      console.error('Erreur chargement tokens:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnableNotifications = async () => {
    try {
      const success = await notificationService.registerPushToken();
      if (success) {
        setPermission('granted');
        await loadPushTokens();
        
        // Afficher une notification de test
        await notificationService.showNotification('🎉 Notifications activées !', {
          body: 'Vous recevrez maintenant les notifications PrestaCI',
          icon: '/icon-192x192.png'
        });
      }
    } catch (error) {
      console.error('Erreur activation notifications:', error);
    }
  };

  const handleToggleToken = async (tokenId: number) => {
    try {
      await api.pushTokens.toggle(tokenId);
      await loadPushTokens();
    } catch (error) {
      console.error('Erreur toggle token:', error);
    }
  };

  const handleDeleteToken = async (tokenId: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce token de notification ?')) return;
    
    try {
      await api.pushTokens.delete(tokenId);
      await loadPushTokens();
    } catch (error) {
      console.error('Erreur suppression token:', error);
    }
  };

  const handleTestNotification = async () => {
    await notificationService.showNotification('🧪 Test de notification', {
      body: 'Ceci est une notification de test PrestaCI',
      icon: '/icon-192x192.png',
      badge: '/icon-72x72.png',
      requireInteraction: true
    });
  };

  if (!isSupported) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg max-w-md mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Notifications</h3>
          {onClose && (
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          )}
        </div>
        
        <div className="text-center py-8">
          <BellOff className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            Les notifications ne sont pas supportées sur ce navigateur.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg max-w-md mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Bell className="w-6 h-6 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Notifications</h3>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        )}
      </div>

      {/* Statut des permissions */}
      <div className="mb-6">
        <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-700">
          <div>
            <p className="font-medium text-gray-900 dark:text-white">
              Statut des notifications
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {permission === 'granted' && '✅ Activées'}
              {permission === 'denied' && '❌ Refusées'}
              {permission === 'default' && '⏳ En attente'}
            </p>
          </div>
          
          {permission !== 'granted' && (
            <button
              onClick={handleEnableNotifications}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Activer
            </button>
          )}
        </div>
      </div>

      {/* Actions rapides */}
      {permission === 'granted' && (
        <div className="mb-6 space-y-3">
          <button
            onClick={handleTestNotification}
            className="w-full p-3 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/30 text-green-700 dark:text-green-400 rounded-xl text-sm font-medium transition-colors"
          >
            🧪 Tester les notifications
          </button>
        </div>
      )}

      {/* Liste des tokens */}
      <div>
        <h4 className="font-medium text-gray-900 dark:text-white mb-3">Appareils connectés</h4>
        
        {loading ? (
          <div className="text-center py-4">
            <div className="text-gray-500 dark:text-gray-400">Chargement...</div>
          </div>
        ) : tokens.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Aucun appareil connecté
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {tokens.map((token) => (
              <div
                key={token.id}
                className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-700"
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${token.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {token.device_type === 'web' && '🌐 Navigateur'}
                      {token.device_type === 'android' && '📱 Android'}
                      {token.device_type === 'ios' && '📱 iOS'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(token.created_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleToggleToken(token.id)}
                    className={`p-2 rounded-lg text-xs font-medium transition-colors ${
                      token.is_active
                        ? 'bg-green-100 hover:bg-green-200 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {token.is_active ? 'Actif' : 'Inactif'}
                  </button>
                  
                  <button
                    onClick={() => handleDeleteToken(token.id)}
                    className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Informations */}
      <div className="mt-6 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20">
        <div className="flex items-start space-x-3">
          <Settings className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
              Types de notifications
            </p>
            <ul className="text-xs text-blue-700 dark:text-blue-300 mt-1 space-y-1">
              <li>• Nouvelles réservations</li>
              <li>• Confirmations et refus</li>
              <li>• Nouveaux avis clients</li>
              <li>• Rappels de rendez-vous</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
