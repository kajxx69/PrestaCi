import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, Clock, MapPin, Phone, Star, MessageCircle, RefreshCw, Loader2, Search, Info, X } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { api } from '../../lib/api';
import RatingModal from './RatingModal';

export default function ReservationsTab() {
  const { showToast } = useAppStore();
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'upcoming' | 'completed' | 'cancelled'>('all');
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [ratingModal, setRatingModal] = useState<{ isOpen: boolean; reservation: any }>({
    isOpen: false,
    reservation: null
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReservation, setSelectedReservation] = useState<any | null>(null);

  const loadReservations = useCallback(async () => {
    try {
      setError(null);
      const rows = await api.reservations.list(selectedFilter === 'all' ? undefined : selectedFilter);
      setReservations(rows);
    } catch (e: any) {
      setError(e.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
      setActionLoading(null);
    }
  }, [selectedFilter]);

  useEffect(() => {
    setLoading(true);
    loadReservations();
  }, [loadReservations]);

  const getStatusColor = (reservation: any) => reservation.statut_couleur || '#6B7280';
  const getStatusText = (reservation: any) => reservation.statut_nom || 'inconnu';

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return 'Date invalide';
    }
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleCancel = async (id: number) => {
    if (!confirm('Confirmer l\'annulation de cette réservation ?')) return;
    try {
      setActionLoading(id);
      await api.reservations.cancel(id);
      await loadReservations();
      showToast('Réservation annulée', 'success');
    } catch (e: any) {
      setError(e.message || 'Impossible d\'annuler');
      showToast('Erreur lors de l\'annulation', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenRating = (reservation: any) => {
    setRatingModal({ isOpen: true, reservation });
  };

  const handleCloseRating = () => {
    setRatingModal({ isOpen: false, reservation: null });
  };

  const handleRatingSuccess = async () => {
    await loadReservations();
  };

  const handleContact = (reservation: any) => {
    if (reservation.prestataire_telephone) {
      window.open(`tel:${reservation.prestataire_telephone}`, '_self');
    } else {
      showToast('Numéro de téléphone non disponible', 'error');
    }
  };

  const handleCloseDetails = () => setSelectedReservation(null);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadReservations();
  };

  const statusMeta = useMemo(() => (reservation: any) => ({
    canCancel: reservation.can_cancel ?? ['en_attente', 'confirmee'].includes(reservation.statut_nom),
    canRate: reservation.statut_nom === 'terminee' && !reservation.a_laisse_avis,
  }), []);

  const summary = useMemo(() => ({
    total: reservations.length,
    upcoming: reservations.filter(r => ['en_attente', 'confirmee'].includes(r.statut_nom)).length,
    completed: reservations.filter(r => r.statut_nom === 'terminee').length,
    cancelled: reservations.filter(r => ['annulee', 'refusee'].includes(r.statut_nom)).length
  }), [reservations]);

  const filteredReservations = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return reservations;
    return reservations.filter(r =>
      (r.service_nom || '').toLowerCase().includes(q) ||
      (r.prestataire_nom || '').toLowerCase().includes(q) ||
      String(r.reference || r.id).includes(q)
    );
  }, [reservations, searchTerm]);

  return (
    <div className="p-4 space-y-6 max-w-md mx-auto">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Mes réservations
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {summary.total} réservation{summary.total > 1 ? 's' : ''} gérées
            </p>
          </div>
          <button
            onClick={handleRefresh}
            className="inline-flex items-center text-sm text-blue-600 dark:text-blue-400 font-medium px-3 py-1.5 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20 transition disabled:opacity-50"
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Actualisation...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Actualiser
              </>
            )}
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher par service, prestataire ou référence..."
            className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'À venir', value: summary.upcoming, color: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200' },
            { label: 'Terminées', value: summary.completed, color: 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-200' },
            { label: 'Annulées', value: summary.cancelled, color: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-200' },
            { label: 'Total', value: summary.total, color: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200' }
          ].map(stat => (
            <div key={stat.label} className={`rounded-2xl px-4 py-3 ${stat.color}`}>
              <p className="text-xs uppercase tracking-wide">{stat.label}</p>
              <p className="text-xl font-semibold">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="flex space-x-2 mb-6 overflow-x-auto">
          {([
            { key: 'all', label: 'Toutes' },
            { key: 'upcoming', label: 'À venir' },
            { key: 'completed', label: 'Terminées' },
            { key: 'cancelled', label: 'Annulées' }
          ] as const).map(filter => (
            <button
              key={filter.key}
              onClick={() => setSelectedFilter(filter.key as any)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedFilter === filter.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12 text-gray-500 flex flex-col items-center space-y-3">
              <Loader2 className="w-10 h-10 animate-spin" />
              <p>Chargement des réservations...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12 space-y-4">
              <p className="text-red-600">{error}</p>
              <button
                onClick={handleRefresh}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700"
              >
                Réessayer
              </button>
            </div>
          ) : filteredReservations.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {searchTerm ? 'Aucun résultat' : 'Aucune réservation'}
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                {searchTerm
                  ? 'Aucune réservation ne correspond à votre recherche'
                  : selectedFilter === 'all' 
                  ? 'Vous n\'avez pas encore de réservations'
                  : `Aucune réservation ${selectedFilter === 'upcoming' ? 'à venir' : selectedFilter === 'completed' ? 'terminée' : 'annulée'}`}
              </p>
            </div>
          ) : (
            filteredReservations.map((reservation: any) => {
              const statusColor = getStatusColor(reservation);
              const statusText = getStatusText(reservation);
              const meta = statusMeta(reservation);

              return (
                <div
                  key={reservation.id}
                  className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm cursor-pointer hover:shadow-lg transition"
                  onClick={() => setSelectedReservation(reservation)}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {reservation.service_nom}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {reservation.prestataire_nom}
                      </p>
                    </div>
                    <div className="flex flex-col items-end space-y-1">
                      <span 
                        className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold text-white shadow"
                        style={{ backgroundColor: statusColor }}
                      >
                        {statusText}
                      </span>
                      <span className="text-xs text-gray-400">
                        Réf. #{reservation.reference || reservation.id}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {formatDate(reservation.date_reservation)}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                      <Clock className="w-4 h-4" />
                      <span>{reservation.heure_debut} - {reservation.heure_fin}</span>
                    </div>

                    {!reservation.a_domicile && reservation.prestataire_adresse && (
                      <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                        <MapPin className="w-4 h-4" />
                        <span>{reservation.prestataire_adresse}</span>
                      </div>
                    )}

                    {reservation.a_domicile && reservation.adresse_rdv && (
                      <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                        <MapPin className="w-4 h-4" />
                        <span>À domicile - {reservation.adresse_rdv}</span>
                      </div>
                    )}

                    {reservation.prestataire_telephone && (
                      <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                        <Phone className="w-4 h-4" />
                        <span>{reservation.prestataire_telephone}</span>
                      </div>
                    )}

                    {reservation.note_moyenne && (
                      <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        <span>{reservation.note_moyenne.toFixed(1)} / 5</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col space-y-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <div className="text-lg font-semibold text-gray-900 dark:text-white">
                        {reservation.prix_final.toLocaleString()} {reservation.devise}
                      </div>
                      <div className="text-xs text-gray-500">
                        Créée le {formatDate(reservation.created_at || reservation.date_reservation)}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {meta.canRate && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenRating(reservation);
                          }}
                          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-200"
                        >
                          Noter l’expérience
                        </button>
                      )}
                      
                      {meta.canCancel && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancel(reservation.id);
                          }}
                          disabled={actionLoading === reservation.id}
                          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-200 disabled:opacity-50"
                        >
                          {actionLoading === reservation.id ? 'Annulation...' : 'Annuler'}
                        </button>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleContact(reservation);
                        }}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-200 inline-flex items-center"
                      >
                        <Phone className="w-4 h-4 mr-1" />
                        Appeler
                      </button>

                      {reservation.chat_support && (
                        <button
                          onClick={() => showToast('Messagerie en cours d’intégration', 'info')}
                          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/20 dark:text-purple-200 inline-flex items-center"
                        >
                          <MessageCircle className="w-4 h-4 mr-1" />
                          Discuter
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {selectedReservation && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 p-4 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase text-gray-400">Détails</p>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {selectedReservation.service_nom}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedReservation.prestataire_nom}
                </p>
              </div>
              <button
                onClick={handleCloseDetails}
                className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-blue-500" />
                <span>{formatDate(selectedReservation.date_reservation)}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-blue-500" />
                <span>{selectedReservation.heure_debut} - {selectedReservation.heure_fin}</span>
              </div>
              {(selectedReservation.prestataire_adresse || selectedReservation.adresse_rdv) && (
                <div className="flex items-start space-x-2">
                  <MapPin className="w-4 h-4 text-blue-500 mt-0.5" />
                  <span>{selectedReservation.adresse_rdv || selectedReservation.prestataire_adresse}</span>
                </div>
              )}
              {selectedReservation.notes_client && (
                <div className="flex items-start space-x-2">
                  <Info className="w-4 h-4 text-blue-500 mt-0.5" />
                  <span>{selectedReservation.notes_client}</span>
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-gray-50 dark:bg-gray-800 p-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-gray-500">Total payé</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {selectedReservation.prix_final.toLocaleString()} {selectedReservation.devise}
                </p>
              </div>
              <span
                className="px-3 py-1 rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: getStatusColor(selectedReservation) }}
              >
                {getStatusText(selectedReservation)}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {selectedReservation.prestataire_telephone && (
                <button
                  onClick={() => handleContact(selectedReservation)}
                  className="flex-1 min-w-[45%] px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold flex items-center justify-center space-x-2"
                >
                  <Phone className="w-4 h-4" />
                  <span>Appeler</span>
                </button>
              )}
              <button
                onClick={() => {
                  if (selectedReservation.prestataire_adresse) {
                    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedReservation.prestataire_adresse)}`);
                  } else {
                    showToast('Adresse non disponible', 'error');
                  }
                }}
                className="flex-1 min-w-[45%] px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 font-semibold text-gray-700 dark:text-gray-200 flex items-center justify-center space-x-2"
              >
                <MapPin className="w-4 h-4" />
                <span>Itinéraire</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <RatingModal
        isOpen={ratingModal.isOpen}
        reservation={ratingModal.reservation}
        onClose={handleCloseRating}
        onSuccess={handleRatingSuccess}
      />
    </div>
  );
}
