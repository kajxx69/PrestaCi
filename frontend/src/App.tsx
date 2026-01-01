import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useAppStore } from './store/appStore';
import Layout from './components/Layout';
import LoginForm from './components/auth/LoginForm';
import RegisterForm from './components/auth/RegisterForm';
import BottomNavigation from './components/BottomNavigation';
import { api } from './lib/api';
import ProviderDashboard from './components/provider/ProviderDashboard';
import AdminPanel from './components/admin/AdminPanel';
import AdminProfile from './components/admin/AdminProfile';
import ToastContainer from './components/ToastContainer';
import { notificationService } from './services/notifications';

// Client components
import HomeTab from './components/client/HomeTab';
import ReservationsTab from './components/client/ReservationsTab';
import PublicationsTab from './components/client/PublicationsTab';
import FavoritesTab from './components/client/FavoritesTab';
import ProfileTab from './components/client/ProfileTab';

// Page Details
import PrestataireDetailPage from './pages/PrestataireDetailPage';
import ServiceDetailPage from './pages/ServiceDetailPage';

// Prestataire components 
import DashboardTab from './components/prestataire/DashboardTab';
import ServicesTab from './components/prestataire/ServicesTab';
import ReservationsTabP from './components/prestataire/ReservationsTab';
import PlansTab from './components/prestataire/PlansTab';
import ProfileTabP from './components/prestataire/ProfileTab';

