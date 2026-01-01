import { useEffect, useMemo, useState } from 'react';
import {
  Mail,
  Phone,
  Camera,
  CreditCard as Edit2,
  LogOut,
  Bell,
  Shield,
  HelpCircle,
  Settings,
  MapPin,
  Calendar,
  Heart,
  Loader2,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';
import { api } from '../../lib/api';
import PrivacyTab from './PrivacyTab';
import NotificationsSettingsTab from './NotificationsSettingsTab';
import HelpSupportTab from './HelpSupportTab';

interface ProfileFormData {
  nom: string;
  prenom: string;
  telephone: string;
  ville: string;
  photo_profil: string;
}

interface ProfileInsights {
  totalReservations: number;
  upcomingReservations: number;
  completedReservations: number;
  cancelledReservations: number;
  favoritesTotal: number;
  unreadNotifications: number;
}

export default function ProfileTab() {
  const { user, logout } = useAuthStore();
  const { isDarkMode, toggleDarkMode, showToast } = useAppStore();
  const [isEditing, setIsEditing] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [editData, setEditData] = useState<ProfileFormData>({
    nom: user?.nom || '',
    prenom: user?.prenom || '',
    telephone: user?.telephone || '',
    ville: user?.ville || '',
    photo_profil: user?.photo_profil || ''
  });
  const [saving, setSaving] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [insights, setInsights] = useState<ProfileInsights>({
    totalReservations: 0,
    upcomingReservations: 0,
    completedReservations: 0,
    cancelledReservations: 0,
    favoritesTotal: 0,
    unreadNotifications: 0
  });
  const [recentReservations, setRecentReservations] = useState<any[]>([]);
  const [favoriteHighlights, setFavoriteHighlights] = useState<{ providers: any[]; services: any[] }>({
    providers: [],
    services: []
  });
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [lastInsightsRefresh, setLastInsightsRefresh] = useState<Date | null>(null);

  // Load latest profile from backend on mount
  useEffect(() => {
    const loadProfile = async () => {
      try {
        setProfileLoading(true);
        const { user } = await api.users.getMe();
        if (user) {
          useAuthStore.setState({ user });
          setEditData({
            nom: user.nom || '',
            prenom: user.prenom || '',
            telephone: user.telephone || '',
            ville: user.ville || '',
            photo_profil: user.photo_profil || ''
          });
        }
      } catch (e: any) {
        setError(e?.message || 'Impossible de charger votre profil');
      } finally {
        setProfileLoading(false);
      }
    };
    void loadProfile();
  }, []);

  useEffect(() => {
    if (!user) return;
    setEditData({
      nom: user.nom || '',
      prenom: user.prenom || '',
      telephone: user.telephone || '',
      ville: user.ville || '',
      photo_profil: user.photo_profil || ''
    });
  }, [user?.nom, user?.prenom, user?.telephone, user?.ville, user?.photo_profil]);

  useEffect(() => {
    void refreshInsights();
  }, []);

  const refreshInsights = async () => {
    setInsightsLoading(true);
    setInsightsError(null);
    let encounteredError = false;

    async function safeFetch<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
      try {
        return await fn();
      } catch (err) {
        encounteredError = true;
        console.error('[ProfileTab] Chargement incomplet', err);
        return fallback;
      }
    }

    const reservations = await safeFetch(() => api.reservations.list('all'), [] as any[]);
    const favoriteProviders = await safeFetch(() => api.favorites.listProviders(), [] as any[]);
    const favoriteServices = await safeFetch(() => api.favorites.listServices(), [] as any[]);
    const favoritePublications = await safeFetch(() => api.favorites.listPublications(), [] as any[]);
    const unreadCount = await safeFetch(() => api.notifications.getUnreadCount(), { count: 0 });

    const upcomingReservations = reservations.filter((r: any) =>
      ['en_attente', 'confirmee', 'acceptee'].includes(r.statut_nom)
    ).length;
    const completedReservations = reservations.filter((r: any) => r.statut_nom === 'terminee').length;
    const cancelledReservations = reservations.filter((r: any) =>
      ['annulee', 'refusee'].includes(r.statut_nom)
    ).length;

    setInsights({
      totalReservations: reservations.length,
      upcomingReservations,
      completedReservations,
      cancelledReservations,
      favoritesTotal: favoriteProviders.length + favoriteServices.length + favoritePublications.length,
      unreadNotifications: unreadCount.count || 0
    });
    setRecentReservations(reservations.slice(0, 3));
    setFavoriteHighlights({
      providers: favoriteProviders.slice(0, 2),
      services: favoriteServices.slice(0, 2)
    });
    setLastInsightsRefresh(new Date());

    if (encounteredError) {
      setInsightsError('Certaines données n’ont pas pu être chargées. Réessayez plus tard.');
    }
    setInsightsLoading(false);
  };

  const validateProfile = () => {
    if (!editData.prenom.trim() || !editData.nom.trim()) {
      return 'Merci de renseigner votre prénom et votre nom.';
    }
    if (editData.telephone && !/^[+0-9][0-9\s-]{7,}$/.test(editData.telephone)) {
      return 'Le format du numéro de téléphone semble invalide.';
    }
    return null;
  };

  const handleSaveProfile = async () => {
    const validationMessage = validateProfile();
    if (validationMessage) {
      setError(validationMessage);
      showToast(validationMessage, 'error');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const { user: saved } = await api.users.updateMe(editData);
      useAuthStore.setState({ user: saved });
      setEditData({
        nom: saved.nom || '',
        prenom: saved.prenom || '',
        telephone: saved.telephone || '',
        ville: saved.ville || '',
        photo_profil: saved.photo_profil || ''
      });
      setIsEditing(false);
      showToast('Profil mis à jour avec succès', 'success');
    } catch (e: any) {
      setError(e?.message || 'Impossible de sauvegarder le profil');
    } finally {
      setSaving(false);
    }
  };

  const compressImage = (file: File, maxWidth: number = 800, quality: number = 0.8): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Calculer les nouvelles dimensions en gardant le ratio
        let { width, height } = img;
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxWidth) {
            width = (width * maxWidth) / height;
            height = maxWidth;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Dessiner l'image redimensionnée
        ctx?.drawImage(img, 0, 0, width, height);

        // Convertir en base64 avec compression
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedBase64);
      };

      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Vérifier le type de fichier
    if (!file.type.startsWith('image/')) {
      showToast('Veuillez sélectionner une image', 'error');
      return;
    }

    // Vérifier la taille (max 10MB pour le fichier original)
    if (file.size > 10 * 1024 * 1024) {
      showToast('L\'image ne doit pas dépasser 10MB', 'error');
      return;
    }

    try {
      setUploadingPhoto(true);
      setError(null);

      // Compresser l'image avant l'envoi
      const compressedBase64 = await compressImage(file, 800, 0.8);
      
      const { user: updated } = await api.users.updateMe({
        ...editData,
        photo_profil: compressedBase64
      });
      
      useAuthStore.setState({ user: updated });
      setEditData({
        nom: updated.nom || '',
        prenom: updated.prenom || '',
        telephone: updated.telephone || '',
        ville: updated.ville || '',
        photo_profil: updated.photo_profil || ''
      });
      
      showToast('Photo mise à jour avec succès', 'success');
    } catch (e: any) {
      setError(e?.message || 'Impossible de mettre à jour la photo');
      showToast('Erreur lors de la mise à jour de la photo', 'error');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const menuItems = [
    { 
      icon: Bell, 
      label: 'Notifications', 
      action: () => setShowNotifications(true)
    },
    { 
      icon: Shield, 
      label: 'Confidentialité', 
      action: () => setShowPrivacy(true)
    },
    { 
      icon: HelpCircle, 
      label: 'Aide & Support', 
      action: () => setShowHelp(true)
    },
    { 
      icon: Settings, 
      label: 'Paramètres', 
      action: () => showToast('Paramètres avancés - Prochainement disponible', 'info')
    }
  ];

  const statusChips = useMemo(() => ([
    {
      label: 'Réservations',
      value: insights.totalReservations,
      subLabel: 'Historique complet',
      icon: Calendar,
      gradient: 'from-blue-500 to-indigo-500'
    },
    {
      label: 'À venir',
      value: insights.upcomingReservations,
      subLabel: 'Confirmées / en attente',
      icon: CheckCircle2,
      gradient: 'from-purple-500 to-pink-500'
    },
    {
      label: 'Favoris',
      value: insights.favoritesTotal,
      subLabel: 'Prestataires & services',
      icon: Heart,
      gradient: 'from-rose-500 to-orange-500'
    },
    {
      label: 'Alertes',
      value: insights.unreadNotifications,
      subLabel: 'Notifications non lues',
      icon: Bell,
      gradient: 'from-emerald-500 to-teal-500'
    }
  ]), [insights]);

  const formatReservationDate = (reservation: any) => {
    const date = reservation?.date_reservation ? new Date(`${reservation.date_reservation}T${reservation.heure_debut || '00:00'}`) : null;
    if (!date || Number.isNaN(date.getTime())) return 'Date non définie';
    return date.toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: '2-digit',
      month: 'short'
    });
  };

  const handleLogout = () => {
    if (confirm('Voulez-vous vraiment vous déconnecter ?')) {
      logout();
    }
  };

  if (showPrivacy) {
    return <PrivacyTab onBack={() => setShowPrivacy(false)} />;
  }

  if (showNotifications) {
    return <NotificationsSettingsTab onBack={() => setShowNotifications(false)} />;
  }

  if (showHelp) {
    return <HelpSupportTab onBack={() => setShowHelp(false)} />;
  }

  return (
    <div className="max-w-md mx-auto">
      {/* Header avec photo de profil */}
      <div className="bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500 px-4 py-10 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="text-center relative z-10">
          <div className="relative inline-block">
            <div className="w-24 h-24 rounded-full overflow-hidden mx-auto mb-4 ring-4 ring-white/30 shadow-xl">
              {user?.photo_profil ? (
                <img 
                  src={user.photo_profil} 
                  alt={`${user.prenom} ${user.nom}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-white bg-opacity-20 flex items-center justify-center text-white text-2xl font-semibold">
                  {user?.prenom?.[0]}{user?.nom?.[0]}
                </div>
              )}
            </div>
            <label className="absolute bottom-4 right-0 p-2.5 bg-white rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-200 cursor-pointer">
              <Camera className={`w-4 h-4 ${uploadingPhoto ? 'text-gray-400' : 'text-blue-600'}`} />
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                disabled={uploadingPhoto}
                className="hidden"
              />
            </label>
          </div>
          <h1 className={`text-2xl font-bold text-white mb-2 drop-shadow-lg ${profileLoading ? 'opacity-70 animate-pulse' : ''}`}>
            {user?.prenom} {user?.nom}
          </h1>
          <p className="text-white/90 font-medium">
            ✨ Membre PrestaCI
          </p>
          <div className="flex items-center justify-center mt-2 space-x-2 text-white/80 text-sm">
            <MapPin className="w-4 h-4" />
            <span>{user?.ville || 'Ville non renseignée'}</span>
          </div>
        </div>
      </div>

      {/* Informations personnelles */}
      <div className="p-4 space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Vue d'ensemble</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Votre activité récente sur la plateforme
              </p>
            </div>
            <button
              onClick={refreshInsights}
              disabled={insightsLoading}
              className="inline-flex items-center text-sm font-medium px-3 py-1.5 rounded-full text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition disabled:opacity-50"
            >
              {insightsLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  Chargement
                </>
              ) : (
                <>
                  <ArrowUpRight className="w-4 h-4 mr-1" />
                  Actualiser
                </>
              )}
            </button>
          </div>

          {insightsError && (
            <div className="mb-3 flex items-center text-xs text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-4 h-4 mr-1" />
              {insightsError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {statusChips.map((chip, idx) => (
              <div
                key={chip.label}
                className={`rounded-2xl p-4 text-white bg-gradient-to-br ${chip.gradient} shadow-sm`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="bg-white/20 rounded-xl p-2">
                    <chip.icon className="w-5 h-5" />
                  </div>
                  <span className="text-2xl font-bold">{chip.value}</span>
                </div>
                <div className="text-sm font-semibold">{chip.label}</div>
                <p className="text-xs text-white/80">{chip.subLabel}</p>
              </div>
            ))}
          </div>

          {lastInsightsRefresh && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
              Dernière mise à jour : {lastInsightsRefresh.toLocaleTimeString('fr-FR')}
            </p>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Informations personnelles
            </h2>
            <button
              onClick={() => isEditing ? handleSaveProfile() : setIsEditing(true)}
              className="flex items-center space-x-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 px-3 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200"
            >
              <Edit2 className="w-4 h-4" />
              <span className="text-sm font-medium">{isEditing ? 'Sauvegarder' : 'Modifier'}</span>
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border border-red-200 dark:border-red-800 rounded-xl shadow-sm">
              <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Prénom
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editData.prenom}
                    onChange={(e) => setEditData({...editData, prenom: e.target.value})}
                    className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm shadow-sm transition-all duration-200"
                    disabled={profileLoading}
                  />
                ) : (
                  <p className="text-gray-900 dark:text-white">{user?.prenom || 'Non renseigné'}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nom
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editData.nom}
                    onChange={(e) => setEditData({...editData, nom: e.target.value})}
                    className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm shadow-sm transition-all duration-200"
                    disabled={profileLoading}
                  />
                ) : (
                  <p className="text-gray-900 dark:text-white">{user?.nom || 'Non renseigné'}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email
              </label>
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4 text-gray-400" />
                <p className="text-gray-900 dark:text-white">{user?.email}</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Téléphone
              </label>
              {isEditing ? (
                <input
                  type="tel"
                  value={editData.telephone}
                  onChange={(e) => setEditData({...editData, telephone: e.target.value})}
                  className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm shadow-sm transition-all duration-200"
                  placeholder="+225 XX XX XX XX"
                  disabled={profileLoading}
                />
              ) : (
                <div className="flex items-center space-x-2">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <p className="text-gray-900 dark:text-white">{user?.telephone || 'Non renseigné'}</p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Ville
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.ville}
                  onChange={(e) => setEditData({ ...editData, ville: e.target.value })}
                  className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm shadow-sm transition-all duration-200"
                  placeholder="Abidjan, Bouaké..."
                  disabled={profileLoading}
                />
              ) : (
                <div className="flex items-center space-x-2">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <p className="text-gray-900 dark:text-white">{user?.ville || 'Non renseignée'}</p>
                </div>
              )}
            </div>

            {isEditing && (
              <div className="flex space-x-3 pt-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-all duration-200 hover:shadow-md"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={saving || profileLoading}
                  className={`flex-1 px-4 py-2.5 rounded-xl font-medium transition-all duration-200 text-white shadow-md hover:shadow-lg ${saving || profileLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'}`}
                >
                  {saving ? 'Enregistrement...' : 'Sauvegarder'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Activité récente */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Activité récente</h2>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {insights.totalReservations} réservation{insights.totalReservations > 1 ? 's' : ''}
            </span>
          </div>

          {insightsLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : recentReservations.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Pas encore de réservation. Explorez les services pour commencer !
            </p>
          ) : (
            <div className="space-y-3">
              {recentReservations.map(reservation => (
                <div key={reservation.id} className="flex items-start space-x-3 rounded-2xl border border-gray-100 dark:border-gray-700 p-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 flex flex-col items-center justify-center text-xs font-semibold">
                    <span>{formatReservationDate(reservation)}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{reservation.service_nom}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{reservation.prestataire_nom}</p>
                      </div>
                      <span className="text-[11px] font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: `${reservation.statut_couleur || '#E5E7EB'}20`, color: reservation.statut_couleur || '#1F2937' }}>
                        {reservation.statut_nom}
                      </span>
                    </div>
                    {reservation.adresse_rdv && (
                      <p className="text-xs text-gray-500 mt-2 flex items-center">
                        <MapPin className="w-3 h-3 mr-1" />
                        {reservation.adresse_rdv}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Favoris en aperçu */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Favoris mis à l'honneur</h2>
            <span className="text-xs text-gray-500 dark:text-gray-400">aperçu</span>
          </div>
          {favoriteHighlights.providers.length === 0 && favoriteHighlights.services.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Ajoutez vos prestataires ou services favoris pour les retrouver rapidement.</p>
          ) : (
            <div className="space-y-3">
              {favoriteHighlights.providers.map(provider => (
                <div key={provider.id} className="flex items-center justify-between p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20">
                  <div>
                    <p className="font-semibold text-blue-900 dark:text-blue-100">{provider.nom_commercial}</p>
                    <p className="text-xs text-blue-800/80 dark:text-blue-200/80 flex items-center">
                      <MapPin className="w-3 h-3 mr-1" />
                      {provider.ville || 'Ville non précisée'}
                    </p>
                  </div>
                  <Heart className="w-4 h-4 text-pink-500" />
                </div>
              ))}
              {favoriteHighlights.services.map(service => (
                <div key={service.id} className="flex items-center justify-between p-3 rounded-xl bg-purple-50 dark:bg-purple-900/20">
                  <div>
                    <p className="font-semibold text-purple-900 dark:text-purple-100">{service.nom}</p>
                    <p className="text-xs text-purple-800/80 dark:text-purple-200/80">{service.prestataire_nom}</p>
                  </div>
                  <Heart className="w-4 h-4 text-purple-500" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Menu des paramètres */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Paramètres
          </h2>
          
          <div className="space-y-2">
            {/* Mode sombre */}
            <div className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                  {isDarkMode ? '🌙' : '☀️'}
                </div>
                <span className="text-gray-900 dark:text-white">Mode sombre</span>
              </div>
              <button
                onClick={toggleDarkMode}
                className={`w-12 h-6 rounded-full transition-all duration-300 ${
                  isDarkMode ? 'bg-gradient-to-r from-blue-600 to-purple-600' : 'bg-gray-300'
                } relative shadow-inner`}
              >
                <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform duration-300 shadow-md ${
                  isDarkMode ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            {/* Autres options */}
            {menuItems.map((item, index) => (
              <button
                key={index}
                onClick={item.action}
                className="w-full flex items-center space-x-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 text-left group"
              >
                <div className="w-10 h-10 bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-700 dark:to-gray-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200 shadow-sm">
                  <item.icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </div>
                <span className="text-gray-900 dark:text-white">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Bouton de déconnexion */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center space-x-2 p-4 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 text-red-600 dark:text-red-400 rounded-2xl hover:from-red-100 hover:to-pink-100 dark:hover:from-red-900/30 dark:hover:to-pink-900/30 transition-all duration-200 shadow-sm hover:shadow-md group"
        >
          <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
          <span className="font-semibold">Se déconnecter</span>
        </button>
      </div>
    </div>
  );
}
