import { useEffect, useMemo, useState } from 'react';
import {
  Heart,
  Star,
  MapPin,
  Clock,
  Trash2,
  ArrowLeft,
  Search,
  RefreshCw,
  Loader2,
  Image as ImageIcon,
  Video,
  Play
} from 'lucide-react';
import ReservationModal from './ReservationModal';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';
import { api } from '../../lib/api';

type TabKey = 'providers' | 'services' | 'publications';

export default function FavoritesTab() {
  const { user } = useAuthStore();
  const { addNotification } = useAppStore();
  const [activeTab, setActiveTab] = useState<TabKey>('providers');
  const [favoriteProvidersData, setFavoriteProvidersData] = useState<any[]>([]);
  const [favoriteServicesData, setFavoriteServicesData] = useState<any[]>([]);
  const [favoritePublicationsData, setFavoritePublicationsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<any | null>(null);
  const [providerServices, setProviderServices] = useState<any[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [isReservationModalOpen, setIsReservationModalOpen] = useState(false);
  const [selectedServiceForReservation, setSelectedServiceForReservation] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const loadFavorites = async () => {
    try {
      setError(null);
      setLoading(true);
      const [providers, services, publications] = await Promise.all([
        api.favorites.listProviders(),
        api.favorites.listServices(),
        api.favorites.listPublications(),
      ]);
      setFavoriteProvidersData(providers);
      setFavoriteServicesData(services);
      setFavoritePublicationsData(publications);
    } catch (e: any) {
      setError(e.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadFavorites();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    void loadFavorites();
  };

  const removeWithConfirm = async (action: () => Promise<void>, message: string) => {
    if (!confirm('Retirer cet élément de vos favoris ?')) return;
    await action();
    addNotification({
      id: Date.now(),
      user_id: user?.id,
      titre: 'Favori supprimé',
      message,
      type: 'info',
      is_read: false,
      created_at: new Date().toISOString()
    });
  };

  const removeFavoriteProvider = (providerId: number) => removeWithConfirm(
    async () => {
      await api.favorites.removeProvider(providerId);
      setFavoriteProvidersData(prev => prev.filter(p => p.id !== providerId));
    },
    'Prestataire retiré de vos favoris'
  );

  const removeFavoriteService = (serviceId: number) => removeWithConfirm(
    async () => {
      await api.favorites.removeService(serviceId);
      setFavoriteServicesData(prev => prev.filter(s => s.id !== serviceId));
    },
    'Service retiré de vos favoris'
  );

  const removeFavoritePublication = (publicationId: number) => removeWithConfirm(
    async () => {
      await api.favorites.removePublication(publicationId);
      setFavoritePublicationsData(prev => prev.filter(p => p.id !== publicationId));
    },
    'Publication retirée de vos favoris'
  );

  const loadProviderServices = async (providerId: number) => {
    try {
      setLoadingServices(true);
      const services = await api.getServices({ prestataire_id: providerId });
      setProviderServices(services);
    } catch (e: any) {
      setError(e.message || 'Erreur de chargement des services');
    } finally {
      setLoadingServices(false);
    }
  };

  const handleProviderClick = (provider: any) => {
    setSelectedProvider(provider);
    void loadProviderServices(provider.id);
  };

  const handleBackToList = () => {
    setSelectedProvider(null);
    setProviderServices([]);
  };

  const counts = useMemo(() => ({
    providers: favoriteProvidersData.length,
    services: favoriteServicesData.length,
    publications: favoritePublicationsData.length,
    total: favoriteProvidersData.length + favoriteServicesData.length + favoritePublicationsData.length
  }), [favoriteProvidersData, favoriteServicesData, favoritePublicationsData]);

  const filteredProviders = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (activeTab !== 'providers' || !q) return favoriteProvidersData;
    return favoriteProvidersData.filter(p =>
      (p.nom_commercial || '').toLowerCase().includes(q) ||
      (p.ville || '').toLowerCase().includes(q)
    );
  }, [favoriteProvidersData, searchTerm, activeTab]);

  const filteredServices = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (activeTab !== 'services' || !q) return favoriteServicesData;
    return favoriteServicesData.filter(s =>
      (s.nom || '').toLowerCase().includes(q) ||
      (s.prestataire_nom || '').toLowerCase().includes(q)
    );
  }, [favoriteServicesData, searchTerm, activeTab]);

  const filteredPublications = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (activeTab !== 'publications' || !q) return favoritePublicationsData;
    return favoritePublicationsData.filter(p =>
      (p.description || '').toLowerCase().includes(q) ||
      (p.client_nom || '').toLowerCase().includes(q)
    );
  }, [favoritePublicationsData, searchTerm, activeTab]);

  const renderMediaGrid = (publication: any) => {
    const photos = publication.photos || [];
    const videos = publication.videos || [];
    const media = [...videos.map((v: string) => ({ type: 'video', src: v })), ...photos.map((p: string) => ({ type: 'photo', src: p }))];

    if (media.length === 0) return null;
    if (media.length === 1) {
      const item = media[0];
      return (
        <div className="rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 mb-3">
          {item.type === 'photo' ? (
            <img src={item.src} alt="Publication" className="w-full object-cover max-h-72" />
          ) : (
            <video src={item.src} controls className="w-full" />
          )}
        </div>
      );
    }

    const visibleMedia = media.slice(0, 4);
    return (
      <div className="grid grid-cols-2 gap-1 mb-3 rounded-2xl overflow-hidden">
        {visibleMedia.map((item: any, index: number) => (
          <div key={index} className="relative aspect-square bg-gray-100 dark:bg-gray-800">
            {item.type === 'photo' ? (
              <img src={item.src} alt={`media-${index}`} className="w-full h-full object-cover" />
            ) : (
              <video src={item.src} className="w-full h-full object-cover" />
            )}
            {item.type === 'video' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <Play className="w-8 h-8 text-white" />
              </div>
            )}
            {index === 3 && media.length > 4 && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-lg font-semibold">
                +{media.length - 4}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  if (selectedProvider) {
    return (
      <>
        {isReservationModalOpen && selectedServiceForReservation && (
          <ReservationModal 
            service={selectedServiceForReservation}
            onClose={() => setIsReservationModalOpen(false)}
            onReservationSuccess={() => {
              addNotification({
                id: Date.now(),
                titre: 'Réservation confirmée',
                message: `Votre réservation pour ${selectedServiceForReservation.nom} est en attente de confirmation.`,
                type: 'success',
              });
            }}
          />
        )}
        <div className="p-4 space-y-6 max-w-md mx-auto">
          <button
            onClick={handleBackToList}
            className="inline-flex items-center space-x-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Retour aux favoris</span>
          </button>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {(Array.isArray(selectedProvider.photos_etablissement) && selectedProvider.photos_etablissement[0]) && (
              <img 
                src={selectedProvider.photos_etablissement[0]} 
                alt={selectedProvider.nom_commercial}
                className="w-full h-40 object-cover"
              />
            )}
            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {selectedProvider.nom_commercial}
                  </h2>
                  <div className="flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-400 mt-1">
                    <MapPin className="w-4 h-4" />
                    <span>{selectedProvider.ville}</span>
                  </div>
                </div>
                {selectedProvider.is_verified && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                    Vérifié
                  </span>
                )}
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-400">
                {selectedProvider.bio || 'Aucune description disponible.'}
              </p>

              <div className="flex items-center space-x-1">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span className="text-sm font-medium">
                  {parseFloat(selectedProvider.note_moyenne ?? 0).toFixed(1)}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  ({selectedProvider.nombre_avis ?? 0} avis)
                </span>
              </div>
            </div>
          </div>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Services proposés
          </h3>
          
          {loadingServices ? (
            <div className="flex flex-col items-center py-10 text-gray-500">
              <Loader2 className="w-8 h-8 animate-spin mb-3" />
              <p>Chargement des services...</p>
            </div>
          ) : providerServices.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              Aucun service disponible pour l’instant
            </div>
          ) : (
            <div className="space-y-4">
              {providerServices.map(service => (
                <div key={service.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
                  <h4 className="font-semibold text-gray-900 dark:text-white">
                    {service.nom}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {service.description || 'Description indisponible.'}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 text-sm">
                      <span className="font-semibold text-lg text-blue-600 dark:text-blue-400">
                        {(service.prix ?? 0).toLocaleString()} {service.devise || 'FCFA'}
                      </span>
                      <div className="flex items-center space-x-1 text-gray-500 dark:text-gray-400">
                        <Clock className="w-4 h-4" />
                        <span>{service.duree_minutes}min</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        setSelectedServiceForReservation(service);
                        setIsReservationModalOpen(true);
                      }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                    >
                      Réserver
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </>
    );
  }

  const currentData = activeTab === 'providers'
    ? filteredProviders
    : activeTab === 'services'
      ? filteredServices
      : filteredPublications;

  const isSearching = searchTerm.trim().length > 0;

  return (
    <>
      {isReservationModalOpen && selectedServiceForReservation && (
        <ReservationModal 
          service={selectedServiceForReservation}
          onClose={() => setIsReservationModalOpen(false)}
          onReservationSuccess={() => {
            addNotification({
              id: Date.now(),
              titre: 'Réservation confirmée',
              message: `Votre réservation pour ${selectedServiceForReservation.nom} est en attente de confirmation.`,
              type: 'success',
            });
          }}
        />
      )}
      <div className="p-4 space-y-6 max-w-md mx-auto">
        <div className="space-y-1">
          <p className="text-xs uppercase text-gray-400">Favoris</p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Mes favoris
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {counts.total} élément{counts.total > 1 ? 's' : ''} sauvegardé{counts.total > 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher dans vos favoris..."
              className="w-full pl-10 pr-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchTerm && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-blue-500"
                onClick={() => setSearchTerm('')}
              >
                Effacer
              </button>
            )}
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium flex items-center space-x-1 text-blue-600 dark:text-blue-400 disabled:opacity-50"
          >
            {refreshing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>Actualiser</span>
              </>
            )}
          </button>
        </div>

        <div className="flex space-x-1 mb-3 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {[
            { key: 'providers', label: `Prestataires (${counts.providers})`, icon: Heart },
            { key: 'services', label: `Services (${counts.services})`, icon: Star },
            { key: 'publications', label: `Publications (${counts.publications})`, icon: ImageIcon }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabKey)}
              className={`flex-1 py-2 px-3 rounded-md text-xs font-medium transition-colors inline-flex items-center justify-center space-x-1 ${
                activeTab === tab.key
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="truncate">{tab.label}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col items-center py-16 text-gray-500 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p>Chargement de vos favoris...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-500">{error}</div>
        ) : currentData.length === 0 ? (
          <div className="text-center py-12">
            <Heart className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Aucun favori
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              {isSearching
                ? 'Aucun résultat ne correspond à votre recherche.'
                : 'Ajoutez des prestataires, services ou publications à vos favoris pour les retrouver facilement.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeTab === 'providers' && filteredProviders.map(prestataire => (
              <div key={prestataire.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="relative">
                  {(Array.isArray(prestataire.photos_etablissement) && prestataire.photos_etablissement[0]) && (
                    <img 
                      src={prestataire.photos_etablissement[0]} 
                      alt={prestataire.nom_commercial}
                      className="w-full h-36 object-cover"
                    />
                  )}
                  <button
                    onClick={() => removeFavoriteProvider(prestataire.id)}
                    className="absolute top-3 right-3 p-2 bg-white dark:bg-gray-800 rounded-full shadow-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
                
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {prestataire.nom_commercial}
                      </h3>
                      <div className="flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-400 mt-1">
                        <MapPin className="w-4 h-4" />
                        <span>{prestataire.ville}</span>
                      </div>
                    </div>
                    {prestataire.is_verified && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                        Vérifié
                      </span>
                    )}
                  </div>
                  
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                    {prestataire.bio || 'Aucune description'}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm font-medium">
                        {parseFloat(prestataire.note_moyenne ?? 0).toFixed(1)}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        ({prestataire.nombre_avis ?? 0} avis)
                      </span>
                    </div>
                    <button 
                      onClick={() => handleProviderClick(prestataire)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                    >
                      Voir services
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {activeTab === 'services' && filteredServices.map(service => (
              <div key={service.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                {(Array.isArray(service.photos) && service.photos[0]) && (
                  <img 
                    src={service.photos[0]} 
                    alt={service.nom}
                    className="w-full h-36 object-cover"
                  />
                )}
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {service.nom}
                      </h3>
                      {service.prestataire_nom && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          chez {service.prestataire_nom}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => removeFavoriteService(service.id)}
                      className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>

                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                    {service.description || 'Description indisponible.'}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 text-sm">
                      <span className="font-semibold text-lg text-blue-600 dark:text-blue-400">
                        {(service.prix ?? 0).toLocaleString()} {service.devise || 'FCFA'}
                      </span>
                      <div className="flex items-center space-x-1 text-gray-500 dark:text-gray-400">
                        <Clock className="w-4 h-4" />
                        <span>{service.duree_minutes}min</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        setSelectedServiceForReservation(service);
                        setIsReservationModalOpen(true);
                      }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                    >
                      Réserver
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {activeTab === 'publications' && filteredPublications.map(publication => (
              <div key={publication.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start space-x-3 mb-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                      {publication.photo_profil ? (
                        <img 
                          src={publication.photo_profil} 
                          alt={`${publication.client_prenom} ${publication.client_nom}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold">
                          {publication.client_prenom?.[0]}{publication.client_nom?.[0]}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                            {publication.client_prenom} {publication.client_nom}
                          </h3>
                          <p className="text-xs text-gray-500">
                            Ajoutée à vos favoris
                          </p>
                        </div>
                        <button
                          onClick={() => removeFavoritePublication(publication.id)}
                          className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <p className="text-gray-900 dark:text-white mb-3 text-sm leading-relaxed">
                    {publication.description}
                  </p>

                  {renderMediaGrid(publication)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
