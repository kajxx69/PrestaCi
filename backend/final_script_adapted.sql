-- ========================================
-- SCRIPT FINAL ADAPTÉ À VOTRE STRUCTURE
-- ========================================

-- 1. Marquer tous les avis existants comme modérés
UPDATE `avis` SET 
  `is_moderated` = 1, 
  `is_approved` = 1, 
  `moderated_at` = `created_at`
WHERE `is_moderated` = 0;

-- 2. Ajouter paramètres app_settings (avec votre colonne 'cle')
INSERT IGNORE INTO `app_settings` (`cle`, `valeur`, `type`, `description`) VALUES
('maintenance_mode', '0', 'boolean', 'Mode maintenance activé/désactivé'),
('site_name', 'PrestaCI', 'string', 'Nom du site'),
('commission_rate', '5.0', 'float', 'Taux de commission par défaut (%)'),
('currency', 'FCFA', 'string', 'Devise par défaut'),
('max_upload_size', '10485760', 'integer', 'Taille maximale de fichier en bytes (10MB)'),
('email_notifications', '1', 'boolean', 'Notifications email activées'),
('sms_notifications', '0', 'boolean', 'Notifications SMS activées');

-- 3. Vérification finale
SELECT 'Configuration terminée avec succès!' as message;
SELECT COUNT(*) as nb_avis_moderes FROM avis WHERE is_moderated = 1;
SELECT COUNT(*) as nb_parametres FROM app_settings;
