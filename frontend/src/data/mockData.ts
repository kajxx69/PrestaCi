import { User, Role, Category, SubCategory, PlanAbonnement, Prestataire, Service, Reservation, StatutReservation, Publication } from '../types';

export const mockRoles: Role[] = [
  { id: 1, nom: 'client', description: 'Utilisateur client', created_at: '2024-01-01T00:00:00Z' },
  { id: 2, nom: 'prestataire', description: 'Prestataire de services', created_at: '2024-01-01T00:00:00Z' },
  { id: 3, nom: 'admin', description: 'Administrateur', created_at: '2024-01-01T00:00:00Z' }
];

export const mockUsers: User[] = [
  {
    id: 1,
    email: 'admin@prestaci.ci',
    role_id: 3,
    nom: 'Admin',
    prenom: 'PrestaCI',
    telephone: '+225 01 02 03 04 05',
    photo_profil: 'https://images.pexels.com/photos/3760790/pexels-photo-3760790.jpeg?auto=compress&cs=tinysrgb&w=150',
    pays: 'Côte d\'Ivoire',
    langue_preferee: 'fr',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 2,
    email: 'client@prestaci.ci',
    role_id: 1,
    nom: 'Kouadio',
    prenom: 'Adjoua',
    telephone: '+225 07 08 09 10 11',
    photo_profil: 'https://images.pexels.com/photos/3785078/pexels-photo-3785078.jpeg?auto=compress&cs=tinysrgb&w=150',
    ville: 'Abidjan',
    pays: 'Côte d\'Ivoire',
    langue_preferee: 'fr',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 3,
    email: 'prestataire@prestaci.ci',
    role_id: 2,
    nom: 'Diallo',
    prenom: 'Mamadou',
    telephone: '+225 05 06 07 08 09',
    photo_profil: 'https://images.pexels.com/photos/3756678/pexels-photo-3756678.jpeg?auto=compress&cs=tinysrgb&w=150',
    ville: 'Abidjan',
    pays: 'Côte d\'Ivoire',
    langue_preferee: 'fr',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  }
];

export const mockCategories: Category[] = [
  {
    id: 1,
    nom: 'Beauté',
    description: 'Services de beauté et esthétique',
    icone: 'Sparkles',
    couleur: '#EC4899',
    ordre_affichage: 1,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 2,
    nom: 'Coiffure',
    description: 'Services de coiffure et soins capillaires',
    icone: 'Scissors',
    couleur: '#8B5CF6',
    ordre_affichage: 2,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 3,
    nom: 'Bien-être',
    description: 'Massages, spa et relaxation',
    icone: 'Heart',
    couleur: '#10B981',
    ordre_affichage: 3,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 4,
    nom: 'Fitness',
    description: 'Sport et remise en forme',
    icone: 'Dumbbell',
    couleur: '#F97316',
    ordre_affichage: 4,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z'
  }
];

export const mockSubCategories: SubCategory[] = [
  { id: 1, categorie_id: 1, nom: 'Manucure', description: 'Soins des ongles', icone: 'Hand', ordre_affichage: 1, is_active: true, created_at: '2024-01-01T00:00:00Z' },
  { id: 2, categorie_id: 1, nom: 'Pédicure', description: 'Soins des pieds', icone: 'Footprints', ordre_affichage: 2, is_active: true, created_at: '2024-01-01T00:00:00Z' },
  { id: 3, categorie_id: 1, nom: 'Maquillage', description: 'Services de maquillage', icone: 'Palette', ordre_affichage: 3, is_active: true, created_at: '2024-01-01T00:00:00Z' },
  { id: 4, categorie_id: 2, nom: 'Coupe homme', description: 'Coiffure masculine', icone: 'User', ordre_affichage: 1, is_active: true, created_at: '2024-01-01T00:00:00Z' },
  { id: 5, categorie_id: 2, nom: 'Coupe femme', description: 'Coiffure féminine', icone: 'UserX', ordre_affichage: 2, is_active: true, created_at: '2024-01-01T00:00:00Z' },
  { id: 6, categorie_id: 3, nom: 'Massage relaxant', description: 'Détente et relaxation', icone: 'Waves', ordre_affichage: 1, is_active: true, created_at: '2024-01-01T00:00:00Z' },
  { id: 7, categorie_id: 4, nom: 'Coaching personnel', description: 'Entraînement personnalisé', icone: 'Target', ordre_affichage: 1, is_active: true, created_at: '2024-01-01T00:00:00Z' }
];

