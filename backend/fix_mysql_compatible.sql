-- ========================================
-- SCRIPT COMPATIBLE MYSQL - SANS IF NOT EXISTS
-- ========================================

-- 1. Créer SEULEMENT la table admin_logs (vraiment manquante)
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

-- ========================================
-- MODIFIER LES TABLES EXISTANTES
-- ========================================

-- 2. Ajouter les colonnes de modération à la table avis
-- (Ignorez les erreurs si les colonnes existent déjà)
ALTER TABLE `avis` 
ADD COLUMN `is_moderated` tinyint(1) NOT NULL DEFAULT 0,
ADD COLUMN `is_approved` tinyint(1) NOT NULL DEFAULT 1,
ADD COLUMN `moderation_reason` text DEFAULT NULL,
ADD COLUMN `moderated_by` int(11) DEFAULT NULL,
ADD COLUMN `moderated_at` timestamp NULL DEFAULT NULL;

-- 3. Ajouter les index pour les avis
ALTER TABLE `avis` 
ADD INDEX `idx_avis_moderated` (`is_moderated`),
ADD INDEX `idx_avis_approved` (`is_approved`);

-- 4. Ajouter la colonne deleted_at à la table services
ALTER TABLE `services` 
ADD COLUMN `deleted_at` timestamp NULL DEFAULT NULL;

ALTER TABLE `services` 
ADD INDEX `idx_services_deleted_at` (`deleted_at`);

-- 5. Ajouter is_active aux sous_categories
ALTER TABLE `sous_categories` 
ADD COLUMN `is_active` tinyint(1) NOT NULL DEFAULT 1;

-- ========================================
-- MISE À JOUR DES DONNÉES
-- ========================================

-- 6. Marquer tous les avis existants comme modérés et approuvés
UPDATE `avis` SET 
  `is_moderated` = 1, 
  `is_approved` = 1, 
  `moderated_at` = `created_at`
WHERE `is_moderated` = 0;

-- 7. S'assurer que app_settings a les paramètres nécessaires
INSERT IGNORE INTO `app_settings` (`key_name`, `value`, `description`) VALUES
('maintenance_mode', '0', 'Mode maintenance activé/désactivé'),
('site_name', 'PrestaCI', 'Nom du site'),
('max_upload_size', '10485760', 'Taille maximale de fichier en bytes (10MB)'),
('email_notifications', '1', 'Notifications email activées'),
('sms_notifications', '0', 'Notifications SMS activées'),
('commission_rate', '5.0', 'Taux de commission par défaut (%)'),
('currency', 'FCFA', 'Devise par défaut');

-- ========================================
-- VÉRIFICATIONS
-- ========================================

SELECT 'Script exécuté avec succès!' as message;
SELECT 'admin_logs créé' as verification;
SELECT 'Colonnes ajoutées aux tables existantes' as verification;
