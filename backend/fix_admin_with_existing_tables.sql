-- ========================================
-- SCRIPT OPTIMISÉ POUR VOS TABLES EXISTANTES
-- Utilise plans_abonnement au lieu de subscription_plans
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

-- 2. Créer une VUE pour compatibilité avec subscription_plans
-- Cela permet aux routes admin de fonctionner sans modification
CREATE OR REPLACE VIEW `subscription_plans` AS
SELECT 
  `id`,
  `nom`,
  `description`,
  `prix`,
  1 as `duree_mois`,
  `max_services`,
  5 as `max_photos_par_service`,
  0.00 as `commission_percentage`,
  `avantages` as `features`,
  `is_active`,
  `mise_en_avant` as `is_popular`,
  `created_at`,
  `updated_at`
FROM `plans_abonnement`;

-- 3. Créer une table subscriptions simple (pour les abonnements utilisateurs)
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
  FOREIGN KEY (`plan_id`) REFERENCES `plans_abonnement`(`id`) ON DELETE RESTRICT
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
ADD COLUMN `moderated_at` timestamp NULL DEFAULT NULL;

-- Ajouter les index
ALTER TABLE `avis` 
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
-- MISE À JOUR DES DONNÉES
-- ========================================

-- 7. Marquer tous les avis existants comme modérés et approuvés
UPDATE `avis` SET 
  `is_moderated` = 1, 
  `is_approved` = 1, 
  `moderated_at` = `created_at`
WHERE `is_moderated` = 0;

-- 8. Créer quelques abonnements de test (optionnel)
INSERT IGNORE INTO `subscriptions` (`user_id`, `plan_id`, `date_debut`, `date_fin`, `prix_paye`) 
SELECT 
  u.id,
  1, -- Plan Basique
  CURDATE(),
  DATE_ADD(CURDATE(), INTERVAL 1 MONTH),
  0.00
FROM `users` u 
WHERE u.role_id = 2 -- Prestataires
AND NOT EXISTS (SELECT 1 FROM `subscriptions` s WHERE s.user_id = u.id)
LIMIT 5;

-- ========================================
-- VÉRIFICATIONS
-- ========================================

SELECT 'Tables créées avec succès!' as message;
SELECT COUNT(*) as nb_admin_logs FROM admin_logs;
SELECT COUNT(*) as nb_plans FROM subscription_plans;
SELECT COUNT(*) as nb_subscriptions FROM subscriptions;
SELECT COUNT(*) as nb_avis_moderes FROM avis WHERE is_moderated = 1;