export const mockPlansAbonnement: PlanAbonnement[] = [
  {
    id: 1,
    nom: 'Basique',
    description: 'Plan d\'entrée pour débuter',
    prix: 5000,
    devise: 'XOF',
    duree_jours: 30,
    max_services: 3,
    max_reservations_mois: 50,
    max_photos_par_service: 3,
    mise_en_avant: false,
    support_prioritaire: false,
    analytics_avances: false,
    personnalisation_profil: false,
    badge_premium: false,
    avantages: ['3 services maximum', '50 réservations/mois', '3 photos par service'],
    is_active: true,
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 2,
    nom: 'Standard',
    description: 'Plan recommandé pour la plupart des prestataires',
    prix: 12000,
    devise: 'XOF',
    duree_jours: 30,
    max_services: 10,
    max_reservations_mois: 200,
    max_photos_par_service: 5,
    mise_en_avant: true,
    support_prioritaire: false,
    analytics_avances: true,
    personnalisation_profil: true,
    badge_premium: false,
    avantages: ['10 services maximum', '200 réservations/mois', '5 photos par service', 'Mise en avant', 'Analytics avancés'],
    is_active: true,
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 3,
    nom: 'Premium',
    description: 'Plan complet pour les professionnels',
    prix: 25000,
    devise: 'XOF',
    duree_jours: 30,
    max_services: -1, // illimité
    max_reservations_mois: -1, // illimité
    max_photos_par_service: 10,
    mise_en_avant: true,
    support_prioritaire: true,
    analytics_avances: true,
    personnalisation_profil: true,
    badge_premium: true,
    avantages: ['Services illimités', 'Réservations illimitées', '10 photos par service', 'Badge premium', 'Support prioritaire', 'Analytics avancés'],
    is_active: true,
    created_at: '2024-01-01T00:00:00Z'
  }
];

export const mockPrestataires: Prestataire[] = [
  {
    id: 1,
    user_id: 3,
    nom_commercial: 'Salon Beauty Touch',
    bio: 'Salon de beauté moderne offrant des services de qualité dans un cadre chaleureux. Spécialisé en manucure, pédicure et soins du visage.',
    adresse: 'Cocody, Angré 8ème tranche',
    ville: 'Abidjan',
    pays: 'Côte d\'Ivoire',
    latitude: 5.3599517,
    longitude: -3.9810768,
    telephone_professionnel: '+225 27 22 50 60 70',
    email_professionnel: 'contact@beautytouch.ci',
    horaires_ouverture: {
      lundi: { ouvert: true, debut: '08:00', fin: '18:00' },
      mardi: { ouvert: true, debut: '08:00', fin: '18:00' },
      mercredi: { ouvert: true, debut: '08:00', fin: '18:00' },
      jeudi: { ouvert: true, debut: '08:00', fin: '18:00' },
      vendredi: { ouvert: true, debut: '08:00', fin: '18:00' },
      samedi: { ouvert: true, debut: '08:00', fin: '16:00' },
      dimanche: { ouvert: false }
    },
    photos_etablissement: [
      'https://images.pexels.com/photos/3993449/pexels-photo-3993449.jpeg?auto=compress&cs=tinysrgb&w=500',
      'https://images.pexels.com/photos/3992859/pexels-photo-3992859.jpeg?auto=compress&cs=tinysrgb&w=500',
      'https://images.pexels.com/photos/3993257/pexels-photo-3993257.jpeg?auto=compress&cs=tinysrgb&w=500'
    ],
    plan_actuel_id: 2,
    abonnement_expires_at: '2024-12-31T23:59:59Z',
    total_services_utilises: 5,
    total_reservations_mois: 45,
    note_moyenne: 4.8,
    nombre_avis: 127,
    total_vues_profil: 1250,
    is_verified: true,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  }
];

