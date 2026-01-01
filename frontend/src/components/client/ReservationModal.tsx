import { useState, useEffect } from 'react';
import { X, Calendar, Clock, Home, MessageSquare, ArrowRight } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { fr } from 'date-fns/locale';
import { api } from '../../lib/api';

export default function ReservationModal({ service, onClose, onReservationSuccess }: any) {
  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [isDomicile, setIsDomicile] = useState(false);
  const [adresseRdv, setAdresseRdv] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const availableTimes = Array.from({ length: 18 }, (_, i) => {
    const hour = 8 + Math.floor((i * 30) / 60);
    const minute = (i * 30) % 60;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  });

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    setSelectedTime(null);
  };

  const handleSubmit = async () => {
    if (!selectedDate || !selectedTime) {
      setError('Veuillez sélectionner une date et une heure.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const reservationData = {
        service_id: service.id,
        date_reservation: selectedDate.toISOString().split('T')[0],
        heure_debut: selectedTime,
        notes_client: notes,
        a_domicile: isDomicile,
        adresse_rdv: isDomicile ? adresseRdv : '',
      };

      const newReservation = await api.reservations.create(reservationData);
      onReservationSuccess(newReservation);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1200] p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md mx-auto shadow-xl transform transition-all">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Réserver: {service.nom}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {step === 1 ? (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-gray-700 dark:text-gray-300">
                <Calendar className="w-5 h-5" />
                <h3 className="font-semibold">Choisissez une date</h3>
              </div>
              <DayPicker
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                locale={fr}
                disabled={{ before: new Date() }}
                className="w-full flex justify-center"                
              />
              {selectedDate && (
                 <div className="pt-4">
                  <div className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 mb-3">
                    <Clock className="w-5 h-5" />
                    <h3 className="font-semibold">Choisissez une heure</h3>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {availableTimes.map(time => (
                      <button 
                        key={time}
                        onClick={() => setSelectedTime(time)}
                        className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                          selectedTime === time
                            ? 'bg-blue-600 text-white font-semibold'
                            : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {service.is_domicile && (
                <div>
                  <div className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 mb-3">
                    <Home className="w-5 h-5" />
                    <h3 className="font-semibold">Service à domicile</h3>
                  </div>
                   <label className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <input type="checkbox" checked={isDomicile} onChange={e => setIsDomicile(e.target.checked)} className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm text-gray-800 dark:text-gray-200">Je souhaite que le prestataire vienne à mon adresse</span>
                  </label>
                  {isDomicile && (
                    <input 
                      type="text"
                      value={adresseRdv}
                      onChange={e => setAdresseRdv(e.target.value)}
                      placeholder="Entrez votre adresse complète"
                      className="mt-2 w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    />
                  )}
                </div>
              )}
              <div>
                <div className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 mb-3">
                  <MessageSquare className="w-5 h-5" />
                  <h3 className="font-semibold">Notes pour le prestataire (optionnel)</h3>
                </div>
                <textarea 
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Avez-vous des instructions particulières ?"
                  className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>}
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-2xl">
          {step === 1 ? (
            <button 
              onClick={() => setStep(2)}
              disabled={!selectedDate || !selectedTime}
              className="w-full flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all"
            >
              <span>Suivant</span>
              <ArrowRight className="w-5 h-5 ml-2" />
            </button>
          ) : (
            <div className="flex items-center justify-between">
              <button onClick={() => setStep(1)} className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:underline">Précédent</button>
              <button 
                onClick={handleSubmit}
                disabled={loading}
                className="px-6 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 disabled:bg-gray-400 transition-all"
              >
                {loading ? 'Confirmation...' : `Confirmer pour ${service.prix.toLocaleString()} ${service.devise}`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