function App() {
  const { isAuthenticated, role } = useAuthStore();
  useAppStore();
  // authMode no longer needed since forms navigate via router
  const [currentTab, setCurrentTab] = useState(() => {
    const saved = localStorage.getItem('prestaci-current-tab');
    return saved || 'home';
  });

  // Initialize auth from backend session
  const [authReady, setAuthReady] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        // Vérifier d'abord si on a un token local avant de faire l'appel API
        const auth = JSON.parse(localStorage.getItem('prestaci-auth') || '{}');
        if (!auth.token) {
          // Pas de token local, pas besoin de vérifier avec le serveur
          useAuthStore.setState({ user: null, role: null, isAuthenticated: false });
          setAuthReady(true);
          return;
        }

        const { user } = await api.auth.me();
        let role = null as null | { id: number; nom: string; description: string; created_at: string };
        if (user?.role_id) {
          const roleName = user.role_nom || (user.role_id === 1 ? 'client' : user.role_id === 2 ? 'prestataire' : user.role_id === 3 ? 'admin' : '');
          role = { id: user.role_id, nom: roleName, description: '', created_at: '' };
        }
        useAuthStore.setState({ user, role, isAuthenticated: true });
        
        // Initialiser les notifications si l'utilisateur est connecté
        if (user) {
          await notificationService.initialize();
        }
      } catch (error) {
        // En cas d'erreur (token expiré, etc.), nettoyer l'état local
        localStorage.removeItem('prestaci-auth');
        useAuthStore.setState({ user: null, role: null, isAuthenticated: false });
      } finally {
        setAuthReady(true);
      }
    })();

    // Initialize dark mode from localStorage
    const savedDarkMode = localStorage.getItem('prestaci-dark-mode');
    if (savedDarkMode) {
      const darkMode = JSON.parse(savedDarkMode);
      useAppStore.setState({ isDarkMode: darkMode });
      document.documentElement.classList.toggle('dark', darkMode);
    }

    // Enregistrer le Service Worker seulement en production
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      navigator.serviceWorker.register('/sw.js')
        .catch(error => console.log('Service Worker registration failed:', error));
    }
  }, []);

  // Persist currentTab
  useEffect(() => {
    try {
      localStorage.setItem('prestaci-current-tab', currentTab);
    } catch {}
  }, [currentTab]);

  // Function to render current tab content based on role
  const renderCurrentTab = () => {
    // If role not yet resolved, default to client view so UI remains responsive
    if (!role) {
      switch (currentTab) {
        case 'home':
          return <HomeTab onSelectService={() => {}} onSelectProvider={() => {}} />;
        case 'reservations':
          return <ReservationsTab />;
        case 'publications':
          return <PublicationsTab />;
        case 'favorites':
          return <FavoritesTab />;
        case 'profile':
          return <ProfileTab />;
        default:
          return <HomeTab onSelectService={() => {}} onSelectProvider={() => {}} />;
      }
    }

    // Client tabs
    if (role.nom === 'client') {
      switch (currentTab) {
        case 'home':
          return <HomeTab onSelectService={() => {}} onSelectProvider={() => {}} />;
        case 'reservations':
          return <ReservationsTab />;
        case 'publications':
          return <PublicationsTab />;
        case 'favorites':
          return <FavoritesTab />;
        case 'profile':
          return <ProfileTab />;
        default:
          return <HomeTab onSelectService={() => {}} onSelectProvider={() => {}} />;
      }
    }

    // Prestataire tabs
    if (role.nom === 'prestataire') {
      switch (currentTab) {
        case 'home':
          return <DashboardTab onNavigateToTab={setCurrentTab} />;
        case 'reservations':
          return <ReservationsTabP />;
        case 'services':
          return <ServicesTab onNavigateToTab={setCurrentTab} />;
        case 'plans':
          return <PlansTab />;
        case 'profile':
          return <ProfileTabP />;
        default:
          return <DashboardTab onNavigateToTab={setCurrentTab} />;
      }
    }

    // Admin tabs
    if (role.nom === 'admin') {
      switch (currentTab) {
        case 'dashboard':
        case 'users':
        case 'categories':
        case 'payments':
        case 'settings':
          return <AdminPanel />;
        case 'profile':
          return <AdminProfile />;
        default:
          return <AdminPanel />;
      }
    }

    return null;
  };

  return (
    !authReady ? (
      <Layout showBottomNav={false}>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-gray-500">Chargement...</div>
        </div>
      </Layout>
    ) : (
    <>
    <Routes>
      {/* Root redirect */}
      <Route
        path="/"
        element={<Navigate to={isAuthenticated ? '/app' : '/login'} replace />}
      />
      {/* Public routes when not authenticated */}
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            <Navigate to="/app" replace />
          ) : (
            <Layout showBottomNav={false}>
              <div className="min-h-screen flex items-center justify-center px-4 py-8">
                <LoginForm />
              </div>
            </Layout>
          )
        }
      />
      <Route
        path="/register"
        element={
          isAuthenticated ? (
            <Navigate to="/app" replace />
          ) : (
            <Layout showBottomNav={false}>
              <div className="min-h-screen flex items-center justify-center px-4 py-8">
                <RegisterForm />
              </div>
            </Layout>
          )
        }
      />

      {/* Protected app route */}
      <Route
        path="/app"
        element={
          !isAuthenticated ? (
            <Navigate to="/login" replace />
          ) : (
            <Layout>
              {renderCurrentTab()}
              <BottomNavigation currentTab={currentTab} setCurrentTab={setCurrentTab} />
            </Layout>
          )
        }
      />

      {/* Provider dashboard (prestataire only) */}
      <Route
        path="/pro"
        element={
          !isAuthenticated ? (
            <Navigate to="/login" replace />
          ) : role?.id !== 2 ? (
            <Navigate to="/app" replace />
          ) : (
            <Layout>
              <ProviderDashboard />
            </Layout>
          )
        }
      />

      {/* Default redirect */}
      {/* Detail Pages */}
      <Route path="/prestataires/:id" element={!isAuthenticated ? <Navigate to="/login" replace /> : <PrestataireDetailPage />} />
      <Route path="/services/:id" element={!isAuthenticated ? <Navigate to="/login" replace /> : <ServiceDetailPage />} />

      {/* Default redirect */}
      <Route
        path="*"
        element={<Navigate to={isAuthenticated ? '/app' : '/login'} replace />}
      />
    </Routes>
    <ToastContainer />
    </>
    )
  );
}

export default App;