export const mockServices: Service[] = [
  {
    id: 1,
    prestataire_id: 1,
    sous_categorie_id: 1,
    nom: 'Manucure française',
    description: 'Manucure classique avec vernis français, soin des cuticules et forme parfaite',
    prix: 3000,
    devise: 'XOF',
    duree_minutes: 45,
    photos: [
      'https://images.pexels.com/photos/3997376/pexels-photo-3997376.jpeg?auto=compress&cs=tinysrgb&w=500',
      'https://images.pexels.com/photos/3997991/pexels-photo-3997991.jpeg?auto=compress&cs=tinysrgb&w=500'
    ],
    is_domicile: true,
    is_en_salon: true,
    tarif_deplacement: 1000,
    zone_deplacement_km: 15,
    max_clients_simultanes: 1,
    delai_annulation_heures: 24,
    total_reservations: 89,
    note_moyenne: 4.9,
    nombre_avis: 45,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 2,
    prestataire_id: 1,
    sous_categorie_id: 2,
    nom: 'Pédicure spa',
    description: 'Pédicure complète avec bain relaxant, gommage, soin des ongles et massage',
    prix: 4500,
    devise: 'XOF',
    duree_minutes: 60,
    photos: [
      'https://images.pexels.com/photos/3997132/pexels-photo-3997132.jpeg?auto=compress&cs=tinysrgb&w=500'
    ],
    is_domicile: false,
    is_en_salon: true,
    max_clients_simultanes: 1,
    delai_annulation_heures: 24,
    total_reservations: 67,
    note_moyenne: 4.7,
    nombre_avis: 32,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  }
];

export const mockStatutsReservation: StatutReservation[] = [
  { id: 1, nom: 'En attente', couleur: '#F59E0B', description: 'Réservation en attente de confirmation', ordre: 1, is_active: true },
  { id: 2, nom: 'Confirmée', couleur: '#10B981', description: 'Réservation confirmée par le prestataire', ordre: 2, is_active: true },
  { id: 3, nom: 'En cours', couleur: '#3B82F6', description: 'Service en cours de réalisation', ordre: 3, is_active: true },
  { id: 4, nom: 'Terminée', couleur: '#8B5CF6', description: 'Service terminé avec succès', ordre: 4, is_active: true },
  { id: 5, nom: 'Annulée', couleur: '#EF4444', description: 'Réservation annulée', ordre: 5, is_active: true },
  { id: 6, nom: 'No-show', couleur: '#6B7280', description: 'Client absent sans prévenir', ordre: 6, is_active: true }
];

export const mockReservations: Reservation[] = [
  {
    id: 1,
    client_id: 2,
    prestataire_id: 1,
    service_id: 1,
    statut_id: 2,
    date_reservation: '2024-01-15',
    heure_debut: '14:00',
    heure_fin: '14:45',
    prix_final: 3000,
    devise: 'XOF',
    nombre_personnes: 1,
    notes_client: 'Première fois, un peu stressée',
    a_domicile: false,
    created_at: '2024-01-10T00:00:00Z',
    updated_at: '2024-01-10T00:00:00Z'
  },
  {
    id: 2,
    client_id: 2,
    prestataire_id: 1,
    service_id: 2,
    statut_id: 4,
    date_reservation: '2024-01-05',
    heure_debut: '10:00',
    heure_fin: '11:00',
    prix_final: 4500,
    devise: 'XOF',
    nombre_personnes: 1,
    notes_client: 'Super expérience !',
    notes_prestataire: 'Cliente très sympathique',
    a_domicile: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-05T11:00:00Z'
  }
];

export const mockPublications: Publication[] = [
  {
    id: 1,
    client_id: 2,
    prestataire_id: 1,
    service_id: 1,
    description: 'Magnifique manucure française chez @beautytouch ! Je recommande vivement 💅✨',
    photos: [
      'https://images.pexels.com/photos/3997376/pexels-photo-3997376.jpeg?auto=compress&cs=tinysrgb&w=500',
      'https://images.pexels.com/photos/3997991/pexels-photo-3997991.jpeg?auto=compress&cs=tinysrgb&w=500'
    ],
    videos: [],
    nombre_likes: 24,
    nombre_commentaires: 5,
    is_visible: true,
    created_at: '2024-01-05T15:30:00Z',
    updated_at: '2024-01-05T15:30:00Z'
  },
  {
    id: 2,
    client_id: 2,
    prestataire_id: 1,
    service_id: 2,
    description: 'Moment détente avec cette pédicure spa 🧘‍♀️ Mes pieds me disent merci ! #bienetre #prestaci',
    photos: [
      'https://images.pexels.com/photos/3997132/pexels-photo-3997132.jpeg?auto=compress&cs=tinysrgb&w=500'
    ],
    videos: [],
    nombre_likes: 18,
    nombre_commentaires: 3,
    is_visible: true,
    created_at: '2024-01-05T16:45:00Z',
    updated_at: '2024-01-05T16:45:00Z'
  }
];