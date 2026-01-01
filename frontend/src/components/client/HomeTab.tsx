import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, MapPin, Star, Heart, Clock, Loader2 } from 'lucide-react';
import ReservationModal from './ReservationModal';
import MapView from '../map/MapView';
import { api, ApiCategory, ApiSubCategory, ApiPrestataire, ApiService } from '../../lib/api';
import { useAppStore } from '../../store/appStore';

interface HomeTabProps {
  onSelectService: (serviceId: number) => void;
  onSelectProvider: (providerId: number) => void;
}

export default function HomeTab({ onSelectService, onSelectProvider }: HomeTabProps) {
  const { showToast } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ApiCategory | null>(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState<ApiSubCategory | null>(null);

  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [subCategories, setSubCategories] = useState<ApiSubCategory[]>([]);
  const [prestataires, setPrestataires] = useState<ApiPrestataire[]>([]);
  const [services, setServices] = useState<ApiService[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [route, setRoute] = useState<[number, number][]>([]);
  const [routeMsg, setRouteMsg] = useState<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [favoriteProviders, setFavoriteProviders] = useState<number[]>([]);
  const [isReservationModalOpen, setIsReservationModalOpen] = useState(false);
  const [selectedServiceForReservation, setSelectedServiceForReservation] = useState<any | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  const loadInitialData = useCallback(async () => {
    setLoadingData(true);
    setDataError(null);
    try {
      const [cats, subs, provs, servs, favProvs] = await Promise.all([
        api.getCategories(),
        api.getSubCategories(),
        api.getPrestataires(),
        api.getServices(),
        api.favorites.listProviders().catch(() => [])
      ]);
      setCategories(cats);
      setSubCategories(subs);
      setPrestataires(provs);
      setServices(servs);
      setFavoriteProviders(favProvs.map((fav: any) => fav.prestataire_id));
    } catch (e: any) {
      setDataError("Impossible de charger les données d'accueil.");
      showToast('Erreur lors du chargement des données', 'error');
    } finally {
      setLoadingData(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Get user location once (with graceful fallback)
  useEffect(() => {
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserLocation([latitude, longitude]);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 60000, timeout: 10000 }
    );
    return () => {
      // no watch to clear because we used getCurrentPosition
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const subs = await api.getSubCategories(selectedCategory?.id);
        if (mounted) setSubCategories(subs);
      } catch {}
    })();
    return () => { mounted = false; };
  }, [selectedCategory?.id]);

  const filteredPrestataires = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return prestataires.filter(p => !q || (p.nom_commercial || '').toLowerCase().includes(q));
  }, [prestataires, searchQuery]);

  const filteredServices = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return services.filter(s => {
      const matchesQuery = !q || (s.nom || '').toLowerCase().includes(q);
      const matchesSub = !selectedSubCategory || s.sous_categorie_id === selectedSubCategory.id;
      return matchesQuery && matchesSub;
    });
  }, [services, searchQuery, selectedSubCategory]);

  const getSubCategoriesByCategory = (categoryId: number) => {
    return subCategories.filter(sc => sc.categorie_id === categoryId);
  };

  const resetFilters = () => {
    setSelectedCategory(null);
    setSelectedSubCategory(null);
  };

  const defaultCenter: [number, number] = [5.3599517, -3.9810768]; // Abidjan

  const distanceKm = (a: [number, number], b: [number, number]) => {
    const toRad = (v: number) => (v * Math.PI) / 180;
    const R = 6371; // km
    const dLat = toRad(b[0] - a[0]);
    const dLng = toRad(b[1] - a[1]);
    const lat1 = toRad(a[0]);
    const lat2 = toRad(b[0]);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  };
  const markers = useMemo(() => {
    return filteredPrestataires
      .filter(p => typeof p.latitude === 'number' && typeof p.longitude === 'number')
      .map(p => {
        const pos = [p.latitude as number, p.longitude as number] as [number, number];
        const dist = userLocation ? distanceKm(userLocation, pos) : null;
        const distLabel = dist != null ? ` • ${(dist < 1 ? Math.round(dist * 1000) + ' m' : dist.toFixed(1) + ' km')}` : '';
        return {
          id: p.id,
          position: pos,
          title: p.nom_commercial,
          subtitle: (p.ville || '') + distLabel,
          rating: typeof p.note_moyenne === 'number' ? p.note_moyenne : parseFloat(String(p.note_moyenne || 0)),
        };
      });
  }, [filteredPrestataires, userLocation]);

  const handleMarkerClick = async (marker: { id: number; position: [number, number] }) => {
    try {
      setRouteError(null);
      if (!userLocation) {
        setRouteError("Position utilisateur indisponible");
        return;
      }
      setLoadingRoute(true);
      const from = { lat: userLocation[0], lng: userLocation[1] };
      const to = { lat: marker.position[0], lng: marker.position[1] };
      // OSRM expects lon,lat order in the URL
      const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`OSRM ${res.status}`);
      const data = await res.json();
      const coords: [number, number][]= (data?.routes?.[0]?.geometry?.coordinates || []).map((c: [number, number]) => [c[1], c[0]]);
      if (!coords.length) throw new Error('Aucun itinéraire');
      setRoute(coords);
      setRouteMsg('Itinéraire affiché');
      setTimeout(() => setRouteMsg(null), 3000);
    } catch (e: any) {
      setRouteError(e.message || 'Erreur de calcul d\'itinéraire');
    } finally {
      setLoadingRoute(false);
    }
  };

  const clearRoute = () => {
    setRoute([]);
    setRouteMsg(null);
    setRouteError(null);
  };

  const handleToggleFavorite = async (prestataire_id: number) => {
    try {
      const isFavorite = favoriteProviders.includes(prestataire_id);
      
      if (isFavorite) {
        await api.favorites.removeProvider(prestataire_id);
        setFavoriteProviders(prev => prev.filter(id => id !== prestataire_id));
        showToast('Retiré des favoris', 'success');
      } else {
        await api.favorites.addProvider(prestataire_id);
        setFavoriteProviders(prev => [...prev, prestataire_id]);
        showToast('Ajouté aux favoris', 'success');
      }
    } catch (error: any) {
      showToast('Erreur lors de la mise à jour des favoris', 'error');
    }
  };

  const sortedPrestataires = useMemo(() => {
    if (!userLocation) return filteredPrestataires;
    const getDist = (p: ApiPrestataire) =>
      typeof p.latitude === 'number' && typeof p.longitude === 'number'
        ? distanceKm(userLocation, [p.latitude as number, p.longitude as number])
        : Number.POSITIVE_INFINITY;
    return [...filteredPrestataires].sort((a, b) => getDist(a) - getDist(b));
  }, [filteredPrestataires, userLocation]);

  return (
    <>
      {isReservationModalOpen && selectedServiceForReservation && (
        <ReservationModal 
          service={selectedServiceForReservation}
          onClose={() => setIsReservationModalOpen(false)}
          onReservationSuccess={() => {
            showToast('Réservation confirmée', 'success');
          }}
        />
      )}
      <div className="p-4 space-y-6 max-w-md mx-auto">
      {/* Search Bar */}
      <div className="relative group">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Rechercher un service ou prestataire..."
          className="w-full pl-10 pr-4 py-3.5 border border-gray-300 dark:border-gray-600 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:shadow-md transition-all duration-200"
        />
      </div>

      {/* Location */}
      <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded-xl">
        <MapPin className="w-4 h-4 text-blue-600" />
        <span className="text-sm font-medium">Abidjan, Côte d'Ivoire</span>
      </div>

      {/* Map */}
      {(routeMsg || loadingRoute) && (
        <div className="p-3 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 text-green-700 dark:text-green-300 text-sm font-medium shadow-sm flex items-center space-x-2">
          {loadingRoute && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>{loadingRoute ? 'Calcul de l\'itinéraire...' : routeMsg}</span>
        </div>
      )}
      {routeError && (
        <div className="p-3 rounded-xl bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 text-red-700 dark:text-red-300 text-sm font-medium shadow-sm">
          {routeError}
        </div>
      )}
      {!loadingData && (
        <MapView
          center={userLocation || defaultCenter}
          markers={markers}
          userLocation={userLocation || undefined}
          onMarkerClick={handleMarkerClick}
          route={route}
        />
      )}
      {route.length > 0 && (
        <div className="flex justify-end mt-2">
          <button onClick={clearRoute} className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium px-4 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200">Effacer l'itinéraire</button>
        </div>
      )}

      {/* Categories */}
      {!selectedCategory && !loadingData && (
        <div>
          <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
            Catégories
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {categories.map(category => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category)}
                className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 hover:shadow-xl hover:border-transparent transition-all duration-300 hover:scale-105 group"
              >
                <div 
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-md group-hover:shadow-lg transition-all duration-300 group-hover:scale-110"
                  style={{ backgroundColor: (category.couleur || '#3B82F6') + '20' }}
                >
                  <span className="text-3xl" style={{ color: category.couleur || '#3B82F6' }}>
                    ✨
                  </span>
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                  {category.nom}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                  {category.description}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sub-categories */}
      {selectedCategory && !selectedSubCategory && !loadingData && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {selectedCategory.nom}
            </h2>
            <button 
              onClick={resetFilters}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium px-3 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200"
            >
              Retour
            </button>
          </div>
          <div className="space-y-2">
            {getSubCategoriesByCategory(selectedCategory.id).map(subCategory => (
              <button
                key={subCategory.id}
                onClick={() => setSelectedSubCategory(subCategory)}
                className="w-full p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 hover:shadow-lg hover:scale-[1.02] transition-all duration-200 text-left"
              >
                <h3 className="font-medium text-gray-900 dark:text-white">
                  {subCategory.nom}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {subCategory.description}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Services when subcategory is selected */}
      {selectedSubCategory && !loadingData && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {selectedSubCategory.nom}
            </h2>
            <button 
              onClick={() => setSelectedSubCategory(null)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium px-3 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200"
            >
              Retour
            </button>
          </div>
          <div className="space-y-4">
            {filteredServices.map(service => {
              const prestataire = prestataires.find(p => p.id === service.prestataire_id);
              return (
                <div
                  key={service.id}
                  onClick={() => onSelectService(service.id)}
                  className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-xl hover:border-transparent hover:scale-[1.02] transition-all duration-300 cursor-pointer group"
                >
                  {Array.isArray(service.photos) && service.photos[0] && (
                    <div className="relative overflow-hidden">
                      <img 
                        src={service.photos[0]} 
                        alt={service.nom}
                        className="w-full h-40 object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                      {service.nom}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {service.description}
                    </p>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-bold text-lg bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                        {service.prix.toLocaleString()} {service.devise || 'XOF'}
                      </span>
                      <div className="flex items-center space-x-1 text-gray-500 dark:text-gray-400">
                        <Clock className="w-4 h-4" />
                        <span>{service.duree_minutes}min</span>
                      </div>
                    </div>

                    {prestataire && (
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{prestataire.nom_commercial}</p>
                          <div className="flex items-center space-x-1 text-xs text-gray-500">
                            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                            <span>{service.note_moyenne?.toFixed(1) ?? 'N/A'}</span>
                          </div>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedServiceForReservation(service);
                            setIsReservationModalOpen(true);
                          }}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
                        >
                          Réserver
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Prestataires populaires when no category is selected */}
      {!selectedCategory && !loadingData && (
        <div>
          <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
            Prestataires populaires
          </h2>
          <div className="space-y-4">
            {sortedPrestataires.map(prestataire => (
              <div
                key={prestataire.id}
                onClick={() => onSelectProvider(prestataire.id)}
                className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-xl hover:border-transparent hover:scale-[1.02] transition-all duration-300 cursor-pointer group"
              >
                {Array.isArray(prestataire.photos_etablissement) && prestataire.photos_etablissement[0] && (
                  <div className="relative overflow-hidden">
                    <img 
                      src={prestataire.photos_etablissement[0]} 
                      alt={prestataire.nom_commercial}
                      className="w-full h-40 object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                  </div>
                )}
                <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {prestataire.nom_commercial}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {prestataire.ville}
                          {typeof prestataire.latitude === 'number' && typeof prestataire.longitude === 'number' && userLocation && (
                            <>
                              {' '}
                              ·{' '}
                              {(() => {
                                const d = distanceKm(userLocation, [prestataire.latitude as number, prestataire.longitude as number]);
                                return d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`;
                              })()}
                            </>
                          )}
                        </p>
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleFavorite(prestataire.id);
                        }}
                        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all duration-200 hover:scale-110 group"
                      >
                        <Heart className={`w-5 h-5 transition-all duration-200 ${
                          favoriteProviders.includes(prestataire.id)
                            ? 'text-red-500 fill-red-500'
                            : 'text-gray-400 group-hover:text-red-500 group-hover:fill-red-500'
                        }`} />
                      </button>
                    </div>
                  
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                    {/* bio non exposée par l'API actuelle */}
                  </p>
                  
                    <div className="flex items-center space-x-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      {typeof prestataire.note_moyenne === 'number' && (
                        <>
                          <span className="text-sm font-medium">{prestataire.note_moyenne.toFixed(1)}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">({prestataire.nombre_avis || 0} avis)</span>
                        </>
                      )}
                    </div>
                    {prestataire.is_verified ? (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 text-blue-800 dark:text-blue-200 shadow-sm">
                        ✓ Vérifié
                      </span>
                    ) : <span />}
                  </div>
                </div>
            ))}
          </div>
        </div>
      )}
      {loadingData && (
        <div className="flex flex-col items-center justify-center space-y-3 py-12 text-gray-500 dark:text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p>Chargement des recommandations...</p>
        </div>
      )}

      {dataError && !loadingData && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 space-y-3">
          <p className="font-semibold">{dataError}</p>
          <button
            onClick={loadInitialData}
            className="inline-flex items-center px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
          >
            Réessayer
          </button>
        </div>
      )}
    </div>
    </>
  );
}
