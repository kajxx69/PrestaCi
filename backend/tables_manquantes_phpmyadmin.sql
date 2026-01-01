-- ========================================
-- TABLES MANQUANTES POUR LE SYSTÈME ADMIN
-- À exécuter dans phpMyAdmin
-- ========================================

-- 1. Table des logs d'administration
CREATE TABLE IF NOT EXISTS `admin_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `admin_id` int(11) NOT NULL,
  `action` varchar(100) NOT NULL,
  `target_type` varchar(50) NOT NULL,
  `target_id` int(11) NOT NULL,
  `details` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_admin_logs_admin_id` (`admin_id`),
  KEY `idx_admin_logs_created_at` (`created_at`),
  KEY `idx_admin_logs_action` (`action`),
  FOREIGN KEY (`admin_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Table des plans d'abonnement
CREATE TABLE IF NOT EXISTS `subscription_plans` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nom` varchar(100) NOT NULL,
  `description` text,
  `prix` decimal(10,2) NOT NULL DEFAULT 0.00,
  `duree_mois` int(11) NOT NULL DEFAULT 1,
  `max_services` int(11) NOT NULL DEFAULT 1,
  `max_photos_par_service` int(11) NOT NULL DEFAULT 5,
  `commission_percentage` decimal(5,2) NOT NULL DEFAULT 0.00,
  `features` json DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_popular` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nom` (`nom`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Table des abonnements utilisateurs
CREATE TABLE IF NOT EXISTS `subscriptions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `plan_id` int(11) NOT NULL,
  `statut` enum('actif','suspendu','expire','annule') NOT NULL DEFAULT 'actif',
  `date_debut` date NOT NULL,
  `date_fin` date NOT NULL,
  `prix_paye` decimal(10,2) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_subscriptions_user_id` (`user_id`),
  KEY `idx_subscriptions_plan_id` (`plan_id`),
  KEY `idx_subscriptions_statut` (`statut`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`plan_id`) REFERENCES `subscription_plans`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Table des paramètres d'application
CREATE TABLE IF NOT EXISTS `app_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `key_name` varchar(100) NOT NULL,
  `value` text,
  `description` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `key_name` (`key_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========================================
-- MODIFICATION DES TABLES EXISTANTES
-- ========================================

-- Ajouter des colonnes manquantes à la table avis
ALTER TABLE `avis` 
ADD COLUMN IF NOT EXISTS `is_moderated` tinyint(1) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS `is_approved` tinyint(1) NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS `moderation_reason` text,
ADD COLUMN IF NOT EXISTS `moderated_by` int(11) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS `moderated_at` timestamp NULL DEFAULT NULL;

-- Ajouter des index pour les avis
ALTER TABLE `avis` 
ADD INDEX IF NOT EXISTS `idx_avis_moderated` (`is_moderated`),
ADD INDEX IF NOT EXISTS `idx_avis_approved` (`is_approved`);

-- Ajouter une colonne deleted_at aux services pour soft delete
ALTER TABLE `services` 
ADD COLUMN IF NOT EXISTS `deleted_at` timestamp NULL DEFAULT NULL,
ADD INDEX IF NOT EXISTS `idx_services_deleted_at` (`deleted_at`);

-- Ajouter des colonnes aux catégories
ALTER TABLE `categories` 
ADD COLUMN IF NOT EXISTS `icone` varchar(50) DEFAULT 'folder',
ADD COLUMN IF NOT EXISTS `couleur` varchar(7) DEFAULT '#3B82F6',
ADD COLUMN IF NOT EXISTS `is_active` tinyint(1) NOT NULL DEFAULT 1;

-- Ajouter une colonne aux sous-catégories
ALTER TABLE `sous_categories` 
ADD COLUMN IF NOT EXISTS `is_active` tinyint(1) NOT NULL DEFAULT 1;

-- ========================================
-- DONNÉES PAR DÉFAUT
-- ========================================

-- Insérer quelques plans par défaut
INSERT IGNORE INTO `subscription_plans` (`nom`, `description`, `prix`, `max_services`, `features`) VALUES
('Gratuit', 'Plan gratuit avec fonctionnalités de base', 0.00, 1, '["1 service", "5 photos par service", "Support communautaire"]'),
('Pro', 'Plan professionnel pour prestataires actifs', 29.99, 10, '["10 services", "20 photos par service", "Support prioritaire", "Statistiques avancées"]'),
('Premium', 'Plan premium pour grandes entreprises', 99.99, 50, '["50 services", "Illimité photos", "Support dédié", "API access", "Rapports personnalisés"]');

-- Insérer quelques paramètres par défaut
INSERT IGNORE INTO `app_settings` (`key_name`, `value`, `description`) VALUES
('maintenance_mode', '0', 'Mode maintenance activé/désactivé'),
('site_name', 'PrestaCI', 'Nom du site'),
('max_upload_size', '10485760', 'Taille maximale de fichier en bytes (10MB)'),
('email_notifications', '1', 'Notifications email activées'),
('sms_notifications', '0', 'Notifications SMS activées');

-- ========================================
-- VÉRIFICATION
-- ========================================
-- Vous pouvez exécuter ces requêtes pour vérifier que tout est créé :
-- SHOW TABLES;
-- DESCRIBE admin_logs;
-- DESCRIBE subscription_plans;
-- DESCRIBE subscriptions;
-- DESCRIBE app_settings;
