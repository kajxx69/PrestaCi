import { useState, useEffect, useRef } from 'react';
import { Bell, Moon, Sun } from 'lucide-react';
import NotificationCenter from './NotificationCenter';
import { useAppStore } from '../store/appStore';
import { useAuthStore } from '../store/authStore';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import Logo from './Logo';

export default function Header() {
  const { isDarkMode, toggleDarkMode } = useAppStore();
  const { user, role, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const handleOpenNotifications = () => {
    setShowNotifications((prev) => !prev);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };

    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }

    const fetchUnread = async () => {
      try {
        const { count } = await api.notifications.getUnreadCount();
        setUnreadCount(count);
      } catch (error) {
        console.error('Erreur récupération compteur notifications:', error);
      }
    };

    fetchUnread();
  }, [isAuthenticated]);

  if (!isAuthenticated) return null;

  return (
    <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border-b border-gray-200/50 dark:border-gray-700/50 px-3 py-2.5 shadow-sm">
      <div className="flex items-center justify-between max-w-md mx-auto">
        <div className="flex items-center">
          <button
            onClick={() => navigate('/app')}
            className="flex items-center space-x-2"
          >
            <Logo className="h-10 w-auto" />
          </button>
        </div>

        <div className="flex items-center space-x-1.5 sm:space-x-3">
          {role?.id === 2 && (
            location.pathname.startsWith('/pro') ? (
              <button
                onClick={() => navigate('/app')}
                className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200 hover:shadow-md"
              >
                Accueil
              </button>
            ) : (
              <button
                onClick={() => navigate('/pro')}
                className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 transition-all duration-200 hover:shadow-lg hover:scale-105"
              >
                Pro
              </button>
            )
          )}
          <div className="relative" ref={notifRef}>
            <button 
              onClick={handleOpenNotifications}
              className="relative p-1.5 sm:p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 hover:scale-110"
            >
              <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 dark:text-gray-400" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 bg-gradient-to-r from-red-500 to-pink-500 text-white text-[10px] sm:text-xs rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center shadow-lg animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>
            
            {showNotifications && (
              <div className="fixed inset-x-4 top-16 sm:absolute sm:right-0 sm:left-auto sm:inset-x-auto sm:mt-2 w-auto sm:w-[22rem] z-50">
                <NotificationCenter 
                  onClose={() => setShowNotifications(false)} 
                  onUnreadCountChange={setUnreadCount}
                />
              </div>
            )}
          </div>

          <button 
            onClick={toggleDarkMode}
            className="p-1.5 sm:p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 hover:scale-110"
          >
            {isDarkMode ? (
              <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500 dark:text-yellow-400" />
            ) : (
              <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 dark:text-gray-400" />
            )}
          </button>

          <button 
            onClick={() => {
              if (location.pathname.startsWith('/pro')) {
                navigate('/pro/profile');
              } else {
                navigate('/app/profile');
              }
            }}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all duration-200 hover:scale-110 shadow-md flex-shrink-0"
          >
            {user?.photo_profil ? (
              <img 
                src={user.photo_profil} 
                alt={`${user.prenom} ${user.nom}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold">
                {user?.prenom?.[0]}{user?.nom?.[0]}
              </div>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
