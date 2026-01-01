import React from 'react';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import Header from './Header';

interface LayoutProps {
  children: React.ReactNode;
  showBottomNav?: boolean;
}

export default function Layout({ children, showBottomNav = true }: LayoutProps) {
  const { isDarkMode } = useAppStore();
  const { isAuthenticated } = useAuthStore();

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark' : ''}`}>
      <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white transition-colors duration-200">
        <Header />
        
        <main className={`${showBottomNav && isAuthenticated ? 'pb-20' : ''}`}>
          {children}
        </main>
        
      </div>
    </div>
  );
}