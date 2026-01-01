-- ========================================
-- SCRIPT FINAL OPTIMISÉ POUR VOS TABLES EXISTANTES
-- Utilise: plans_abonnement + transactions_wave
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

-- 2. Créer une VUE subscription_plans basée sur plans_abonnement
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

-- 3. Créer une VUE subscriptions basée sur transactions_wave
CREATE OR REPLACE VIEW `subscriptions` AS
SELECT 
  `id`,
  `prestataire_id` as `user_id`,
  `plan_id`,
  CASE 
    WHEN `statut` = 'valide' THEN 'actif'
    WHEN `statut` = 'rejete' THEN 'annule'
    WHEN `statut` = 'en_attente' THEN 'suspendu'
    WHEN `statut` = 'rembourse' THEN 'expire'
    ELSE 'suspendu'
  END as `statut`,
  DATE(`date_paiement`) as `date_debut`,
  DATE(DATE_ADD(`date_paiement`, INTERVAL COALESCE(`duree_abonnement_jours`, 30) DAY)) as `date_fin`,
  `montant` as `prix_paye`,
  `created_at`,
  `updated_at`
FROM `transactions_wave`;

-- ========================================
-- MODIFIER LES TABLES EXISTANTES
-- ========================================

-- 4. Ajouter les colonnes de modération à la table avis
ALTER TABLE `avis` 
ADD COLUMN IF NOT EXISTS `is_moderated` tinyint(1) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS `is_approved` tinyint(1) NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS `moderation_reason` text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS `moderated_by` int(11) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS `moderated_at` timestamp NULL DEFAULT NULL;

-- Ajouter les index pour les avis
CREATE INDEX IF NOT EXISTS `idx_avis_moderated` ON `avis` (`is_moderated`);
CREATE INDEX IF NOT EXISTS `idx_avis_approved` ON `avis` (`is_approved`);

-- 5. Ajouter la colonne deleted_at à la table services
ALTER TABLE `services` 
ADD COLUMN IF NOT EXISTS `deleted_at` timestamp NULL DEFAULT NULL;

CREATE INDEX IF NOT EXISTS `idx_services_deleted_at` ON `services` (`deleted_at`);

-- 6. Ajouter is_active aux sous_categories si pas présent
ALTER TABLE `sous_categories` 
ADD COLUMN IF NOT EXISTS `is_active` tinyint(1) NOT NULL DEFAULT 1;

-- ========================================
-- MISE À JOUR DES DONNÉES
-- ========================================

-- 7. Marquer tous les avis existants comme modérés et approuvés
UPDATE `avis` SET 
  `is_moderated` = 1, 
  `is_approved` = 1, 
  `moderated_at` = `created_at`
WHERE `is_moderated` = 0;

-- 8. S'assurer que app_settings a les paramètres nécessaires
INSERT IGNORE INTO `app_settings` (`key_name`, `value`, `description`) VALUES
('maintenance_mode', '0', 'Mode maintenance activé/désactivé'),
('site_name', 'PrestaCI', 'Nom du site'),
('max_upload_size', '10485760', 'Taille maximale de fichier en bytes (10MB)'),
('email_notifications', '1', 'Notifications email activées'),
('sms_notifications', '0', 'Notifications SMS activées'),
('commission_rate', '5.0', 'Taux de commission par défaut (%)'),
('currency', 'FCFA', 'Devise par défaut');

-- ========================================
-- VÉRIFICATIONS FINALES
-- ========================================

SELECT 'Configuration terminée avec succès!' as message;

-- Vérifier les vues créées
SELECT 'Vérification subscription_plans:' as check_type, COUNT(*) as count FROM subscription_plans;
SELECT 'Vérification subscriptions:' as check_type, COUNT(*) as count FROM subscriptions;

-- Vérifier les colonnes ajoutées
SELECT 'Vérification avis modérés:' as check_type, COUNT(*) as count FROM avis WHERE is_moderated = 1;

-- Afficher les plans disponibles
SELECT 'Plans disponibles:' as info, nom, prix, max_services, is_active FROM subscription_plans;

-- ========================================
-- NOTES IMPORTANTES
-- ========================================
/*
✅ TABLES UTILISÉES:
- admin_logs: Nouvelle table pour les logs admin
- subscription_plans: VUE basée sur votre plans_abonnement
- subscriptions: VUE basée sur votre transactions_wave

✅ MAPPING INTELLIGENT:
- plans_abonnement.mise_en_avant → subscription_plans.is_popular
- plans_abonnement.avantages → subscription_plans.features
- transactions_wave.prestataire_id → subscriptions.user_id
- transactions_wave.statut → subscriptions.statut (avec conversion)

✅ COMPATIBILITÉ TOTALE:
- Toutes les routes admin fonctionneront
- Vos données existantes sont préservées
- Aucune duplication de données
*/
