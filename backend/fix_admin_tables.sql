-- ========================================
-- SCRIPT POUR CORRIGER LES ERREURS 500 ADMIN
-- Basé sur votre structure de base existante
-- ========================================

-- 1. Créer la table admin_logs (MANQUANTE)
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

-- 2. Créer la table subscription_plans (MANQUANTE)
-- Note: Vous avez déjà "plans_abonnement", on crée "subscription_plans" pour compatibilité
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

-- 3. Créer la table subscriptions (MANQUANTE)
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

-- ========================================
-- MODIFIER LES TABLES EXISTANTES
-- ========================================

-- 4. Ajouter les colonnes de modération à la table avis
ALTER TABLE `avis` 
ADD COLUMN `is_moderated` tinyint(1) NOT NULL DEFAULT 0,
ADD COLUMN `is_approved` tinyint(1) NOT NULL DEFAULT 1,
ADD COLUMN `moderation_reason` text DEFAULT NULL,
ADD COLUMN `moderated_by` int(11) DEFAULT NULL,
ADD COLUMN `moderated_at` timestamp NULL DEFAULT NULL,
ADD INDEX `idx_avis_moderated` (`is_moderated`),
ADD INDEX `idx_avis_approved` (`is_approved`);

-- 5. Ajouter la colonne deleted_at à la table services
ALTER TABLE `services` 
ADD COLUMN `deleted_at` timestamp NULL DEFAULT NULL,
ADD INDEX `idx_services_deleted_at` (`deleted_at`);

-- 6. Ajouter is_active aux sous_categories si pas présent
ALTER TABLE `sous_categories` 
ADD COLUMN `is_active` tinyint(1) NOT NULL DEFAULT 1;

-- ========================================
-- DONNÉES PAR DÉFAUT
-- ========================================

-- 7. Insérer des plans par défaut
INSERT IGNORE INTO `subscription_plans` (`nom`, `description`, `prix`, `max_services`, `features`) VALUES
('Gratuit', 'Plan gratuit avec fonctionnalités de base', 0.00, 1, '["1 service", "5 photos par service", "Support communautaire"]'),
('Pro', 'Plan professionnel pour prestataires actifs', 29.99, 10, '["10 services", "20 photos par service", "Support prioritaire", "Statistiques avancées"]'),
('Premium', 'Plan premium pour grandes entreprises', 99.99, 50, '["50 services", "Illimité photos", "Support dédié", "API access", "Rapports personnalisés"]');

-- 8. Ajouter des paramètres manquants à app_settings
INSERT IGNORE INTO `app_settings` (`key_name`, `value`, `description`) VALUES
('maintenance_mode', '0', 'Mode maintenance activé/désactivé'),
('site_name', 'PrestaCI', 'Nom du site'),
('max_upload_size', '10485760', 'Taille maximale de fichier en bytes (10MB)'),
('email_notifications', '1', 'Notifications email activées'),
('sms_notifications', '0', 'Notifications SMS activées');

-- ========================================
-- MISE À JOUR DES AVIS EXISTANTS
-- ========================================

-- 9. Marquer tous les avis existants comme modérés et approuvés
UPDATE `avis` SET 
  `is_moderated` = 1, 
  `is_approved` = 1, 
  `moderated_at` = `created_at`
WHERE `is_moderated` = 0;

-- ========================================
-- VÉRIFICATIONS FINALES
-- ========================================

-- Vérifier que tout est créé (décommentez pour tester)
-- SELECT 'admin_logs créé' as verification;
-- SELECT COUNT(*) as nb_plans FROM subscription_plans;
-- SELECT COUNT(*) as nb_avis_moderes FROM avis WHERE is_moderated = 1;
-- SHOW COLUMNS FROM services LIKE 'deleted_at';

SELECT 'Script exécuté avec succès ! Redémarrez votre serveur backend.' as message;
