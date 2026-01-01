import { Home, Calendar, Camera, Heart, User, Package, CreditCard } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

interface BottomNavigationProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export default function BottomNavigation({ currentTab, setCurrentTab }: BottomNavigationProps) {
  const { role } = useAuthStore();
  
  const clientTabs = [
    { id: 'home', label: 'Accueil', icon: Home },
    { id: 'reservations', label: 'Réservations', icon: Calendar },
    { id: 'publications', label: 'Publications', icon: Camera },
    { id: 'favorites', label: 'Favoris', icon: Heart },
    { id: 'profile', label: 'Profil', icon: User }
  ];

  const prestataireTabs = [
    { id: 'home', label: 'Dashboard', icon: Home },
    { id: 'services', label: 'Services', icon: Package },
    { id: 'reservations', label: 'Réservations', icon: Calendar },
    { id: 'plans', label: 'Abonnement', icon: CreditCard },
    { id: 'profile', label: 'Profil', icon: User }
  ];

  const adminTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'users', label: 'Utilisateurs', icon: User },
    { id: 'services', label: 'Services', icon: Package },
    { id: 'payments', label: 'Paiements', icon: CreditCard },
    { id: 'profile', label: 'Profil', icon: User }
  ];

  let tabs = clientTabs;
  if (role?.nom === 'prestataire') tabs = prestataireTabs;
  if (role?.nom === 'admin') tabs = adminTabs;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border-t border-gray-200/50 dark:border-gray-700/50 px-2 py-2 shadow-lg">
      <div className="max-w-md mx-auto">
        <div className="flex justify-around relative">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id)}
                className={`flex flex-col items-center py-2.5 px-2 sm:px-4 rounded-xl transition-all duration-300 relative z-10 ${
                  isActive 
                    ? 'text-blue-600 dark:text-blue-400' 
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <div className={`relative ${
                  isActive ? 'transform -translate-y-1' : ''
                } transition-transform duration-300`}>
                  <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${isActive ? 'drop-shadow-lg' : ''} transition-all duration-300`} />
                  {isActive && (
                    <div className="absolute -inset-2 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full blur-sm -z-10"></div>
                  )}
                </div>
                <span className={`text-[10px] sm:text-xs mt-1 sm:mt-1.5 font-medium transition-all duration-300 ${
                  isActive ? 'opacity-100' : 'opacity-70'
                }`}>{tab.label}</span>
                {isActive && (
                  <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full"></div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}