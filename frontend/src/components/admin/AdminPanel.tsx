import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { 
  Settings, BarChart3, Users, RefreshCw, Save, Trash2, Plus, AlertTriangle, 
  CreditCard, CheckCircle, XCircle, Clock, Eye, Search, Filter,
  UserCheck, UserX, Shield, Mail, Phone, MapPin, Calendar,
  Package, Star, Bell, TrendingUp, Crown, Database, Wrench,
  Grid3X3, MessageSquare, Activity, DollarSign, FileText,
  Download, Upload, Key, Globe, Shield as ShieldIcon,
  MoreVertical, Edit3, GripVertical, Power
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAppStore } from '../../store/appStore';
import DebugPanel from './DebugPanel';
import Logo from '../Logo';

// Types améliorés
interface AppSetting {
  value: any;
  description: string;
  type?: 'string' | 'number' | 'boolean' | 'json';
  category?: string;
}

interface AdminStats {
  users: {
    total_users: number;
    clients: number;
    prestataires: number;
    admins: number;
    active_users?: number;
  };
  services: {
    total_services: number;
    services_actifs: number;
    pending_approval?: number;
  };
  reservations: {
    total_reservations: number;
    confirmees: number;
    en_attente: number;
    today?: number;
  };
  financial?: {
    revenue_today: number;
    revenue_month: number;
    pending_payments: number;
  };
  notifications: {
    total_notifications: number;
    non_lues: number;
  };
}

interface WaveTransaction {
  id: number;
  prestataire_nom: string;
  prestataire_prenom: string;
  prestataire_email: string;
  plan_nom: string;
  montant: number;
  devise: string;
  transaction_id_wave: string;
  statut: 'en_attente' | 'valide' | 'rejete' | 'rembourse';
  duree_abonnement_jours: number;
  created_at: string;
  motif_rejet?: string;
}

interface User {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
  ville?: string;
  role_nom: string;
  created_at: string;
  is_active: boolean;
  is_admin: boolean;
  is_prestataire: boolean;
  is_client: boolean;
  last_login?: string;
  plan_nom?: string;
  abonnement_expires_at?: string;
}

interface Service {
  id: number;
  nom: string;
  description: string;
  prix: number;
  devise?: string;
  categorie_nom: string;
  sous_categorie_nom?: string;
  prestataire_nom: string;
  prestataire_email?: string;
  is_active: boolean;
  created_at: string;
  total_reservations?: number;
  moyenne_avis?: number;
}

interface Category {
  id: number;
  nom: string;
  description: string;
  icone?: string;
  couleur?: string;
  services_count: number;
  sous_categories_count: number;
}

interface SubCategory {
  id: number;
  nom: string;
  description?: string;
  is_active: boolean;
  nombre_services?: number;
  categorie_id?: number;
  icone?: string;
  ordre_affichage?: number;
}

interface Reservation {
  id: number;
  client_nom: string;
  client_prenom: string;
  client_email: string;
  client_telephone?: string;
  service_nom: string;
  prestataire_nom: string;
  date_reservation: string;
  heure_debut?: string;
  heure_fin?: string;
  statut: 'en_attente' | 'confirmee' | 'terminee' | 'annulee';
}

interface Avis {
  id: number;
  client_nom: string;
  client_prenom: string;
  service_nom: string;
  note: number;
  commentaire: string;
  is_approved: boolean | null;
  created_at: string;
}

interface Notification {
  id: number;
  titre: string;
  message: string;
  type: string;
  is_read: boolean;
  user_nom?: string;
  user_prenom?: string;
  created_at: string;
}

interface Plan {
  id: number;
  nom: string;
  description: string;
  prix: number;
  devise: string;
  duree_jours: number;
  max_services?: number;
  max_photos_per_service?: number;
  is_active: boolean;
}

interface MaintenanceLog {
  id: number;
  admin_id: number;
  action: string;
  target_type: string;
  target_id: number;
  details?: any;
  created_at: string;
  admin_nom?: string;
  admin_email?: string;
}

interface UserStats {
  total_users: number;
  clients: number;
  prestataires: number;
  admins: number;
  nouveaux_30j: number;
}

interface DashboardAnalytics {
  general?: Record<string, number>;
  growth?: Record<string, number>;
  conversion?: Record<string, number>;
  charts?: {
    revenue_by_month?: Array<{ month: string; revenue: number }>;
    new_users_today?: number;
    new_users_week?: number;
    new_users_month?: number;
  };
  period?: string;
}

interface ServiceStatsOverview {
  overview: {
    total_services: number;
    services_actifs: number;
    services_suspendus: number;
    nouveaux_ce_mois: number;
    prix_moyen: number;
  };
  topCategories: Array<{ categorie: string; nombre_services: number }>;
  topPrestataires: Array<{ prestataire: string; email: string; nombre_services: number; moyenne_avis: number }>;
}

type AdminTab = 'dashboard' | 'users' | 'services' | 'categories' | 'reservations' | 'avis' | 'payments' | 'notifications' | 'statistics' | 'plans' | 'settings' | 'maintenance' | 'debug';

const parseSettingTimestamp = (value: any): string | null => {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed?.created_at || parsed?.cleared_at || parsed?.timestamp || value;
    } catch {
      return value;
    }
  }
  if (typeof value === 'object') {
    return value?.created_at || value?.cleared_at || value?.timestamp || null;
  }
  return null;
};

const parseBooleanSetting = (value: any): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
  return !!value;
};

const formatLogDetails = (details?: any) => {
  if (!details) return '';
  if (typeof details === 'string') {
    try {
      return JSON.stringify(JSON.parse(details), null, 2);
    } catch {
      return details;
    }
  }
  return JSON.stringify(details, null, 2);
};

// Composants réutilisables
const LoadingSpinner = ({ message = "Chargement..." }: { message?: string }) => (
  <div className="flex flex-col items-center justify-center py-12">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
    <p className="text-gray-600 dark:text-gray-400">{message}</p>
  </div>
);

