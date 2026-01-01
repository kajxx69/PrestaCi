import dotenv from 'dotenv';
dotenv.config(); // ⚠️ doit être le tout premier import
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import coreRoutes from './routes/core.js';
import authRoutes from './routes/auth.js';
import prestatairesRoutes from './routes/prestataires.js';
import servicesRoutes from './routes/services.js';
import subscriptionRoutes from './routes/subscription.js';
import reservationsRoutes from './routes/reservations.js';
import publicationsRoutes from './routes/publications.js';
import favoritesRoutes from './routes/favorites.js';
import usersRoutes from './routes/users.js';
import dashboardRoutes from './routes/dashboard.js';
import prestataireReservationsRoutes from './routes/prestataire-reservations.js';
import pushTokensRoutes from './routes/push-tokens.js';
import notificationsRoutes from './routes/notifications.js';
import adminRoutes from './routes/admin.js';
import avisRoutes from './routes/avis.js';
import notificationPreferencesRoutes from './routes/notification-preferences.js';
import waveTransactionsRoutes from './routes/wave-transactions.js';
import adminWaveTransactionsRoutes from './routes/admin-wave-transactions.js';
import adminUsersRoutes from './routes/admin-users.js';
import adminServicesRoutes from './routes/admin-services.js';
import adminCategoriesRoutes from './routes/admin-categories.js';
import adminReservationsRoutes from './routes/admin-reservations.js';
import adminAvisRoutes from './routes/admin-avis.js';
import adminNotificationsRoutes from './routes/admin-notifications.js';
import adminStatisticsRoutes from './routes/admin-statistics.js';
import adminPlansRoutes from './routes/admin-plans.js';
import adminMaintenanceRoutes from './routes/admin-maintenance.js';
import { ping } from './db.js';
const app = express();
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const corsOptions = {
    origin: FRONTEND_ORIGIN,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
// Request logging middleware
app.use((req, _res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});
// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());
// 🔹 Routes
app.use('/api', coreRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/prestataires', prestatairesRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/reservations', reservationsRoutes);
app.use('/api/publications', publicationsRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/prestataire/reservations', prestataireReservationsRoutes);
app.use('/api/push-tokens', pushTokensRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/avis', avisRoutes);
app.use('/api/notification-preferences', notificationPreferencesRoutes);
app.use('/api/wave-transactions', waveTransactionsRoutes);
app.use('/api/admin/wave-transactions', adminWaveTransactionsRoutes);
app.use('/api/admin/users', adminUsersRoutes);
app.use('/api/admin/services', adminServicesRoutes);
app.use('/api/admin/categories', adminCategoriesRoutes);
app.use('/api/admin/reservations', adminReservationsRoutes);
app.use('/api/admin/avis', adminAvisRoutes);
app.use('/api/admin/notifications', adminNotificationsRoutes);
app.use('/api/admin/statistics', adminStatisticsRoutes);
app.use('/api/admin/plans', adminPlansRoutes);
app.use('/api/admin/maintenance', adminMaintenanceRoutes);
// Root endpoint with API info
app.get('/', (_req, res) => res.json({
    name: 'PrestaCI Backend',
    version: '0.1.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
        health: '/api/health',
        auth: '/api/auth',
        categories: '/api/categories',
        prestataires: '/api/prestataires',
        services: '/api/services',
        reservations: '/api/reservations',
        publications: '/api/publications',
        favorites: '/api/favorites',
        users: '/api/users',
        subscription: '/api/subscription'
    }
}));
// 404 handler for undefined routes
app.use('*', (_req, res) => {
    res.status(404).json({ error: 'Route non trouvée' });
});
// Global error handling middleware (must be last)
app.use((err, req, res, next) => {
    console.error('Global error handler:', err);
    if (res.headersSent) {
        return next(err);
    }
    res.status(500).json({
        error: process.env.NODE_ENV === 'production' ? 'Erreur interne du serveur' : err.message
    });
});
const port = Number(process.env.PORT || 4000);
(async () => {
    try {
        await ping();
        console.log('✅ Connected to MySQL database!');
        app.listen(port, () => console.log(`🚀 Server running on http://localhost:${port}`));
    }
    catch (err) {
        console.error('❌ Database connection failed:', err.message);
        process.exit(1);
    }
})();