const StatCard = ({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  subtitle,
  color = 'blue'
}: {
  title: string;
  value: string | number;
  icon: any;
  trend?: number;
  subtitle?: string;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red';
}) => {
  const colorClasses = {
    blue: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
    green: 'text-green-600 bg-green-50 dark:bg-green-900/20',
    purple: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20',
    orange: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20',
    red: 'text-red-600 bg-red-50 dark:bg-red-900/20'
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{value}</p>
          {subtitle && (
            <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
          )}
          {trend !== undefined && (
            <div className={`flex items-center text-xs mt-2 ${
              trend >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              <TrendingUp className={`w-3 h-3 mr-1 ${trend < 0 ? 'transform rotate-180' : ''}`} />
              {Math.abs(trend)}% vs mois dernier
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  const statusConfig: Record<string, { label: string; color: string }> = {
    active: { label: 'Actif', color: 'green' },
    inactive: { label: 'Inactif', color: 'red' },
    pending: { label: 'En attente', color: 'yellow' },
    approved: { label: 'Approuvé', color: 'green' },
    rejected: { label: 'Rejeté', color: 'red' },
    confirmed: { label: 'Confirmé', color: 'blue' },
    cancelled: { label: 'Annulé', color: 'red' },
    completed: { label: 'Terminé', color: 'purple' },
    en_attente: { label: 'En attente', color: 'yellow' },
    valide: { label: 'Validé', color: 'green' },
    rejete: { label: 'Rejeté', color: 'red' },
    confirmee: { label: 'Confirmée', color: 'blue' },
    terminee: { label: 'Terminée', color: 'purple' },
    annulee: { label: 'Annulée', color: 'red' }
  };

  const config = statusConfig[status] || { label: status, color: 'gray' };

  const colorClasses = {
    green: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    red: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    gray: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClasses[config.color as keyof typeof colorClasses]}`}>
      {config.label}
    </span>
  );
};

const SearchInput = ({ 
  value, 
  onChange, 
  placeholder = "Rechercher...",
  className = ""
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) => (
  <div className={`relative ${className}`}>
    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    />
  </div>
);

const FilterSelect = ({
  value,
  onChange,
  options,
  className = ""
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className={`px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent ${className}`}
  >
    {options.map(option => (
      <option key={option.value} value={option.value}>{option.label}</option>
    ))}
  </select>
);

export default function AdminPanel() {
  const { showToast } = useAppStore();
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [loading, setLoading] = useState(true);
  const [globalLoading, setGlobalLoading] = useState(false);
  
  // États regroupés par catégorie
  const [dashboardState, setDashboardState] = useState({
    stats: {
      users: { total_users: 0, clients: 0, prestataires: 0, admins: 0, active_users: 0 },
      services: { total_services: 0, services_actifs: 0, pending_approval: 0 },
      reservations: { total_reservations: 0, confirmees: 0, en_attente: 0, today: 0 },
      financial: { revenue_today: 0, revenue_month: 0, pending_payments: 0 },
      notifications: { total_notifications: 0, non_lues: 0 },
    } as AdminStats,
    analytics: null as DashboardAnalytics | null,
    overviewPeriod: '30d',
    revenueTrend: [] as Array<{ month: string; revenue: number }>,
    newUsersSnapshot: { today: 0, week: 0, month: 0 },
    recentReservations: [] as Reservation[],
    pendingTransactions: [] as WaveTransaction[],
    lastUpdated: null as Date | null
  });
  
  const [usersState, setUsersState] = useState({
    users: [] as User[],
    filter: 'all',
    status: 'all',
    sortBy: 'recent' as 'recent' | 'alphabetical' | 'role',
    search: '',
    page: 1,
    limit: 20,
    pagination: { page: 1, total: 0, totalPages: 1, limit: 20 },
    stats: null as UserStats | null,
    selectedUser: null as User | null
  });
  
  const [paymentsState, setPaymentsState] = useState({
    transactions: [] as WaveTransaction[],
    filter: 'all' as 'all' | 'en_attente' | 'valide' | 'rejete',
    search: '',
    dateFilter: 'all' as 'all' | 'today' | 'week' | 'month',
    selectedTransaction: null as WaveTransaction | null,
    rejectReason: '',
    showRejectModal: false,
    showTransactionModal: false
  });

  const [servicesState, setServicesState] = useState({
    services: [] as Service[],
    filter: 'all',
    search: '',
    sortBy: 'recent' as 'recent' | 'price_desc' | 'price_asc' | 'rating',
    page: 1,
    limit: 20,
    pagination: { page: 1, total: 0, totalPages: 1, limit: 20 },
    stats: null as ServiceStatsOverview | null,
    selectedService: null as (Service & { [key: string]: any }) | null,
    loadingDetail: false
  });

const [categoriesState, setCategoriesState] = useState({
  categories: [] as Category[],
  search: '',
  selectedCategory: null as Category | null,
  subCategories: [] as SubCategory[],
  loadingSubCategories: false,
  showSubcategoryModal: false,
  draggedSubCategoryId: null as number | null,
  newSubCategory: { nom: '', description: '' }
});
const pendingSubcategoryOrder = useRef<SubCategory[] | null>(null);

  const [reservationsState, setReservationsState] = useState({
    reservations: [] as Reservation[],
    filter: 'all',
    search: '',
    dateFilter: 'all' as 'all' | 'today' | 'week' | 'month',
    selectedReservation: null as Reservation | null,
    loadingDetail: false
  });

  const [avisState, setAvisState] = useState({
    avis: [] as Avis[],
    filter: 'all'
  });

  const [notificationsState, setNotificationsState] = useState({
    notifications: [] as Notification[],
    filter: 'all'
  });
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState<'info' | 'success' | 'warning' | 'error'>('info');

  const [plansState, setPlansState] = useState({
    plans: [] as Plan[]
  });

  const [settingsState, setSettingsState] = useState({
    settings: {} as Record<string, AppSetting>,
    editingKey: null as string | null,
    editValue: '',
    newKey: '',
    newValue: '',
    newDescription: '',
    newCategory: 'general',
    search: ''
  });
  const [maintenanceState, setMaintenanceState] = useState({
    maintenanceMode: false,
    maintenanceMessage: '',
    systemStatus: 'unknown',
    statusTimestamp: null as string | null,
    lastBackupAt: null as string | null,
    lastCacheClearAt: null as string | null,
    logs: [] as MaintenanceLog[],
    logsSummary: null as { total_logs?: number; logs_24h?: number; logs_7j?: number } | null,
    loadingStatus: false,
    logsLoading: false,
    action: null as 'cache' | 'backup' | 'mode' | null
  });

  // Chargement des données
  const loadStats = useCallback(async (period = dashboardState.overviewPeriod) => {
    setLoading(true);
    try {
      const [
        statsData,
        analyticsData,
        recentReservations,
        pendingTransactions
      ] = await Promise.all([
        api.admin.getStats(),
        api.admin.statistics.getOverview(period),
        api.admin.reservations.getAll({ limit: 5, page: 1 }),
        api.admin.getWaveTransactions({ statut: 'en_attente', limit: 5, page: 1 })
      ]);

      setDashboardState(prev => ({
        ...prev,
        stats: { ...prev.stats, ...statsData },
        analytics: analyticsData,
        overviewPeriod: period,
        revenueTrend: analyticsData?.charts?.revenue_by_month || [],
        newUsersSnapshot: {
          today: analyticsData?.charts?.new_users_today || 0,
          week: analyticsData?.charts?.new_users_week || 0,
          month: analyticsData?.charts?.new_users_month || 0
        },
        recentReservations: recentReservations?.reservations || [],
        pendingTransactions: pendingTransactions?.transactions || [],
        lastUpdated: new Date()
      }));
    } catch (error) {
      console.error('Erreur chargement stats:', error);
      showToast('Erreur de chargement des statistiques', 'error');
    } finally {
      setLoading(false);
    }
  }, [dashboardState.overviewPeriod, showToast]);

  const handleAnalyticsPeriodChange = (period: '7d' | '30d' | '90d' | '1y') => {
    if (dashboardState.overviewPeriod === period) return;
    setDashboardState(prev => ({ ...prev, overviewPeriod: period }));
    loadStats(period);
  };

  const loadWaveTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.admin.getWaveTransactions({ 
        statut: paymentsState.filter === 'all' ? undefined : paymentsState.filter 
      });
      setPaymentsState(prev => ({ ...prev, transactions: data.transactions || [] }));
    } catch (error) {
      console.error('Erreur chargement transactions:', error);
      showToast('Erreur de chargement des transactions', 'error');
    } finally {
      setLoading(false);
    }
  }, [paymentsState.filter, showToast]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const [data, stats] = await Promise.all([
        api.admin.getUsers({ 
          role: usersState.filter === 'all' ? undefined : usersState.filter,
          search: usersState.search || undefined,
          page: usersState.page,
          limit: usersState.limit
        }),
        api.admin.getUserStats()
      ]);
      setUsersState(prev => ({
        ...prev,
        users: data.users || [],
        pagination: data.pagination ? { ...prev.pagination, ...data.pagination } : prev.pagination,
        page: data.pagination?.page ?? prev.page,
        limit: data.pagination?.limit ?? prev.limit,
        stats: stats || prev.stats
      }));
    } catch (error) {
      console.error('Erreur chargement utilisateurs:', error);
      showToast('Erreur de chargement des utilisateurs', 'error');
    } finally {
      setLoading(false);
    }
  }, [usersState.filter, usersState.search, usersState.page, usersState.limit, showToast]);

  const loadServices = useCallback(async () => {
    setLoading(true);
    try {
      const [data, stats] = await Promise.all([
        api.admin.services.getAll({ 
          status: servicesState.filter === 'all' ? undefined : servicesState.filter,
          search: servicesState.search || undefined,
          page: servicesState.page,
          limit: servicesState.limit
        }),
        api.admin.services.getStats()
      ]);
      setServicesState(prev => ({
        ...prev,
        services: data.services || [],
        pagination: data.pagination ? { ...prev.pagination, ...data.pagination } : prev.pagination,
        page: data.pagination?.page ?? prev.page,
        limit: data.pagination?.limit ?? prev.limit,
        stats
      }));
    } catch (error) {
      console.error('Erreur chargement services:', error);
      showToast('Erreur de chargement des services', 'error');
    } finally {
      setLoading(false);
    }
  }, [servicesState.filter, servicesState.search, servicesState.page, servicesState.limit, showToast]);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.admin.categories.getAll();
      setCategoriesState(prev => ({ ...prev, categories: data || [] }));
    } catch (error) {
      console.error('Erreur chargement catégories:', error);
      showToast('Erreur de chargement des catégories', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);
  const fetchSubCategories = useCallback(async (categoryId: number) => {
    setCategoriesState(prev => ({ ...prev, loadingSubCategories: true }));
    try {
      const data = await api.admin.categories.getSubCategories({ 
        categorie_id: categoryId, 
        include_inactive: true 
      });
      setCategoriesState(prev => ({ ...prev, subCategories: data || [], loadingSubCategories: false }));
    } catch (error) {
      console.error('Erreur sous-catégories:', error);
      showToast('Impossible de charger les sous-catégories', 'error');
      setCategoriesState(prev => ({ ...prev, loadingSubCategories: false }));
    }
  }, [showToast]);

  const loadReservations = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.admin.reservations.getAll({ 
        statut: reservationsState.filter === 'all' ? undefined : reservationsState.filter,
        search: reservationsState.search || undefined
      });
      setReservationsState(prev => ({ ...prev, reservations: data.reservations || [] }));
    } catch (error) {
      console.error('Erreur chargement réservations:', error);
      showToast('Erreur de chargement des réservations', 'error');
    } finally {
      setLoading(false);
    }
  }, [reservationsState.filter, showToast]);

  const loadAvis = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.admin.avis.getAll({ 
        status: avisState.filter === 'all' ? undefined : avisState.filter 
      });
      setAvisState(prev => ({ ...prev, avis: data.avis || [] }));
    } catch (error) {
      console.error('Erreur chargement avis:', error);
      showToast('Erreur de chargement des avis', 'error');
    } finally {
      setLoading(false);
    }
  }, [avisState.filter, showToast]);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.admin.notifications.getAll({ 
        type: notificationsState.filter === 'all' ? undefined : notificationsState.filter 
      });
      setNotificationsState(prev => ({ ...prev, notifications: data.notifications || [] }));
    } catch (error) {
      console.error('Erreur chargement notifications:', error);
      showToast('Erreur de chargement des notifications', 'error');
    } finally {
      setLoading(false);
    }
  }, [notificationsState.filter, showToast]);

  const loadPlans = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.admin.plans.getAll();
      setPlansState(prev => ({ ...prev, plans: data || [] }));
    } catch (error) {
      console.error('Erreur chargement plans:', error);
      showToast('Erreur de chargement des plans', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);
  const loadMaintenanceStatus = useCallback(async () => {
    setMaintenanceState(prev => ({ ...prev, loadingStatus: true }));
    try {
      const [statusData, settings] = await Promise.all([
        api.admin.maintenance.getStatus(),
        api.admin.getSettings()
      ]);
      const maintenanceModeSetting = settings?.maintenance_mode?.value;
      const lastBackupSetting = settings?.maintenance_last_backup?.value;
      const lastCacheSetting = settings?.maintenance_last_cache_clear?.value;
      setMaintenanceState(prev => ({
        ...prev,
        loadingStatus: false,
        systemStatus: statusData?.system_status || 'unknown',
        statusTimestamp: statusData?.timestamp || null,
        logsSummary: statusData?.logs || null,
        maintenanceMode: maintenanceModeSetting !== undefined 
          ? parseBooleanSetting(maintenanceModeSetting)
          : prev.maintenanceMode,
        maintenanceMessage: settings?.maintenance_message?.value || '',
        lastBackupAt: parseSettingTimestamp(lastBackupSetting),
        lastCacheClearAt: parseSettingTimestamp(lastCacheSetting)
      }));
    } catch (error) {
      console.error('Erreur chargement maintenance:', error);
      setMaintenanceState(prev => ({ ...prev, loadingStatus: false }));
      showToast('Erreur de chargement des outils de maintenance', 'error');
    }
  }, [showToast]);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.admin.getSettings();
      setSettingsState(prev => ({ ...prev, settings: data }));
    } catch (error) {
      console.error('Erreur chargement paramètres:', error);
      showToast('Erreur de chargement des paramètres', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const loadDataForTab = useCallback((tab: AdminTab) => {
    switch (tab) {
      case 'dashboard': loadStats(); break;
      case 'users': loadUsers(); break;
      case 'payments': loadWaveTransactions(); break;
      case 'settings': loadSettings(); break;
      case 'services': loadServices(); break;
      case 'categories': loadCategories(); break;
      case 'reservations': loadReservations(); break;
      case 'avis': loadAvis(); break;
      case 'notifications': loadNotifications(); break;
      case 'plans': loadPlans(); break;
      case 'maintenance': loadMaintenanceStatus(); break;
      default: break;
    }
  }, [
    loadStats, loadUsers, loadWaveTransactions, loadSettings, loadServices, 
    loadCategories, loadReservations, loadAvis, loadNotifications, loadPlans,
    loadMaintenanceStatus
  ]);
  // Rechargement global
  const handleGlobalRefresh = async () => {
    setGlobalLoading(true);
    try {
      await loadDataForTab(activeTab);
      showToast('Données actualisées', 'success');
    } catch (error) {
      showToast('Erreur lors de l\'actualisation', 'error');
    } finally {
      setGlobalLoading(false);
    }
  };

  // Actions
  const validateTransaction = async (transactionId: number) => {
    try {
      await api.admin.validateWaveTransaction(transactionId);
      showToast('Transaction validée avec succès', 'success');
      await loadWaveTransactions();
    } catch (error) {
      showToast('Erreur lors de la validation', 'error');
    }
  };

  const rejectTransaction = async (transactionId: number, motif: string) => {
    try {
      await api.admin.rejectWaveTransaction(transactionId, motif);
      showToast('Transaction rejetée', 'success');
      setPaymentsState(prev => ({
        ...prev,
        showRejectModal: false,
        rejectReason: '',
        selectedTransaction: null
      }));
      await loadWaveTransactions();
    } catch (error) {
      showToast('Erreur lors du rejet', 'error');
    }
  };

  const handleServiceStatusToggle = async (serviceId: number, isActive: boolean, serviceName?: string) => {
    let reason: string | undefined;
    if (!isActive) {
      reason = prompt(`Motif de suspension pour ${serviceName || 'ce service'} :`) || undefined;
    }
    try {
      await api.admin.services.updateStatus(serviceId, isActive, reason);
      showToast(`Service ${isActive ? 'activé' : 'suspendu'}`, 'success');
      await loadServices();
    } catch (error) {
      showToast('Erreur lors de la modification du statut', 'error');
    }
  };

  const handleServiceDelete = async (serviceId: number, serviceName?: string) => {
    const confirmed = confirm(`Supprimer définitivement le service "${serviceName || 'sélectionné'}" ?`);
    if (!confirmed) return;
    const reason = prompt('Motif de la suppression :') || undefined;
    try {
      await api.admin.services.delete(serviceId, reason);
      showToast('Service supprimé', 'success');
      await loadServices();
    } catch (error) {
      showToast('Erreur lors de la suppression', 'error');
    }
  };

  const handleClearCache = async () => {
    setMaintenanceState(prev => ({ ...prev, action: 'cache' }));
    try {
      const result = await api.admin.maintenance.clearCache();
      setMaintenanceState(prev => ({
        ...prev,
        action: null,
        lastCacheClearAt: result?.timestamp || new Date().toISOString()
      }));
      showToast(result?.message || 'Cache vidé avec succès', 'success');
    } catch (error) {
      console.error('Erreur vidage cache:', error);
      setMaintenanceState(prev => ({ ...prev, action: null }));
      showToast('Impossible de vider le cache', 'error');
    }
  };

  const handleCreateBackup = async () => {
    setMaintenanceState(prev => ({ ...prev, action: 'backup' }));
    try {
      const result = await api.admin.maintenance.createBackup();
      setMaintenanceState(prev => ({
        ...prev,
        action: null,
        lastBackupAt: result?.backup_info?.created_at || result?.createdAt || new Date().toISOString()
      }));
      showToast(result?.message || 'Sauvegarde créée', 'success');
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      setMaintenanceState(prev => ({ ...prev, action: null }));
      showToast('Impossible de créer une sauvegarde', 'error');
    }
  };

  const handleMaintenanceModeToggle = async () => {
    const next = !maintenanceState.maintenanceMode;
    setMaintenanceState(prev => ({ ...prev, action: 'mode' }));
    try {
      const result = await api.admin.maintenance.toggleMode(next, {
        message: maintenanceState.maintenanceMessage || 'Maintenance en cours'
      });
      setMaintenanceState(prev => ({
        ...prev,
        action: null,
        maintenanceMode: typeof result?.maintenance_mode?.enabled === 'boolean'
          ? result.maintenance_mode.enabled
          : next,
        maintenanceMessage: result?.maintenance_mode?.message || prev.maintenanceMessage,
        statusTimestamp: result?.maintenance_mode?.activated_at || prev.statusTimestamp
      }));
      showToast(result?.message || `Mode maintenance ${next ? 'activé' : 'désactivé'}`, 'success');
    } catch (error) {
      console.error('Erreur changement mode maintenance:', error);
      setMaintenanceState(prev => ({ ...prev, action: null }));
      showToast('Impossible de changer le mode maintenance', 'error');
    }
  };

  const handleLoadMaintenanceLogs = async () => {
    setMaintenanceState(prev => ({ ...prev, logsLoading: true }));
    try {
      const data = await api.admin.maintenance.getLogs({ limit: 50 });
      setMaintenanceState(prev => ({ ...prev, logsLoading: false, logs: data.logs || [] }));
    } catch (error) {
      console.error('Erreur récupération logs:', error);
      setMaintenanceState(prev => ({ ...prev, logsLoading: false }));
      showToast('Impossible de charger les logs', 'error');
    }
  };

  const handleReservationStatusUpdate = async (reservationId: number, statut: string) => {
    try {
      await api.admin.reservations.updateStatus(reservationId, statut);
      showToast('Réservation mise à jour', 'success');
      await loadReservations();
    } catch (error) {
      showToast('Erreur mise à jour réservation', 'error');
    }
  };

  const requestReservationStatusChange = (reservationId: number, statut: 'confirmee' | 'terminee' | 'annulee') => {
    const messages: Record<'confirmee' | 'terminee' | 'annulee', string> = {
      confirmee: 'Confirmer cette réservation ?',
      terminee: 'Marquer cette réservation comme terminée ?',
      annulee: 'Annuler cette réservation ?'
    } as const;
    if (!confirm(messages[statut])) {
      return false;
    }
    handleReservationStatusUpdate(reservationId, statut);
    return true;
  };

  const handleCategoryCreate = async () => {
    const nom = prompt('Nom de la catégorie :');
    if (!nom) return;
    
    const description = prompt('Description :') || '';
    
    try {
      await api.admin.categories.create({ nom, description });
      showToast('Catégorie créée', 'success');
      await loadCategories();
    } catch (error) {
      showToast('Erreur lors de la création', 'error');
    }
  };

  const handleServicePageChange = (direction: 'prev' | 'next') => {
    setServicesState(prev => {
      const totalPages = prev.pagination.totalPages || 1;
      const nextPage =
        direction === 'next'
          ? Math.min(totalPages, prev.page + 1)
          : Math.max(1, prev.page - 1);
      if (nextPage === prev.page) return prev;
      return { ...prev, page: nextPage };
    });
  };

  const handleViewService = async (serviceId: number) => {
    setServicesState(prev => ({ ...prev, selectedService: { id: serviceId } as any, loadingDetail: true }));
    try {
      const detail = await api.admin.services.getById(serviceId);
      setServicesState(prev => ({ ...prev, selectedService: detail, loadingDetail: false }));
    } catch (error) {
      console.error('Erreur chargement service:', error);
      showToast('Impossible de charger le service', 'error');
      setServicesState(prev => ({ ...prev, selectedService: null, loadingDetail: false }));
    }
  };

  const handleCategoryEdit = async (categoryId: number) => {
    const category = categoriesState.categories.find(c => c.id === categoryId);
    if (!category) return;
    
    const nom = prompt('Nom de la catégorie :', category.nom);
    if (!nom) return;
    
    const description = prompt('Description :', category.description) || '';
    
    try {
      await api.admin.categories.update(categoryId, { nom, description });
      showToast('Catégorie mise à jour', 'success');
      await loadCategories();
    } catch (error) {
      showToast('Erreur lors de la mise à jour', 'error');
    }
  };

  const handleCategoryDelete = async (categoryId: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette catégorie ?')) return;
    
    try {
      await api.admin.categories.delete(categoryId);
      showToast('Catégorie supprimée', 'success');
      await loadCategories();
    } catch (error) {
      showToast('Erreur lors de la suppression', 'error');
    }
  };
  const persistSubCategoryOrder = useCallback(async (categoryId: number, orderedList: SubCategory[]) => {
    if (!orderedList.length) return;
    try {
      await api.admin.categories.reorderSubCategories(
        categoryId, 
        orderedList.map((sub, index) => ({
          id: sub.id,
          ordre_affichage: index + 1
        }))
      );
      showToast('Ordre des sous-catégories mis à jour', 'success');
    } catch (error) {
      console.error('Erreur réorganisation sous-catégories:', error);
      showToast('Impossible d\'enregistrer l\'ordre', 'error');
      await fetchSubCategories(categoryId);
    }
  }, [fetchSubCategories, showToast]);

  const handleAvisModerate = async (avisId: number, isApproved: boolean) => {
    try {
      await api.admin.avis.moderate(avisId, isApproved);
      showToast(`Avis ${isApproved ? 'approuvé' : 'rejeté'}`, 'success');
      await loadAvis();
    } catch (error) {
      showToast('Erreur lors de la modération', 'error');
    }
  };
  const handleOpenSubCategories = (category: Category) => {
    setCategoriesState(prev => ({
      ...prev,
      selectedCategory: category,
      showSubcategoryModal: true,
      newSubCategory: { nom: '', description: '' }
    }));
    fetchSubCategories(category.id);
  };

  const handleCloseSubCategories = () => {
    setCategoriesState(prev => ({
      ...prev,
      selectedCategory: null,
      showSubcategoryModal: false,
      subCategories: [],
      draggedSubCategoryId: null,
      newSubCategory: { nom: '', description: '' }
    }));
  };

  const handleSubCategoryFormChange = (field: 'nom' | 'description', value: string) => {
    setCategoriesState(prev => ({
      ...prev,
      newSubCategory: {
        ...prev.newSubCategory,
        [field]: value
      }
    }));
  };

  const handleSubCategoryCreate = async () => {
    const category = categoriesState.selectedCategory;
    if (!category) return;

    const nom = categoriesState.newSubCategory.nom.trim();
    const description = categoriesState.newSubCategory.description.trim();
    if (!nom || !description) {
      showToast('Nom et description requis', 'error');
      return;
    }

    try {
      await api.admin.categories.createSubCategory(category.id, { nom, description });
      showToast('Sous-catégorie créée', 'success');
      setCategoriesState(prev => ({ ...prev, newSubCategory: { nom: '', description: '' } }));
      await fetchSubCategories(category.id);
    } catch (error) {
      showToast('Erreur création sous-catégorie', 'error');
    }
  };

  const handleSubCategoryEdit = async (subCategory: SubCategory) => {
    const nom = prompt('Nom de la sous-catégorie :', subCategory.nom);
    if (!nom) return;
    const description = prompt('Description :', subCategory.description || '') ?? '';

    try {
      await api.admin.categories.updateSubCategory(subCategory.id, { nom, description });
      showToast('Sous-catégorie mise à jour', 'success');
      if (categoriesState.selectedCategory) {
        await fetchSubCategories(categoriesState.selectedCategory.id);
      }
    } catch (error) {
      showToast('Erreur mise à jour sous-catégorie', 'error');
    }
  };

  const handleSubCategoryToggle = async (subCategory: SubCategory) => {
    if (!categoriesState.selectedCategory) return;
    try {
      await api.admin.categories.updateSubCategory(subCategory.id, { is_active: !subCategory.is_active });
      showToast('Statut mis à jour', 'success');
      await fetchSubCategories(categoriesState.selectedCategory.id);
    } catch (error) {
      showToast('Impossible de modifier le statut', 'error');
    }
  };

  const handleSubCategoryDelete = async (subCategory: SubCategory) => {
    if (!categoriesState.selectedCategory) return;
    if (!confirm(`Supprimer la sous-catégorie "${subCategory.nom}" ?`)) return;
    try {
      await api.admin.categories.deleteSubCategory(subCategory.id);
      showToast('Sous-catégorie supprimée', 'success');
      await fetchSubCategories(categoriesState.selectedCategory.id);
    } catch (error) {
      showToast('Erreur lors de la suppression', 'error');
    }
  };

  const handleSubCategoryDragStart = (id: number) => {
    setCategoriesState(prev => ({ ...prev, draggedSubCategoryId: id }));
  };

  const handleSubCategoryDragEnd = () => {
    setCategoriesState(prev => ({ ...prev, draggedSubCategoryId: null }));
  };

  const handleSubCategoryDrop = (targetId: number) => {
    const categoryId = categoriesState.selectedCategory?.id;
    if (!categoryId) return;
    pendingSubcategoryOrder.current = null;

    setCategoriesState(prev => {
      const draggedId = prev.draggedSubCategoryId;
      if (!draggedId || draggedId === targetId) {
        return { ...prev, draggedSubCategoryId: null };
      }

      const updated = [...prev.subCategories];
      const fromIndex = updated.findIndex(sc => sc.id === draggedId);
      const toIndex = updated.findIndex(sc => sc.id === targetId);
      if (fromIndex === -1 || toIndex === -1) {
        return { ...prev, draggedSubCategoryId: null };
      }

      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      pendingSubcategoryOrder.current = updated;
      return { ...prev, subCategories: updated, draggedSubCategoryId: null };
    });

    if (pendingSubcategoryOrder.current) {
      persistSubCategoryOrder(categoryId, pendingSubcategoryOrder.current);
      pendingSubcategoryOrder.current = null;
    }
  };

  const handleRefreshSubCategories = () => {
    if (categoriesState.selectedCategory) {
      fetchSubCategories(categoriesState.selectedCategory.id);
    }
  };

  const updateSetting = async (key: string, value: any) => {
    try {
      await api.admin.updateSetting(key, value);
      await loadSettings();
      setSettingsState(prev => ({ ...prev, editingKey: null }));
      showToast('Paramètre mis à jour', 'success');
    } catch (error) {
      showToast('Erreur de mise à jour', 'error');
    }
  };

  const deleteSetting = async (key: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le paramètre "${key}" ?`)) return;

    try {
      await api.admin.deleteSetting(key);
      await loadSettings();
      showToast('Paramètre supprimé', 'success');
    } catch (error) {
      showToast('Erreur de suppression', 'error');
    }
  };

  const addSetting = async () => {
    if (!settingsState.newKey || !settingsState.newValue) {
      showToast('Clé et valeur requises', 'error');
      return;
    }

    try {
      await api.admin.updateSetting(settingsState.newKey, settingsState.newValue, settingsState.newDescription);
      await loadSettings();
      setSettingsState(prev => ({
        ...prev,
        newKey: '',
        newValue: '',
        newDescription: '',
        newCategory: 'general'
      }));
      showToast('Paramètre ajouté', 'success');
    } catch (error) {
      showToast('Erreur d\'ajout', 'error');
    }
  };

  const resetSettings = async () => {
    if (!confirm('Êtes-vous sûr de vouloir réinitialiser tous les paramètres aux valeurs par défaut ?')) return;

    try {
      await api.admin.resetSettings();
      await loadSettings();
      showToast('Paramètres réinitialisés', 'success');
    } catch (error) {
      showToast('Erreur de réinitialisation', 'error');
    }
  };

  // Effets
  useEffect(() => {
    loadDataForTab(activeTab);
  }, [activeTab, loadDataForTab]);

  // Re-fetch data when filters change for the active tab
  useEffect(() => {
    if (activeTab === 'users') loadUsers();
  }, [usersState.filter, usersState.search, usersState.page, activeTab]);

  useEffect(() => {
    if (activeTab === 'payments') loadWaveTransactions();
  }, [paymentsState.filter, activeTab]);

  useEffect(() => {
    if (activeTab === 'services') loadServices();
  }, [servicesState.filter, servicesState.search, servicesState.page, activeTab]);

  useEffect(() => {
    if (activeTab === 'reservations') loadReservations();
  }, [reservationsState.filter, reservationsState.search, activeTab]);

  useEffect(() => {
    if (activeTab === 'avis') loadAvis();
  }, [avisState.filter, activeTab]);

  // Fonctions utilitaires
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) return 'Jamais';
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;
    return date.toLocaleString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount: number, currency: string = 'FCFA') => {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' ' + currency;
  };


  const parseNumericValue = (value: any): number => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (value === null || value === undefined) return 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const handleUserPageChange = (direction: 'prev' | 'next') => {
    setUsersState(prev => {
      const totalPages = prev.pagination.totalPages || 1;
      const nextPage =
        direction === 'next'
          ? Math.min(totalPages, prev.page + 1)
          : Math.max(1, prev.page - 1);
      if (nextPage === prev.page) return prev;
      return { ...prev, page: nextPage };
    });
  };

  const handleToggleUserStatus = async (user: User) => {
    if (user.role_nom === 'admin') {
      showToast('Impossible de modifier un administrateur', 'error');
      return;
    }
    setGlobalLoading(true);
    try {
      await api.admin.toggleUserStatus(user.id);
      showToast('Statut utilisateur mis à jour', 'success');
      await loadUsers();
    } catch (error: any) {
      showToast(error?.message || 'Erreur lors de la mise à jour', 'error');
    } finally {
      setGlobalLoading(false);
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!confirm(`Supprimer ${user.nom} ${user.prenom} ?`)) return;
    setGlobalLoading(true);
    try {
      await api.admin.deleteUser(user.id);
      showToast('Utilisateur supprimé', 'success');
      await loadUsers();
    } catch (error: any) {
      showToast(error?.message || 'Erreur lors de la suppression', 'error');
    } finally {
      setGlobalLoading(false);
    }
  };

  const processedUsers = useMemo(() => {
    const filtered = usersState.users.filter(user => {
      const isActive = user.is_active !== false && user.is_active !== 0;
      if (usersState.status === 'active') return isActive;
      if (usersState.status === 'inactive') return !isActive;
      return true;
    });

    const sorted = [...filtered];
    if (usersState.sortBy === 'alphabetical') {
      sorted.sort((a, b) =>
        `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr', { sensitivity: 'base' })
      );
    } else if (usersState.sortBy === 'role') {
      sorted.sort((a, b) => (a.role_nom || '').localeCompare(b.role_nom || '', 'fr'));
    } else {
      sorted.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }
    return sorted;
  }, [usersState.users, usersState.status, usersState.sortBy]);

  const resetUserFilters = () => {
    setUsersState(prev => ({
      ...prev,
      filter: 'all',
      status: 'all',
      sortBy: 'recent',
      search: '',
      page: 1
    }));
  };

  const processedServices = useMemo(() => {
    const sorted = [...servicesState.services];
    if (servicesState.sortBy === 'price_desc') {
      sorted.sort((a, b) => (b.prix || 0) - (a.prix || 0));
    } else if (servicesState.sortBy === 'price_asc') {
      sorted.sort((a, b) => (a.prix || 0) - (b.prix || 0));
    } else if (servicesState.sortBy === 'rating') {
      sorted.sort((a, b) => (b.moyenne_avis || 0) - (a.moyenne_avis || 0));
    } else {
      sorted.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }
    return sorted;
  }, [servicesState.services, servicesState.sortBy]);

  const handlePeriodChange = (period: '7d' | '30d' | '90d' | '1y') => {
    if (dashboardState.overviewPeriod === period) return;
    loadStats(period);
  };

  // Rendu des sections
  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Tableau de bord
          </h2>
          {dashboardState.lastUpdated && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Dernière mise à jour : {formatDate(dashboardState.lastUpdated.toISOString())}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {(['7d', '30d', '90d', '1y'] as const).map(period => (
              <button
                key={period}
                onClick={() => handlePeriodChange(period)}
                className={`px-3 py-1.5 text-sm font-medium transition ${
                  dashboardState.overviewPeriod === period
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {period === '7d' ? '7j' : period === '30d' ? '30j' : period === '90d' ? '90j' : '1 an'}
              </button>
            ))}
          </div>
          <button
            onClick={handleGlobalRefresh}
            disabled={globalLoading}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${globalLoading ? 'animate-spin' : ''}`} />
            <span>Actualiser</span>
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner message="Chargement des statistiques..." />
      ) : dashboardState.stats ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Utilisateurs totaux"
              value={dashboardState.stats.users?.total_users || 0}
              subtitle={`${dashboardState.stats.users?.active_users || 0} actifs`}
              icon={Users}
              color="blue"
            />
            <StatCard
              title="Services actifs"
              value={dashboardState.stats.services?.services_actifs || 0}
              subtitle={`${dashboardState.stats.services?.total_services || 0} au total`}
              icon={Package}
              color="green"
            />
            <StatCard
              title="Réservations aujourd'hui"
              value={dashboardState.stats.reservations?.today || 0}
              subtitle={`${dashboardState.stats.reservations?.total_reservations || 0} total`}
              icon={Calendar}
              color="purple"
            />
            <StatCard
              title="Revenus du mois"
              value={formatCurrency(dashboardState.stats.financial?.revenue_month || 0)}
              subtitle={formatCurrency(dashboardState.stats.financial?.revenue_today || 0, "aujourd'hui")}
              icon={DollarSign}
              color="orange"
            />
          </div>

          {dashboardState.analytics && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs uppercase text-gray-500 dark:text-gray-400">Vue générale</p>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {dashboardState.analytics.period === '7d' ? '7 derniers jours' :
                        dashboardState.analytics.period === '90d' ? '90 derniers jours' :
                        dashboardState.analytics.period === '1y' ? 'Sur 1 an' : '30 derniers jours'}
                    </h3>
                  </div>
                  <Activity className="w-5 h-5 text-blue-500" />
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Clients</p>
                    <p className="text-xl font-semibold text-gray-900 dark:text-white">
                      {dashboardState.analytics.general?.total_clients || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Prestataires</p>
                    <p className="text-xl font-semibold text-gray-900 dark:text-white">
                      {dashboardState.analytics.general?.total_prestataires || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Services</p>
                    <p className="text-xl font-semibold text-gray-900 dark:text-white">
                      {dashboardState.analytics.general?.total_services || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Revenus totaux</p>
                    <p className="text-xl font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(dashboardState.analytics.general?.revenus_totaux || 0)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs uppercase text-gray-500 dark:text-gray-400">Croissance</p>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Nouveaux éléments</h3>
                  </div>
                  <TrendingUp className="w-5 h-5 text-green-500" />
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Utilisateurs</p>
                    <p className="text-xl font-semibold text-gray-900 dark:text-white">
                      {dashboardState.analytics.growth?.nouveaux_utilisateurs || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Services</p>
                    <p className="text-xl font-semibold text-gray-900 dark:text-white">
                      {dashboardState.analytics.growth?.nouveaux_services || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Réservations</p>
                    <p className="text-xl font-semibold text-gray-900 dark:text-white">
                      {dashboardState.analytics.growth?.nouvelles_reservations || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Revenus générés</p>
                    <p className="text-xl font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(dashboardState.analytics.growth?.revenus_periode || 0)}
                    </p>
                  </div>
                </div>
                <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 space-y-1">
                  <p>
                    Utilisateurs : <span className="font-semibold text-gray-900 dark:text-white">{dashboardState.newUsersSnapshot.today}</span> aujourd'hui •{' '}
                    <span className="font-semibold text-gray-900 dark:text-white">{dashboardState.newUsersSnapshot.week}</span> cette semaine •{' '}
                    <span className="font-semibold text-gray-900 dark:text-white">{dashboardState.newUsersSnapshot.month}</span> ce mois
                  </p>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs uppercase text-gray-500 dark:text-gray-400">Conversions</p>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Performance</h3>
                  </div>
                  <ShieldIcon className="w-5 h-5 text-purple-500" />
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Taux de complétion des réservations</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {dashboardState.analytics.conversion?.taux_completion_reservations || 0}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Conversion prestataires</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {dashboardState.analytics.conversion?.taux_conversion_prestataire || 0}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Avis laissés</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {dashboardState.analytics.conversion?.taux_avis_laisses || 0}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Note moyenne</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {(dashboardState.analytics.general?.note_moyenne_globale || 0).toFixed(1)} / 5
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Tendance des revenus</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">6 derniers mois</p>
                </div>
                <DollarSign className="w-5 h-5 text-green-500" />
              </div>
              {dashboardState.revenueTrend.length === 0 ? (
                <div className="text-gray-500 dark:text-gray-400 text-sm">Pas de données suffisantes</div>
              ) : (
                (() => {
                  const maxRevenue = Math.max(
                    ...dashboardState.revenueTrend.map(p => Number(p.revenue) || 0),
                    1
                  );
                  return (
                    <div className="flex items-end space-x-4 h-48">
                      {dashboardState.revenueTrend.map((point, index) => {
                        const height = Math.round(((Number(point.revenue) || 0) / maxRevenue) * 100);
                        return (
                          <div key={`${point.month}-${index}`} className="flex flex-col items-center flex-1">
                            <div
                              className="w-full bg-gradient-to-t from-blue-500 to-cyan-400 rounded-t-lg transition-all"
                              style={{ height: `${height}%` }}
                              title={`${point.month}: ${formatCurrency(Number(point.revenue) || 0)}`}
                            ></div>
                            <span className="text-xs text-gray-500 dark:text-gray-400 mt-2">{point.month}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Alertes</h3>
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-900/20">
                  <p className="text-sm font-semibold text-orange-700 dark:text-orange-300">
                    {dashboardState.stats.reservations?.en_attente || 0} réservations en attente
                  </p>
                  <p className="text-xs text-orange-600 dark:text-orange-200">À vérifier rapidement</p>
                </div>
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20">
                  <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                    {dashboardState.pendingTransactions.length} transactions Wave à valider
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-200">Assurez le suivi des abonnements</p>
                </div>
                <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-900/20">
                  <p className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                    {dashboardState.stats.notifications?.non_lues || 0} notifications non lues
                  </p>
                  <p className="text-xs text-purple-600 dark:text-purple-200">Préparez vos communications</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Réservations récentes</h3>
                <Calendar className="w-5 h-5 text-blue-500" />
              </div>
              {dashboardState.recentReservations.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Aucune réservation récente</p>
              ) : (
                <div className="space-y-4">
                  {dashboardState.recentReservations.map(reservation => (
                    <div key={reservation.id} className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3 last:border-none">
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          {reservation.service_nom}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {reservation.client_prenom} {reservation.client_nom} • {formatDate(reservation.date_reservation)}
                        </p>
                      </div>
                      <StatusBadge status={reservation.statut} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Transactions Wave</h3>
                <CreditCard className="w-5 h-5 text-green-500" />
              </div>
              {dashboardState.pendingTransactions.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Aucune transaction en attente</p>
              ) : (
                <div className="space-y-4">
                  {dashboardState.pendingTransactions.map(transaction => (
                    <div key={transaction.id} className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3 last:border-none">
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{transaction.plan_nom}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {transaction.prestataire_prenom} {transaction.prestataire_nom} • {formatDate(transaction.created_at)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          {transaction.montant.toLocaleString()} {transaction.devise}
                        </p>
                        <p className="text-xs text-orange-500">À valider</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p>Aucune donnée disponible</p>
        </div>
      )}
    </div>
  );

  const renderUsers = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Gestion des Utilisateurs
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {usersState.pagination.total || processedUsers.length} utilisateurs suivis
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resetUserFilters}
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Réinitialiser
          </button>
          <button 
            onClick={loadUsers}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${globalLoading ? 'animate-spin' : ''}`} />
            <span>Rafraîchir</span>
          </button>
        </div>
      </div>

      {usersState.stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Utilisateurs"
            value={usersState.stats.total_users}
            subtitle={`${usersState.stats.nouveaux_30j} nouveaux (30j)`}
            icon={Users}
            color="blue"
          />
          <StatCard
            title="Clients"
            value={usersState.stats.clients}
            icon={UserCheck}
            color="green"
          />
          <StatCard
            title="Prestataires"
            value={usersState.stats.prestataires}
            icon={UserX}
            color="purple"
          />
          <StatCard
            title="Administrateurs"
            value={usersState.stats.admins}
            icon={Shield}
            color="orange"
          />
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SearchInput
            value={usersState.search}
            onChange={(value) => setUsersState(prev => ({ ...prev, search: value, page: 1 }))}
            placeholder="Rechercher un utilisateur..."
            className="col-span-1 lg:col-span-2"
          />
          <FilterSelect
            value={usersState.filter}
            onChange={(value) => setUsersState(prev => ({ ...prev, filter: value, page: 1 }))}
            options={[
              { value: 'all', label: 'Tous les rôles' },
              { value: 'client', label: 'Clients' },
              { value: 'prestataire', label: 'Prestataires' },
              { value: 'admin', label: 'Administrateurs' }
            ]}
          />
          <FilterSelect
            value={usersState.status}
            onChange={(value) => setUsersState(prev => ({ ...prev, status: value as 'all' | 'active' | 'inactive', page: 1 }))}
            options={[
              { value: 'all', label: 'Tous les statuts' },
              { value: 'active', label: 'Actifs' },
              { value: 'inactive', label: 'Suspendus' }
            ]}
          />
          <FilterSelect
            value={usersState.sortBy}
            onChange={(value) => setUsersState(prev => ({ ...prev, sortBy: value as typeof prev.sortBy }))}
            options={[
              { value: 'recent', label: 'Plus récents' },
              { value: 'alphabetical', label: 'A → Z' },
              { value: 'role', label: 'Par rôle' }
            ]}
          />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <LoadingSpinner />
        ) : processedUsers.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p>Aucun utilisateur trouvé</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Utilisateur
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Rôle & plan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Inscription
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {processedUsers.map(user => {
                  const isActive = user.is_active !== false && user.is_active !== 0;
                  return (
                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-semibold text-gray-900 dark:text-white">
                            {user.nom} {user.prenom}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center space-x-1">
                            <Mail className="w-3 h-3" />
                            <span>{user.email}</span>
                          </div>
                          {user.telephone && (
                            <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center space-x-1">
                              <Phone className="w-3 h-3" />
                              <span>{user.telephone}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        <p className="font-medium capitalize">{user.role_nom}</p>
                        {user.plan_nom ? (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Plan {user.plan_nom}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-400">Plan standard</p>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={isActive ? 'active' : 'inactive'} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button
                          className="inline-flex items-center px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs"
                          onClick={() => setUsersState(prev => ({ ...prev, selectedUser: user }))}
                        >
                          <Eye className="w-4 h-4 mr-1" /> Voir
                        </button>
                        <button
                          className="inline-flex items-center px-3 py-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs disabled:opacity-50"
                          onClick={() => handleToggleUserStatus(user)}
                          disabled={globalLoading}
                        >
                          {isActive ? <UserX className="w-4 h-4 mr-1" /> : <UserCheck className="w-4 h-4 mr-1" />}
                          {isActive ? 'Suspendre' : 'Activer'}
                        </button>
                        {user.role_nom !== 'admin' && (
                          <button
                            className="inline-flex items-center px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300 text-xs disabled:opacity-50"
                            onClick={() => handleDeleteUser(user)}
                            disabled={globalLoading}
                          >
                            <Trash2 className="w-4 h-4 mr-1" /> Supprimer
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-sm text-gray-500 dark:text-gray-400">
        <div>
          Page {usersState.page} / {usersState.pagination.totalPages || 1} —{' '}
          {usersState.pagination.total || processedUsers.length} utilisateurs
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleUserPageChange('prev')}
            disabled={usersState.page <= 1}
            className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-50"
          >
            Précédent
          </button>
          <button
            onClick={() => handleUserPageChange('next')}
            disabled={usersState.page >= (usersState.pagination.totalPages || 1)}
            className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-50"
          >
            Suivant
          </button>
        </div>
      </div>

      {usersState.selectedUser && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-2xl border border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-gray-400">Utilisateur #{usersState.selectedUser.id}</p>
                <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {usersState.selectedUser.prenom} {usersState.selectedUser.nom}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{usersState.selectedUser.role_nom}</p>
              </div>
              <button
                onClick={() => setUsersState(prev => ({ ...prev, selectedUser: null }))}
                className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-900"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 space-y-2">
                <p className="text-xs uppercase text-gray-500">Contact</p>
                <p className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
                  <Mail className="w-4 h-4" /> {usersState.selectedUser.email}
                </p>
                {usersState.selectedUser.telephone && (
                  <p className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
                    <Phone className="w-4 h-4" /> {usersState.selectedUser.telephone}
                  </p>
                )}
                {usersState.selectedUser.ville && (
                  <p className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
                    <MapPin className="w-4 h-4" /> {usersState.selectedUser.ville}
                  </p>
                )}
              </div>
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 space-y-2">
                <p className="text-xs uppercase text-gray-500">Plan & abonnement</p>
                <p className="text-gray-900 dark:text-white">
                  {usersState.selectedUser.plan_nom || 'Aucun plan premium'}
                </p>
                {usersState.selectedUser.abonnement_expires_at && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Expire le {formatDate(usersState.selectedUser.abonnement_expires_at)}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setUsersState(prev => ({ ...prev, selectedUser: null }))}
                className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200"
              >
                Fermer
              </button>
              <button
                onClick={() => {
                  const selected = usersState.selectedUser;
                  setUsersState(prev => ({ ...prev, selectedUser: null }));
                  if (selected) handleToggleUserStatus(selected);
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white"
              >
                {usersState.selectedUser.is_active !== false ? 'Suspendre' : 'Activer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderPayments = () => (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Paiements Wave</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {filteredTransactions.length} transactions affichées • {paymentsSummary.total} au total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPaymentsState(prev => ({ ...prev, search: '', dateFilter: 'all' }))}
            className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Réinitialiser
          </button>
          <button
            onClick={loadWaveTransactions}
            className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Transactions totales', value: paymentsSummary.total, color: 'from-blue-500 to-indigo-500' },
          { label: 'Montant validé', value: formatCurrency(paymentsSummary.validatedAmount), color: 'from-emerald-500 to-green-500' },
          { label: 'Montant en attente', value: formatCurrency(paymentsSummary.pendingAmount), color: 'from-amber-500 to-orange-500' },
          { label: "Transactions aujourd'hui", value: paymentsSummary.todayCount, color: 'from-purple-500 to-pink-500' }
        ].map(card => (
          <div key={card.label} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{card.label}</p>
            <p className={`text-2xl font-semibold mt-2 bg-gradient-to-r ${card.color} bg-clip-text text-transparent`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-3xl p-4 space-y-4 shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SearchInput
            value={paymentsState.search}
            onChange={(value) => setPaymentsState(prev => ({ ...prev, search: value }))}
            placeholder="Recherche prestataire, plan ou référence Wave..."
            className="col-span-1 lg:col-span-2"
          />
          <FilterSelect
            value={paymentsState.filter}
            onChange={(value) => setPaymentsState(prev => ({ ...prev, filter: value as typeof paymentsState.filter }))}
            options={[
              { value: 'all', label: 'Tous les statuts' },
              { value: 'en_attente', label: 'En attente' },
              { value: 'valide', label: 'Validées' },
              { value: 'rejete', label: 'Rejetées' }
            ]}
          />
        </div>
        <div className="flex items-center flex-wrap gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          {paymentDateFilters.map(option => (
            <button
              key={option.value}
              onClick={() => setPaymentsState(prev => ({ ...prev, dateFilter: option.value }))}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                paymentsState.dateFilter === option.value
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <LoadingSpinner />
        ) : filteredTransactions.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <CreditCard className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p>Aucune transaction ne correspond aux filtres actuels</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Prestataire</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Plan</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Montant</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Statut</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredTransactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">
                        {transaction.prestataire_nom} {transaction.prestataire_prenom}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{transaction.prestataire_email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {transaction.plan_nom} ({transaction.duree_abonnement_jours}j)
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(transaction.montant, transaction.devise)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(transaction.created_at)}
                      <div className="text-xs text-gray-400">Wave ID: {transaction.transaction_id_wave}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={transaction.statut} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-medium">
                      <div className="flex flex-wrap gap-2">
                        {transaction.statut === 'en_attente' && (
                          <>
                            <button
                              onClick={() => validateTransaction(transaction.id)}
                              className="inline-flex items-center px-3 py-1.5 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-200"
                            >
                              Valider
                            </button>
                            <button
                              onClick={() =>
                                setPaymentsState(prev => ({
                                  ...prev,
                                  selectedTransaction: transaction,
                                  showRejectModal: true,
                                  rejectReason: '',
                                  showTransactionModal: false
                                }))
                              }
                              className="inline-flex items-center px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-200"
                            >
                              Rejeter
                            </button>
                          </>
                        )}
                        <button
                          onClick={() =>
                            setPaymentsState(prev => ({
                              ...prev,
                              selectedTransaction: transaction,
                              showTransactionModal: true
                            }))
                          }
                          className="inline-flex items-center px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                        >
                          <Eye className="w-4 h-4 mr-1" /> Voir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {paymentsState.showTransactionModal && paymentsState.selectedTransaction && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl border border-gray-200 dark:border-gray-800">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase text-gray-400">Transaction #{paymentsState.selectedTransaction.id}</p>
                <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {paymentsState.selectedTransaction.prestataire_nom} {paymentsState.selectedTransaction.prestataire_prenom}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{paymentsState.selectedTransaction.plan_nom}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={paymentsState.selectedTransaction.statut} />
                <button
                  onClick={() => setPaymentsState(prev => ({ ...prev, showTransactionModal: false, selectedTransaction: null }))}
                  className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-900"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 space-y-2">
                <p className="text-xs uppercase text-gray-500">Montant</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(paymentsState.selectedTransaction.montant, paymentsState.selectedTransaction.devise)}
                </p>
                <p className="text-xs text-gray-500">Durée: {paymentsState.selectedTransaction.duree_abonnement_jours} jours</p>
              </div>
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 space-y-2">
                <p className="text-xs uppercase text-gray-500">Référence Wave</p>
                <p className="text-gray-900 dark:text-white font-medium">{paymentsState.selectedTransaction.transaction_id_wave}</p>
                <p className="text-xs text-gray-500">Créée le {formatDate(paymentsState.selectedTransaction.created_at)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 space-y-1">
                <p className="text-xs uppercase text-gray-500">Prestataire</p>
                <p className="text-gray-900 dark:text-white font-medium">
                  {paymentsState.selectedTransaction.prestataire_nom} {paymentsState.selectedTransaction.prestataire_prenom}
                </p>
                <p className="text-xs text-gray-500">{paymentsState.selectedTransaction.prestataire_email}</p>
              </div>
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 space-y-1">
                <p className="text-xs uppercase text-gray-500">Plan</p>
                <p className="text-gray-900 dark:text-white font-medium">{paymentsState.selectedTransaction.plan_nom}</p>
                {paymentsState.selectedTransaction.motif_rejet && (
                  <p className="text-xs text-red-500">Motif rejet: {paymentsState.selectedTransaction.motif_rejet}</p>
                )}
              </div>
            </div>

            {paymentsState.selectedTransaction.statut === 'en_attente' && (
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  onClick={() => {
                    validateTransaction(paymentsState.selectedTransaction!.id);
                    setPaymentsState(prev => ({ ...prev, showTransactionModal: false, selectedTransaction: null }));
                  }}
                  className="px-4 py-2 rounded-xl bg-green-600 text-white"
                >
                  Valider
                </button>
                <button
                  onClick={() =>
                    setPaymentsState(prev => ({
                      ...prev,
                      showTransactionModal: false,
                      showRejectModal: true,
                      rejectReason: '',
                      selectedTransaction: prev.selectedTransaction
                    }))
                  }
                  className="px-4 py-2 rounded-xl bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-200"
                >
                  Rejeter
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const renderServices = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Gestion des Services
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {servicesState.pagination.total || processedServices.length} services référencés
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setServicesState(prev => ({ ...prev, filter: 'all', search: '', sortBy: 'recent', page: 1 }))}
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Réinitialiser
          </button>
          <button 
            onClick={loadServices}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${globalLoading ? 'animate-spin' : ''}`} />
            <span>Rafraîchir</span>
          </button>
        </div>
      </div>

      {servicesState.stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Services totaux"
            value={servicesState.stats.overview.total_services}
            subtitle={`${servicesState.stats.overview.nouveaux_ce_mois} nouveaux (30j)`}
            icon={Package}
            color="blue"
          />
          <StatCard
            title="Actifs"
            value={servicesState.stats.overview.services_actifs}
            subtitle={`${servicesState.stats.overview.services_suspendus} suspendus`}
            icon={CheckCircle}
            color="green"
          />
          <StatCard
            title="Prix moyen"
            value={formatCurrency(servicesState.stats.overview.prix_moyen || 0)}
            icon={DollarSign}
            color="purple"
          />
          <StatCard
            title="Top catégorie"
            value={servicesState.stats.topCategories?.[0]?.categorie || 'N/A'}
            subtitle={`${servicesState.stats.topCategories?.[0]?.nombre_services || 0} services`}
            icon={Grid3X3}
            color="orange"
          />
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SearchInput
            value={servicesState.search}
            onChange={(value) => setServicesState(prev => ({ ...prev, search: value, page: 1 }))}
            placeholder="Rechercher un service ou prestataire..."
            className="col-span-1 lg:col-span-2"
          />
          <FilterSelect
            value={servicesState.filter}
            onChange={(value) => setServicesState(prev => ({ ...prev, filter: value, page: 1 }))}
            options={[
              { value: 'all', label: 'Tous les services' },
              { value: 'active', label: 'Actifs' },
              { value: 'inactive', label: 'Inactifs' }
            ]}
          />
          <FilterSelect
            value={servicesState.sortBy}
            onChange={(value) => setServicesState(prev => ({ ...prev, sortBy: value as typeof prev.sortBy }))}
            options={[
              { value: 'recent', label: 'Plus récents' },
              { value: 'price_desc', label: 'Prix décroissant' },
              { value: 'price_asc', label: 'Prix croissant' },
              { value: 'rating', label: 'Mieux notés' }
            ]}
          />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <LoadingSpinner />
        ) : processedServices.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p>Aucun service trouvé</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Service</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Prestataire</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Prix</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Réservations</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Statut</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {processedServices.map((service) => {
                  const rating = parseNumericValue(service.moyenne_avis);
                  return (
                    <tr key={service.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{service.nom}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {service.categorie_nom} • {service.sous_categorie_nom || 'Sans sous-catégorie'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        <p className="font-medium">{service.prestataire_nom}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{service.prestataire_email}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(service.prix, service.devise)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {service.total_reservations || 0} rés. • {rating.toFixed(1)}★
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={service.is_active ? 'active' : 'inactive'} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button
                          className="inline-flex items-center px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs"
                          onClick={() => handleViewService(service.id)}
                        >
                          <Eye className="w-4 h-4 mr-1" /> Voir
                        </button>
                        <button
                          className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs ${
                            service.is_active
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300'
                              : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-300'
                          }`}
                          onClick={() => handleServiceStatusToggle(service.id, !service.is_active, service.nom)}
                          disabled={globalLoading}
                        >
                          {service.is_active ? 'Suspendre' : 'Activer'}
                        </button>
                        <button
                          className="inline-flex items-center px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300 text-xs"
                          onClick={() => handleServiceDelete(service.id, service.nom)}
                          disabled={globalLoading}
                        >
                          <Trash2 className="w-4 h-4 mr-1" /> Supprimer
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-sm text-gray-500 dark:text-gray-400">
        <div>
          Page {servicesState.page} / {servicesState.pagination.totalPages || 1} —{' '}
          {servicesState.pagination.total || processedServices.length} services
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleServicePageChange('prev')}
            disabled={servicesState.page <= 1}
            className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-50"
          >
            Précédent
          </button>
          <button
            onClick={() => handleServicePageChange('next')}
            disabled={servicesState.page >= (servicesState.pagination.totalPages || 1)}
            className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-50"
          >
            Suivant
          </button>
        </div>
      </div>

      {servicesState.stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Top catégories</h3>
              <Grid3X3 className="w-5 h-5 text-purple-500" />
            </div>
            {servicesState.stats.topCategories.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Pas de données.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {servicesState.stats.topCategories.map((cat, idx) => (
                  <li key={cat.categorie} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        #{idx + 1} {cat.categorie}
                      </p>
                      <p className="text-xs text-gray-500">{cat.nombre_services} services</p>
                    </div>
                    <div className="w-24 bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-2 rounded-full bg-purple-500"
                        style={{
                          width: `${(cat.nombre_services / (servicesState.stats.topCategories[0].nombre_services || 1)) * 100}%`
                        }}
                      ></div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Prestataires les plus actifs</h3>
              <Crown className="w-5 h-5 text-yellow-500" />
            </div>
            {servicesState.stats.topPrestataires.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Pas de données.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {servicesState.stats.topPrestataires.map((prest, idx) => {
                  const rating = parseNumericValue(prest.moyenne_avis);
                  return (
                    <li key={`${prest.prestataire}-${idx}`} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          #{idx + 1} {prest.prestataire}
                        </p>
                        <p className="text-xs text-gray-500">{prest.nombre_services} services • {rating.toFixed(1)}★</p>
                      </div>
                      <span className="text-xs text-gray-400">{prest.email}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {servicesState.selectedService && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl border border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-gray-400">Service #{servicesState.selectedService.id}</p>
                <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {servicesState.selectedService.nom}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{servicesState.selectedService.categorie_nom}</p>
              </div>
              <button
                onClick={() => setServicesState(prev => ({ ...prev, selectedService: null }))}
                className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-900"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {servicesState.loadingDetail ? (
              <LoadingSpinner message="Chargement du service..." />
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 space-y-2">
                    <p className="text-xs uppercase text-gray-500">Prestataire</p>
                    <p className="text-gray-900 dark:text-white font-medium">
                      {servicesState.selectedService.prestataire_nom}
                    </p>
                    <p className="text-gray-500 text-xs">
                      {servicesState.selectedService.prestataire_email}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 space-y-2">
                    <p className="text-xs uppercase text-gray-500">Performance</p>
                    <p className="text-gray-900 dark:text-white font-medium">
                      {servicesState.selectedService.total_reservations || 0} réservations
                    </p>
                    <p className="text-gray-500 text-xs">
                      Note moyenne : {parseNumericValue(servicesState.selectedService.moyenne_avis).toFixed(1)} / 5
                    </p>
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                  {servicesState.selectedService.description}
                </p>
              </>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setServicesState(prev => ({ ...prev, selectedService: null }))}
                className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200"
              >
                Fermer
              </button>
              <button
                onClick={() => {
                  const selected = servicesState.selectedService;
                  setServicesState(prev => ({ ...prev, selectedService: null }));
                  if (selected) handleServiceStatusToggle(selected.id, !selected.is_active, selected.nom);
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white"
              >
                {servicesState.selectedService.is_active ? 'Suspendre' : 'Activer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const filteredCategories = useMemo(() => {
    const q = categoriesState.search.trim().toLowerCase();
    if (!q) return categoriesState.categories;
    return categoriesState.categories.filter(cat =>
      (cat.nom || '').toLowerCase().includes(q) ||
      (cat.description || '').toLowerCase().includes(q)
    );
  }, [categoriesState.categories, categoriesState.search]);

  const reservationDateFilters: Array<{ value: 'all' | 'today' | 'week' | 'month'; label: string }> = [
    { value: 'all', label: 'Toutes les dates' },
    { value: 'today', label: "Aujourd'hui" },
    { value: 'week', label: '7 prochains jours' },
    { value: 'month', label: '30 prochains jours' }
  ];

  const reservationsSummary = useMemo(() => {
    const now = new Date();
    const counts: Record<string, number> = {
      en_attente: 0,
      confirmee: 0,
      terminee: 0,
      annulee: 0
    };
    let today = 0;
    let upcoming = 0;
    let weekUpcoming = 0;
    let monthUpcoming = 0;

    reservationsState.reservations.forEach(reservation => {
      counts[reservation.statut] = (counts[reservation.statut] || 0) + 1;
      const date = new Date(reservation.date_reservation);
      if (isNaN(date.getTime())) return;
      if (date.toDateString() === now.toDateString()) today += 1;
      if (date >= now) {
        upcoming += 1;
        const diffDays = (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays <= 7) weekUpcoming += 1;
        if (diffDays <= 30) monthUpcoming += 1;
      }
    });

    const total = reservationsState.reservations.length;
    const completionRate = total ? Math.round(((counts.terminee || 0) / total) * 100) : 0;
    const confirmationRate = total
      ? Math.round((((counts.confirmee || 0) + (counts.terminee || 0)) / total) * 100)
      : 0;

    return {
      total,
      counts,
      today,
      upcoming,
      weekUpcoming,
      monthUpcoming,
      completionRate,
      confirmationRate
    };
  }, [reservationsState.reservations]);

  const filteredReservations = useMemo(() => {
    const q = (reservationsState.search || '').trim().toLowerCase();
    const now = new Date();

    return reservationsState.reservations
      .filter(reservation =>
        reservationsState.filter === 'all' ? true : reservation.statut === reservationsState.filter
      )
      .filter(reservation => {
        if (reservationsState.dateFilter === 'all') return true;
        const date = new Date(reservation.date_reservation);
        if (isNaN(date.getTime())) return false;
        if (reservationsState.dateFilter === 'today') {
          return date.toDateString() === now.toDateString();
        }
        const diffDays = (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        if (reservationsState.dateFilter === 'week') {
          return diffDays >= 0 && diffDays <= 7;
        }
        if (reservationsState.dateFilter === 'month') {
          return diffDays >= 0 && diffDays <= 30;
        }
        return true;
      })
      .filter(reservation => {
        if (!q) return true;
        return (
          `${reservation.client_prenom} ${reservation.client_nom}`.toLowerCase().includes(q) ||
          (reservation.client_email || '').toLowerCase().includes(q) ||
          reservation.service_nom.toLowerCase().includes(q) ||
          reservation.prestataire_nom.toLowerCase().includes(q) ||
          String(reservation.id).includes(q)
        );
      });
  }, [reservationsState.reservations, reservationsState.filter, reservationsState.search, reservationsState.dateFilter]);

  const paymentDateFilters: Array<{ value: 'all' | 'today' | 'week' | 'month'; label: string }> = [
    { value: 'all', label: 'Toutes les dates' },
    { value: 'today', label: "Aujourd'hui" },
    { value: 'week', label: '7 derniers jours' },
    { value: 'month', label: '30 derniers jours' }
  ];

  const analyticsPeriods: Array<{ value: '7d' | '30d' | '90d' | '1y'; label: string }> = [
    { value: '7d', label: '7j' },
    { value: '30d', label: '30j' },
    { value: '90d', label: '90j' },
    { value: '1y', label: '1 an' }
  ];

  const paymentsSummary = useMemo(() => {
    const counts: Record<string, number> = {
      en_attente: 0,
      valide: 0,
      rejete: 0
    };
    let totalAmount = 0;
    let validatedAmount = 0;
    let pendingAmount = 0;
    let todayCount = 0;
    let monthCount = 0;
    const now = new Date();

    paymentsState.transactions.forEach((transaction) => {
      counts[transaction.statut] = (counts[transaction.statut] || 0) + 1;
      const amount = parseNumericValue(transaction.montant);
      totalAmount += amount;
      if (transaction.statut === 'valide') {
        validatedAmount += amount;
      }
      if (transaction.statut === 'en_attente') {
        pendingAmount += amount;
      }
      const date = new Date(transaction.created_at);
      if (!isNaN(date.getTime())) {
        if (date.toDateString() === now.toDateString()) {
          todayCount += 1;
        }
        const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays <= 30) {
          monthCount += 1;
        }
      }
    });

    return {
      total: paymentsState.transactions.length,
      counts,
      totalAmount,
      validatedAmount,
      pendingAmount,
      todayCount,
      monthCount
    };
  }, [paymentsState.transactions]);

  const filteredTransactions = useMemo(() => {
    const q = paymentsState.search.trim().toLowerCase();
    const now = new Date();

    return paymentsState.transactions
      .filter((transaction) => {
        if (!q) return true;
        return (
          `${transaction.prestataire_nom} ${transaction.prestataire_prenom}`.toLowerCase().includes(q) ||
          (transaction.prestataire_email || '').toLowerCase().includes(q) ||
          transaction.plan_nom.toLowerCase().includes(q) ||
          (transaction.transaction_id_wave || '').toLowerCase().includes(q)
        );
      })
      .filter((transaction) => {
        if (paymentsState.dateFilter === 'all') return true;
        const date = new Date(transaction.created_at);
        if (isNaN(date.getTime())) return true;
        if (paymentsState.dateFilter === 'today') {
          return date.toDateString() === now.toDateString();
        }
        const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
        if (paymentsState.dateFilter === 'week') {
          return diffDays <= 7;
        }
        if (paymentsState.dateFilter === 'month') {
          return diffDays <= 30;
        }
        return true;
      });
  }, [paymentsState.transactions, paymentsState.search, paymentsState.dateFilter]);

  const settingsOverview = useMemo(() => {
    const entries = Object.entries(settingsState.settings);
    const categories = new Set(entries.map(([, setting]) => (setting.category || 'general').toLowerCase()));
    return {
      total: entries.length,
      categories: categories.size
    };
  }, [settingsState.settings]);

  const groupedSettings = useMemo(() => {
    const q = settingsState.search.trim().toLowerCase();
    const groups: Record<string, Array<[string, AppSetting]>> = {};
    Object.entries(settingsState.settings).forEach(([key, setting]) => {
      if (
        q &&
        !key.toLowerCase().includes(q) &&
        !(setting.description || '').toLowerCase().includes(q)
      ) {
        return;
      }
      const category = (setting.category || 'general').toLowerCase();
      if (!groups[category]) groups[category] = [];
      groups[category].push([key, setting]);
    });
    const formatLabel = (category: string) => {
      switch (category) {
        case 'general': return 'Paramètres généraux';
        case 'security': return 'Sécurité';
        case 'payment': return 'Paiements';
        case 'notification': return 'Notifications';
        default:
          return category.charAt(0).toUpperCase() + category.slice(1);
      }
    };
    return Object.entries(groups)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([category, entries]) => ({
        category,
        label: formatLabel(category),
        items: entries
      }));
  }, [settingsState.settings, settingsState.search]);

  const renderCategories = () => (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Gestion des Catégories
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {filteredCategories.length} catégories listées
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SearchInput
              value={categoriesState.search}
              onChange={(value) => setCategoriesState(prev => ({ ...prev, search: value }))}
              placeholder="Rechercher une catégorie..."
              className="w-64"
            />
            <button 
              onClick={handleCategoryCreate}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Nouvelle catégorie</span>
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          {loading ? (
            <LoadingSpinner />
          ) : filteredCategories.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <Grid3X3 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p>Aucune catégorie trouvée</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredCategories.map((category) => (
                <div key={category.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      {category.icone && (
                        <div className="w-12 h-12 rounded-lg flex items-center justify-center" 
                             style={{ backgroundColor: category.couleur || '#3B82F6' }}>
                          <span className="text-white text-xl">{category.icone}</span>
                        </div>
                      )}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{category.nom}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{category.description}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {category.sous_categories_count || 0} sous-catégories • 
                          {category.services_count || 0} services
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleOpenSubCategories(category)}
                        className="inline-flex items-center space-x-1 px-3 py-2 text-sm text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                      >
                        <Grid3X3 className="w-4 h-4" />
                        <span>Sous-catégories</span>
                      </button>
                      <button
                        onClick={() => handleCategoryEdit(category.id)}
                        className="p-2 text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                        title="Modifier"
                      >
                        <Edit3 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleCategoryDelete(category.id)}
                        className="p-2 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {categoriesState.showSubcategoryModal && categoriesState.selectedCategory && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl border border-gray-200 dark:border-gray-800">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase text-gray-400">Catégorie</p>
                <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {categoriesState.selectedCategory.nom}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {categoriesState.selectedCategory.description}
                </p>
              </div>
              <button
                onClick={handleCloseSubCategories}
                className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-900"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 space-y-2">
                <p className="text-xs uppercase text-gray-500">Résumé</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {categoriesState.subCategories.length} sous-catégories
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {categoriesState.selectedCategory.services_count || 0} services rattachés
                </p>
                <button
                  onClick={handleRefreshSubCategories}
                  className="inline-flex items-center text-sm text-blue-600 dark:text-blue-400 mt-2"
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Actualiser la liste
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-3">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Ajouter une sous-catégorie</p>
                <input
                  type="text"
                  value={categoriesState.newSubCategory.nom}
                  onChange={(e) => handleSubCategoryFormChange('nom', e.target.value)}
                  placeholder="Nom"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <textarea
                  value={categoriesState.newSubCategory.description}
                  onChange={(e) => handleSubCategoryFormChange('description', e.target.value)}
                  placeholder="Description"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={handleSubCategoryCreate}
                  className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Ajouter
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Sous-catégories</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Glissez-déposez pour réordonner</p>
                </div>
              </div>
              <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                {categoriesState.loadingSubCategories ? (
                  <LoadingSpinner message="Chargement des sous-catégories..." />
                ) : categoriesState.subCategories.length === 0 ? (
                  <div className="p-6 text-center text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-700 rounded-2xl">
                    Aucune sous-catégorie enregistrée
                  </div>
                ) : (
                  categoriesState.subCategories.map((subCategory) => (
                    <div
                      key={subCategory.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = 'move';
                        handleSubCategoryDragStart(subCategory.id);
                      }}
                      onDragEnd={handleSubCategoryDragEnd}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleSubCategoryDrop(subCategory.id);
                      }}
                      className={`flex items-center gap-3 p-4 rounded-2xl border transition-colors ${
                        categoriesState.draggedSubCategoryId === subCategory.id
                          ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                      }`}
                    >
                      <span className="text-gray-400 cursor-move">
                        <GripVertical className="w-4 h-4" />
                      </span>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 dark:text-white">{subCategory.nom}</p>
                        {subCategory.description && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">{subCategory.description}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {subCategory.nombre_services || 0} services • Ordre #{subCategory.ordre_affichage || '-'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={subCategory.is_active ? 'active' : 'inactive'} />
                        <button
                          onClick={() => handleSubCategoryEdit(subCategory)}
                          className="p-2 text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleSubCategoryToggle(subCategory)}
                          className={`p-2 rounded-lg ${subCategory.is_active ? 'text-yellow-600 hover:text-yellow-800 hover:bg-yellow-50 dark:hover:bg-yellow-900/30' : 'text-green-600 hover:text-green-800 hover:bg-green-50 dark:hover:bg-green-900/30'}`}
                          title={subCategory.is_active ? 'Désactiver' : 'Activer'}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleSubCategoryDelete(subCategory)}
                          className="p-2 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleCloseSubCategories}
                className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  const renderReservations = () => (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Gestion des Réservations</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {filteredReservations.length} réservations affichées • {reservationsSummary.total} au total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setReservationsState(prev => ({ ...prev, search: '', filter: 'all', dateFilter: 'all' }))}
            className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Réinitialiser
          </button>
          <button
            onClick={loadReservations}
            className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: reservationsSummary.total, color: 'from-slate-600 to-gray-900' },
          { label: 'En attente', value: reservationsSummary.counts.en_attente || 0, color: 'from-orange-500 to-amber-600' },
          { label: 'Confirmées', value: reservationsSummary.counts.confirmee || 0, color: 'from-blue-500 to-cyan-500' },
          { label: 'Terminées', value: reservationsSummary.counts.terminee || 0, color: 'from-emerald-500 to-lime-500' }
        ].map(card => (
          <div key={card.label} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{card.label}</p>
            <p className={`text-3xl font-semibold mt-2 bg-gradient-to-r ${card.color} bg-clip-text text-transparent`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
          <p className="text-xs uppercase text-gray-500">Aujourd'hui</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{reservationsSummary.today}</p>
          <p className="text-sm text-gray-500">Réservations prévues</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
          <p className="text-xs uppercase text-gray-500">30 prochains jours</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{reservationsSummary.monthUpcoming}</p>
          <p className="text-sm text-gray-500">Réservations à venir</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
          <p className="text-xs uppercase text-gray-500">Taux de complétion</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{reservationsSummary.completionRate}%</p>
          <p className="text-sm text-gray-500">Réservations terminées vs totales</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-3xl p-4 space-y-4 shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SearchInput
            value={reservationsState.search}
            onChange={(value) => setReservationsState(prev => ({ ...prev, search: value }))}
            placeholder="Recherche client, prestataire ou service..."
            className="col-span-1 lg:col-span-2"
          />
          <FilterSelect
            value={reservationsState.filter}
            onChange={(value) => setReservationsState(prev => ({ ...prev, filter: value }))}
            options={[
              { value: 'all', label: 'Tous les statuts' },
              { value: 'en_attente', label: 'En attente' },
              { value: 'confirmee', label: 'Confirmées' },
              { value: 'terminee', label: 'Terminées' },
              { value: 'annulee', label: 'Annulées' },
            ]}
          />
        </div>
        <div className="flex items-center flex-wrap gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          {reservationDateFilters.map(option => (
            <button
              key={option.value}
              onClick={() => setReservationsState(prev => ({ ...prev, dateFilter: option.value }))}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                reservationsState.dateFilter === option.value
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <LoadingSpinner />
        ) : filteredReservations.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p>Aucune réservation ne correspond aux filtres actuels</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Client</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Service</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Prestataire</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date & horaire</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Statut</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredReservations.map((reservation) => (
                  <tr key={reservation.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">
                        {reservation.client_prenom} {reservation.client_nom}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{reservation.client_email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{reservation.service_nom}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{reservation.prestataire_nom}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      <div>{formatDate(reservation.date_reservation)}</div>
                      <div className="text-xs">{reservation.heure_debut} - {reservation.heure_fin}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={reservation.statut} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-medium">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="inline-flex items-center px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                          onClick={() => setReservationsState(prev => ({ ...prev, selectedReservation: reservation }))}
                        >
                          <Eye className="w-4 h-4 mr-1" /> Voir
                        </button>
                        {reservation.statut === 'en_attente' && (
                          <button
                            onClick={() => requestReservationStatusChange(reservation.id, 'confirmee')}
                            className="px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200"
                          >
                            Valider
                          </button>
                        )}
                        {reservation.statut !== 'terminee' && (
                          <button
                            onClick={() => requestReservationStatusChange(reservation.id, 'terminee')}
                            className="px-3 py-1.5 rounded-lg bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200"
                          >
                            Terminer
                          </button>
                        )}
                        {reservation.statut !== 'annulee' && (
                          <button
                            onClick={() => requestReservationStatusChange(reservation.id, 'annulee')}
                            className="px-3 py-1.5 rounded-lg bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200"
                          >
                            Annuler
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {reservationsState.selectedReservation && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl border border-gray-200 dark:border-gray-800">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-[200px]">
                <p className="text-xs uppercase text-gray-400">Réservation #{reservationsState.selectedReservation.id}</p>
                <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {reservationsState.selectedReservation.client_prenom} {reservationsState.selectedReservation.client_nom}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{reservationsState.selectedReservation.service_nom}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={reservationsState.selectedReservation.statut} />
                <button
                  onClick={() => setReservationsState(prev => ({ ...prev, selectedReservation: null }))}
                  className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-900"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 space-y-2">
                <p className="text-xs uppercase text-gray-500">Client</p>
                <p className="text-gray-900 dark:text-white font-medium">
                  {reservationsState.selectedReservation.client_prenom} {reservationsState.selectedReservation.client_nom}
                </p>
                <p className="text-gray-500 text-xs">{reservationsState.selectedReservation.client_email}</p>
              </div>
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 space-y-2">
                <p className="text-xs uppercase text-gray-500">Prestataire</p>
                <p className="text-gray-900 dark:text-white font-medium">
                  {reservationsState.selectedReservation.prestataire_nom}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 space-y-2">
                <p className="text-xs uppercase text-gray-500">Date</p>
                <p className="text-gray-900 dark:text-white font-medium">
                  {formatDate(reservationsState.selectedReservation.date_reservation)}
                </p>
                <p className="text-xs text-gray-500">{reservationsState.selectedReservation.heure_debut} - {reservationsState.selectedReservation.heure_fin}</p>
              </div>
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 space-y-2">
                <p className="text-xs uppercase text-gray-500">Contact client</p>
                <p className="text-gray-900 dark:text-white font-medium">
                  {reservationsState.selectedReservation.client_email || '—'}
                </p>
                {reservationsState.selectedReservation.client_telephone && (
                  <p className="text-xs text-gray-500">{reservationsState.selectedReservation.client_telephone}</p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                onClick={() => setReservationsState(prev => ({ ...prev, selectedReservation: null }))}
                className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200"
              >
                Fermer
              </button>
              {reservationsState.selectedReservation.statut === 'en_attente' && (
                <button
                  onClick={() => {
                    if (requestReservationStatusChange(reservationsState.selectedReservation!.id, 'confirmee')) {
                      setReservationsState(prev => ({ ...prev, selectedReservation: null }));
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200"
                >
                  Valider
                </button>
              )}
              {reservationsState.selectedReservation.statut !== 'terminee' && (
                <button
                  onClick={() => {
                    if (requestReservationStatusChange(reservationsState.selectedReservation!.id, 'terminee')) {
                      setReservationsState(prev => ({ ...prev, selectedReservation: null }));
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-green-600 text-white"
                >
                  Marquer terminé
                </button>
              )}
              {reservationsState.selectedReservation.statut !== 'annulee' && (
                <button
                  onClick={() => {
                    if (requestReservationStatusChange(reservationsState.selectedReservation!.id, 'annulee')) {
                      setReservationsState(prev => ({ ...prev, selectedReservation: null }));
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-200"
                >
                  Annuler
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderAvis = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Modération des Avis ({avisState.avis.length})
        </h2>
        <FilterSelect
          value={avisState.filter}
          onChange={(value) => setAvisState(prev => ({ ...prev, filter: value }))}
          options={[
            { value: 'all', label: 'Tous les avis' },
            { value: 'pending', label: 'En attente' },
            { value: 'approved', label: 'Approuvés' },
            { value: 'rejected', label: 'Rejetés' },
          ]}
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <LoadingSpinner />
        ) : avisState.avis.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <Star className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p>Aucun avis trouvé</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {avisState.avis.map((avis) => (
              <div key={avis.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="font-semibold text-gray-900 dark:text-white">{avis.client_prenom} {avis.client_nom}</span>
                      <span className="text-gray-500 dark:text-gray-400">sur</span>
                      <span className="font-medium text-blue-600 dark:text-blue-400">{avis.service_nom}</span>
                    </div>
                    <div className="flex items-center">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`w-5 h-5 ${i < avis.note ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
                      ))}
                    </div>
                    <p className="mt-3 text-gray-700 dark:text-gray-300">{avis.commentaire}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{formatDate(avis.created_at)}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {avis.is_approved === null && (
                      <>
                        <button onClick={() => handleAvisModerate(avis.id, true)} className="p-2 text-green-500 hover:text-green-700">
                          <CheckCircle className="w-5 h-5" />
                        </button>
                        <button onClick={() => handleAvisModerate(avis.id, false)} className="p-2 text-red-500 hover:text-red-700">
                          <XCircle className="w-5 h-5" />
                        </button>
                      </>
                    )}
                    {avis.is_approved === true && <StatusBadge status="approved" />}
                    {avis.is_approved === false && <StatusBadge status="rejected" />}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderNotifications = () => {
    const handleSendNotification = async () => {
      if (!notificationTitle || !notificationMessage) {
        showToast('Titre et message requis', 'error');
        return;
      }
      try {
        await api.admin.notifications.broadcast({ 
          title: notificationTitle, 
          message: notificationMessage, 
          type: notificationType,
          target_roles: ['all']
        });
        showToast('Notification envoyée', 'success');
        setNotificationTitle('');
        setNotificationMessage('');
        setNotificationType('info');
        loadNotifications();
      } catch (error) {
        showToast('Erreur d\'envoi', 'error');
      }
    };

    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Notifications Système</h2>
        
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Envoyer une notification globale</h3>
          <div className="space-y-4">
            <input type="text" placeholder="Titre" value={notificationTitle} onChange={(e) => setNotificationTitle(e.target.value)} className="w-full px-4 py-2 border rounded-lg" />
            <textarea placeholder="Message" value={notificationMessage} onChange={(e) => setNotificationMessage(e.target.value)} className="w-full px-4 py-2 border rounded-lg" rows={3}></textarea>
            <select value={notificationType} onChange={(e) => setNotificationType(e.target.value as 'info' | 'success' | 'warning' | 'error')} className="w-full px-4 py-2 border rounded-lg">
              <option value="info">Info</option>
              <option value="success">Succès</option>
              <option value="warning">Avertissement</option>
              <option value="error">Erreur</option>
            </select>
            <button onClick={handleSendNotification} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Envoyer</button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white p-6">Notifications récentes</h3>
          {loading ? <LoadingSpinner /> : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {notificationsState.notifications.map(notif => (
                <div key={notif.id} className="p-6">
                  <div className="flex justify-between">
                    <div>
                      <p className={`font-semibold ${notif.is_read ? '' : 'text-blue-600'}`}>{notif.titre}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{notif.message}</p>
                      <p className="text-xs text-gray-500 mt-1">{formatDate(notif.created_at)}</p>
                    </div>
                    <StatusBadge status={notif.is_read ? 'Lu' : 'Non lu'} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderStatistics = () => (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Statistiques avancées</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Analyse détaillée de la plateforme — période {dashboardState.analytics?.period?.toUpperCase() || '30J'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {analyticsPeriods.map((period) => (
            <button
              key={period.value}
              onClick={() => handleAnalyticsPeriodChange(period.value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                dashboardState.overviewPeriod === period.value
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {period.label}
            </button>
          ))}
          <button
            onClick={() => loadStats(dashboardState.overviewPeriod)}
            className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner message="Analyse en cours..." />
      ) : dashboardState.analytics ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Utilisateurs totaux"
              value={dashboardState.analytics.general?.total_users || 0}
              subtitle={`${dashboardState.analytics.general?.total_clients || 0} clients`}
              icon={Users}
              color="blue"
            />
            <StatCard
              title="Prestataires"
              value={dashboardState.analytics.general?.total_prestataires || 0}
              subtitle={`${dashboardState.analytics.general?.total_services || 0} services`}
              icon={Crown}
              color="purple"
            />
            <StatCard
              title="Revenus période"
              value={formatCurrency(dashboardState.analytics.growth?.revenus_periode || 0)}
              subtitle={`Total: ${formatCurrency(dashboardState.analytics.general?.revenus_totaux || 0)}`}
              icon={DollarSign}
              color="green"
            />
            <StatCard
              title="Taux de complétion"
              value={`${dashboardState.analytics.conversion?.taux_completion_reservations || 0}%`}
              subtitle="Réservations complétées"
              icon={Activity}
              color="orange"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Tendance des revenus</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {dashboardState.revenueTrend.length} points — mise à jour {dashboardState.lastUpdated ? dashboardState.lastUpdated.toLocaleDateString('fr-FR') : '—'}
                  </p>
                </div>
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              {dashboardState.revenueTrend.length === 0 ? (
                <div className="text-sm text-gray-500 dark:text-gray-400">Pas de données suffisantes</div>
              ) : (
                (() => {
                  const maxRevenue = Math.max(
                    ...dashboardState.revenueTrend.map(p => Number(p.revenue) || 0),
                    1
                  );
                  return (
                    <div className="flex items-end space-x-4 h-48">
                      {dashboardState.revenueTrend.map((point, index) => {
                        const height = Math.round(((Number(point.revenue) || 0) / maxRevenue) * 100);
                        return (
                          <div key={`${point.month}-${index}`} className="flex flex-col items-center flex-1">
                            <div
                              className="w-full bg-gradient-to-t from-blue-500 to-cyan-400 rounded-t-lg transition-all"
                              style={{ height: `${height}%` }}
                              title={`${point.month}: ${formatCurrency(Number(point.revenue) || 0)}`}
                            ></div>
                            <span className="text-xs text-gray-500 dark:text-gray-400 mt-2">{point.month}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Croissance</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Nouveaux utilisateurs</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {dashboardState.analytics.growth?.nouveaux_utilisateurs || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Nouveaux services</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {dashboardState.analytics.growth?.nouveaux_services || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Nouvelles réservations</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {dashboardState.analytics.growth?.nouvelles_reservations || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Revenus générés</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(dashboardState.analytics.growth?.revenus_periode || 0)}
                  </span>
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/80">
                <p className="text-xs uppercase text-gray-500 mb-1">Nouveaux utilisateurs</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Aujourd'hui : <span className="font-semibold text-gray-900 dark:text-white">{dashboardState.newUsersSnapshot.today}</span> •
                  Semaine : <span className="font-semibold text-gray-900 dark:text-white">{dashboardState.newUsersSnapshot.week}</span> •
                  Mois : <span className="font-semibold text-gray-900 dark:text-white">{dashboardState.newUsersSnapshot.month}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Performance & conversions</h3>
              <div className="space-y-4">
                {[
                  {
                    label: 'Taux de complétion des réservations',
                    value: `${dashboardState.analytics.conversion?.taux_completion_reservations || 0}%`
                  },
                  {
                    label: 'Taux de conversion prestataires',
                    value: `${dashboardState.analytics.conversion?.taux_conversion_prestataire || 0}%`
                  },
                  {
                    label: 'Taux d’avis laissés',
                    value: `${dashboardState.analytics.conversion?.taux_avis_laisses || 0}%`
                  },
                  {
                    label: 'Note moyenne globale',
                    value: `${(dashboardState.analytics.general?.note_moyenne_globale || 0).toFixed(1)} / 5`
                  }
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3 last:border-none">
                    <span className="text-sm text-gray-500 dark:text-gray-400">{item.label}</span>
                    <span className="text-base font-semibold text-gray-900 dark:text-white">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm space-y-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Alertes & suivi</h3>
              <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-900/20">
                <p className="text-sm font-semibold text-orange-700 dark:text-orange-300">
                  {dashboardState.stats.reservations?.en_attente || 0} réservations en attente
                </p>
                <p className="text-xs text-orange-600 dark:text-orange-200">Surveillez les confirmations</p>
              </div>
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20">
                <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                  {dashboardState.pendingTransactions.length} transactions Wave à valider
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-200">Accélérez les activations</p>
              </div>
              <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-900/20">
                <p className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                  {dashboardState.stats.notifications?.non_lues || 0} notifications non lues
                </p>
                <p className="text-xs text-purple-600 dark:text-purple-200">Informez vos utilisateurs</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Réservations récentes</h3>
                <Calendar className="w-5 h-5 text-blue-500" />
              </div>
              {dashboardState.recentReservations.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Aucune réservation récente</p>
              ) : (
                <div className="space-y-4">
                  {dashboardState.recentReservations.map(reservation => (
                    <div key={reservation.id} className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3 last:border-none">
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{reservation.service_nom}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {reservation.client_prenom} {reservation.client_nom} • {formatDate(reservation.date_reservation)}
                        </p>
                      </div>
                      <StatusBadge status={reservation.statut} />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Transactions Wave récentes</h3>
                <CreditCard className="w-5 h-5 text-green-500" />
              </div>
              {dashboardState.pendingTransactions.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Aucune transaction en attente</p>
              ) : (
                <div className="space-y-4">
                  {dashboardState.pendingTransactions.map(transaction => (
                    <div key={transaction.id} className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3 last:border-none">
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{transaction.plan_nom}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {transaction.prestataire_prenom} {transaction.prestataire_nom} • {formatDate(transaction.created_at)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          {transaction.montant.toLocaleString()} {transaction.devise}
                        </p>
                        <p className="text-xs text-orange-500">En attente</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p>Aucune donnée disponible</p>
        </div>
      )}
    </div>
  );

  const renderPlans = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Gestion des Abonnements</h2>
      {loading ? <LoadingSpinner /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plansState.plans.map(plan => (
            <div key={plan.id} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border">
              <h3 className="text-lg font-semibold">{plan.nom}</h3>
              <p className="text-2xl font-bold">{formatCurrency(plan.prix, plan.devise)}</p>
              <ul className="mt-4 space-y-2 text-sm">
                <li>Max services: {plan.max_services || 'Illimité'}</li>
                <li>Max photos par service: {plan.max_photos_per_service || 'Illimité'}</li>
              </ul>
              <StatusBadge status={plan.is_active ? 'active' : 'inactive'} />
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderMaintenance = () => {
    const logEntries = Array.isArray(maintenanceState.logs) ? maintenanceState.logs : [];
    return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Outils de Maintenance</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Actions sensibles pour garder la plateforme stable
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Dernière vérification: {maintenanceState.statusTimestamp ? formatDateTime(maintenanceState.statusTimestamp) : 'Non disponible'}
          </p>
          <p className={`text-xs font-semibold ${maintenanceState.systemStatus === 'operational' ? 'text-green-600' : 'text-red-500'}`}>
            État système: {maintenanceState.systemStatus === 'operational' ? 'Opérationnel' : (maintenanceState.systemStatus || 'Indéterminé')}
          </p>
        </div>
        <button
          onClick={loadMaintenanceStatus}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${maintenanceState.loadingStatus ? 'animate-spin' : ''}`} />
          <span>Actualiser</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs uppercase text-gray-500">Mode maintenance</p>
              <p className={`text-lg font-semibold ${maintenanceState.maintenanceMode ? 'text-red-600' : 'text-green-600'}`}>
                {maintenanceState.maintenanceMode ? 'Activé' : 'Désactivé'}
              </p>
            </div>
            <ShieldIcon className={`w-6 h-6 ${maintenanceState.maintenanceMode ? 'text-red-500' : 'text-green-500'}`} />
          </div>
          <button
            onClick={handleMaintenanceModeToggle}
            disabled={maintenanceState.action === 'mode'}
            className={`w-full px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
              maintenanceState.maintenanceMode
                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200'
                : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200'
            } ${maintenanceState.action === 'mode' ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            {maintenanceState.action === 'mode'
              ? 'Mise à jour...'
              : maintenanceState.maintenanceMode ? 'Désactiver' : 'Activer'}
          </button>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs uppercase text-gray-500">Dernière sauvegarde</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {formatDateTime(maintenanceState.lastBackupAt)}
              </p>
            </div>
            <Download className="w-6 h-6 text-blue-500" />
          </div>
          <button
            onClick={handleCreateBackup}
            disabled={maintenanceState.action === 'backup'}
            className="w-full px-3 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-60"
          >
            {maintenanceState.action === 'backup' ? 'Sauvegarde...' : 'Créer une sauvegarde'}
          </button>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs uppercase text-gray-500">Cache applicatif</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {formatDateTime(maintenanceState.lastCacheClearAt)}
              </p>
            </div>
            <Database className="w-6 h-6 text-purple-500" />
          </div>
          <button
            onClick={handleClearCache}
            disabled={maintenanceState.action === 'cache'}
            className="w-full px-3 py-2 rounded-lg text-sm font-semibold bg-purple-600 text-white hover:bg-purple-700 transition disabled:opacity-60"
          >
            {maintenanceState.action === 'cache' ? 'Nettoyage...' : 'Vider le cache'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Journal applicatif</h3>
            <button
              onClick={handleLoadMaintenanceLogs}
              className="px-3 py-1.5 rounded-lg text-sm bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
            >
              Actualiser
            </button>
          </div>
          {maintenanceState.logsSummary && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {maintenanceState.logsSummary.logs_24h || 0} événements / 24h · Total {maintenanceState.logsSummary.total_logs || 0} lignes
            </p>
          )}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 h-64 overflow-y-auto text-xs font-mono text-gray-700 dark:text-gray-200 whitespace-pre-wrap">
              {maintenanceState.logsLoading ? 'Chargement des logs...' : (
              logEntries.length === 0
                ? 'Aucun journal disponible'
                : (
                  <div className="space-y-3">
                    {logEntries.map(log => (
                      <div key={log.id} className="bg-white dark:bg-gray-900/40 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 mb-1">
                          <span>{formatDateTime(log.created_at)}</span>
                          <span>{log.admin_nom || log.admin_email || `Admin #${log.admin_id}`}</span>
                        </div>
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{log.action}</p>
                        {log.details && (
                          <pre className="mt-2 bg-gray-100 dark:bg-gray-900 rounded-lg p-2 text-[11px] whitespace-pre-wrap text-left">
                            {formatLogDetails(log.details)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                )
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Notes administrateur</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Utilisez ces outils avec précaution. Le mode maintenance désactive les accès utilisateurs,
            les sauvegardes sont stockées localement dans le dossier <code className="font-mono">/backups</code>.
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-300 space-y-1">
            <li>Le vidage de cache supprime les caches temporaires côté serveur.</li>
            <li>Les sauvegardes incluent les paramètres et les statistiques clés.</li>
            <li>Consultez régulièrement les logs pour détecter d’éventuelles erreurs.</li>
          </ul>
        </div>
      </div>
    </div>
  );
  }

  const renderSettings = () => {
    const securityCount = groupedSettings.find(group => group.category === 'security')?.items.length || 0;
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Paramètres de l'application
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Gérez les clés critiques, par catégorie et en toute sécurité
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={loadSettings}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Actualiser</span>
            </button>
            <button
              onClick={resetSettings}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Réinitialiser</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
            <p className="text-xs uppercase text-gray-500">Paramètres</p>
            <p className="text-3xl font-semibold text-gray-900 dark:text-white mt-1">{settingsOverview.total}</p>
            <p className="text-sm text-gray-500">Tous modules confondus</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
            <p className="text-xs uppercase text-gray-500">Catégories</p>
            <p className="text-3xl font-semibold text-gray-900 dark:text-white mt-1">{settingsOverview.categories}</p>
            <p className="text-sm text-gray-500">Regroupements détectés</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
            <p className="text-xs uppercase text-gray-500">Paramètres sensibles</p>
            <p className="text-3xl font-semibold text-gray-900 dark:text-white mt-1">{securityCount}</p>
            <p className="text-sm text-gray-500">Marqués comme sécurité</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <input
              type="text"
              placeholder="Clé du paramètre"
              value={settingsState.newKey}
              onChange={(e) => setSettingsState(prev => ({ ...prev, newKey: e.target.value }))}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Valeur"
              value={settingsState.newValue}
              onChange={(e) => setSettingsState(prev => ({ ...prev, newValue: e.target.value }))}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Description"
              value={settingsState.newDescription}
              onChange={(e) => setSettingsState(prev => ({ ...prev, newDescription: e.target.value }))}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={settingsState.newCategory}
              onChange={(e) => setSettingsState(prev => ({ ...prev, newCategory: e.target.value }))}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="general">Général</option>
              <option value="security">Sécurité</option>
              <option value="payment">Paiement</option>
              <option value="notification">Notification</option>
            </select>
          </div>
          <button
            onClick={addSetting}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter le paramètre</span>
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
          <SearchInput
            value={settingsState.search}
            onChange={(value) => setSettingsState(prev => ({ ...prev, search: value }))}
            placeholder="Rechercher une clé ou une description..."
          />
        </div>

        {loading ? (
          <LoadingSpinner message="Chargement des paramètres..." />
        ) : groupedSettings.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <Settings className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p>Aucun paramètre ne correspond à votre recherche</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedSettings.map((group) => (
              <div key={group.category} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{group.label}</h3>
                    <p className="text-sm text-gray-500">{group.items.length} paramètre(s)</p>
                  </div>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {group.items.map(([key, setting]) => (
                    <div key={key} className="px-6 py-4 flex flex-col space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">{key}</p>
                          {setting.description && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">{setting.description}</p>
                          )}
                        </div>
                        <span className="text-xs uppercase text-gray-400">{group.label}</span>
                      </div>
                      {settingsState.editingKey === key ? (
                        <div className="flex flex-col md:flex-row md:items-center gap-2">
                          <input
                            type="text"
                            value={settingsState.editValue}
                            onChange={(e) => setSettingsState(prev => ({ ...prev, editValue: e.target.value }))}
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                updateSetting(key, settingsState.editValue);
                              }
                            }}
                            autoFocus
                          />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateSetting(key, settingsState.editValue)}
                              className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                              title="Enregistrer"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setSettingsState(prev => ({ ...prev, editingKey: null, editValue: '' }))}
                              className="p-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                              title="Annuler"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg font-mono text-sm">
                            {String(setting.value)}
                          </span>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() =>
                                setSettingsState(prev => ({
                                  ...prev,
                                  editingKey: key,
                                  editValue: String(setting.value)
                                }))
                              }
                              className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                              title="Modifier"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteSetting(key)}
                              className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Logo className="h-12 w-auto hidden sm:block" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  Administration PrestaCI
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Centre de contrôle et de gestion de la plateforme
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-sm">
                <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                <span>Système opérationnel</span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 overflow-x-auto">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
              { id: 'users', label: 'Utilisateurs', icon: Users },
              { id: 'services', label: 'Services', icon: Package },
              { id: 'categories', label: 'Catégories', icon: Grid3X3 },
              { id: 'reservations', label: 'Réservations', icon: Calendar },
              { id: 'avis', label: 'Avis', icon: Star },
              { id: 'payments', label: 'Paiements', icon: CreditCard },
              { id: 'notifications', label: 'Notifications', icon: Bell },
              { id: 'statistics', label: 'Statistiques', icon: TrendingUp },
              { id: 'plans', label: 'Abonnements', icon: Crown },
              { id: 'settings', label: 'Paramètres', icon: Settings },
              { id: 'maintenance', label: 'Maintenance', icon: Wrench },
              { id: 'debug', label: 'Debug', icon: AlertTriangle },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as AdminTab)}
                  className={`flex items-center space-x-2 px-4 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm border border-blue-200 dark:border-blue-800'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Contenu principal */}
        <main>
          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'users' && renderUsers()}
          {activeTab === 'services' && renderServices()}
          {activeTab === 'categories' && renderCategories()}
          {activeTab === 'reservations' && renderReservations()}
          {activeTab === 'avis' && renderAvis()}
          {activeTab === 'payments' && renderPayments()}
          {activeTab === 'notifications' && renderNotifications()}
          {activeTab === 'statistics' && renderStatistics()}
          {activeTab === 'plans' && renderPlans()}
          {activeTab === 'settings' && renderSettings()}
          {activeTab === 'maintenance' && renderMaintenance()}
          {activeTab === 'debug' && <DebugPanel />}
        </main>
      </div>

      {/* Modal de rejet de transaction */}
      {paymentsState.showRejectModal && paymentsState.selectedTransaction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Rejeter la transaction
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Transaction de <span className="font-semibold">{paymentsState.selectedTransaction.prestataire_nom} {paymentsState.selectedTransaction.prestataire_prenom}</span> pour <span className="font-semibold">{formatCurrency(paymentsState.selectedTransaction.montant, paymentsState.selectedTransaction.devise)}</span>
            </p>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Motif du rejet <span className="text-red-500">*</span>
              </label>
              <textarea
                value={paymentsState.rejectReason}
                onChange={(e) => setPaymentsState(prev => ({ ...prev, rejectReason: e.target.value }))}
                placeholder="Expliquez pourquoi cette transaction est rejetée..."
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                rows={4}
                required
              />
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setPaymentsState(prev => ({
                  ...prev,
                  showRejectModal: false,
                  rejectReason: '',
                  selectedTransaction: null
                }))}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  if (paymentsState.rejectReason.trim()) {
                    rejectTransaction(paymentsState.selectedTransaction!.id, paymentsState.rejectReason.trim());
                  }
                }}
                disabled={!paymentsState.rejectReason.trim()}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
              >
                Rejeter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
