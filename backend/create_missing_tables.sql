-- Tables manquantes pour le système d'administration

-- Table des logs d'administration
CREATE TABLE IF NOT EXISTS admin_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  admin_id INT NOT NULL,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  target_id INT NOT NULL,
  details JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_admin_logs_admin_id (admin_id),
  INDEX idx_admin_logs_created_at (created_at),
  INDEX idx_admin_logs_action (action)
);

-- Table des plans d'abonnement
CREATE TABLE IF NOT EXISTS subscription_plans (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nom VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  prix DECIMAL(10,2) NOT NULL DEFAULT 0,
  duree_mois INT NOT NULL DEFAULT 1,
  max_services INT NOT NULL DEFAULT 1,
  max_photos_par_service INT NOT NULL DEFAULT 5,
  commission_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
  features JSON,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_popular BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Table des abonnements utilisateurs
CREATE TABLE IF NOT EXISTS subscriptions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  plan_id INT NOT NULL,
  statut ENUM('actif', 'suspendu', 'expire', 'annule') NOT NULL DEFAULT 'actif',
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  prix_paye DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_id) REFERENCES subscription_plans(id) ON DELETE RESTRICT,
  INDEX idx_subscriptions_user_id (user_id),
  INDEX idx_subscriptions_plan_id (plan_id),
  INDEX idx_subscriptions_statut (statut)
);

-- Table des paramètres d'application (si elle n'existe pas)
CREATE TABLE IF NOT EXISTS app_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  key_name VARCHAR(100) NOT NULL UNIQUE,
  value TEXT,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Ajouter des colonnes manquantes si nécessaire
ALTER TABLE avis 
ADD COLUMN IF NOT EXISTS is_moderated BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS moderation_reason TEXT,
ADD COLUMN IF NOT EXISTS moderated_by INT,
ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMP NULL,
ADD INDEX IF NOT EXISTS idx_avis_moderated (is_moderated),
ADD INDEX IF NOT EXISTS idx_avis_approved (is_approved);

-- Ajouter une colonne deleted_at aux services pour soft delete
ALTER TABLE services 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL,
ADD INDEX IF NOT EXISTS idx_services_deleted_at (deleted_at);

-- Ajouter des colonnes aux catégories si nécessaire
ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS icone VARCHAR(50) DEFAULT 'folder',
ADD COLUMN IF NOT EXISTS couleur VARCHAR(7) DEFAULT '#3B82F6',
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE sous_categories 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Insérer quelques plans par défaut
INSERT IGNORE INTO subscription_plans (nom, description, prix, max_services, features) VALUES
('Gratuit', 'Plan gratuit avec fonctionnalités de base', 0, 1, '["1 service", "5 photos par service", "Support communautaire"]'),
('Pro', 'Plan professionnel pour prestataires actifs', 29.99, 10, '["10 services", "20 photos par service", "Support prioritaire", "Statistiques avancées"]'),
('Premium', 'Plan premium pour grandes entreprises', 99.99, 50, '["50 services", "Illimité photos", "Support dédié", "API access", "Rapports personnalisés"]');

-- Insérer quelques paramètres par défaut
INSERT IGNORE INTO app_settings (key_name, value, description) VALUES
('maintenance_mode', '0', 'Mode maintenance activé/désactivé'),
('site_name', 'PrestaCI', 'Nom du site'),
('max_upload_size', '10485760', 'Taille maximale de fichier en bytes (10MB)'),
('email_notifications', '1', 'Notifications email activées'),
('sms_notifications', '0', 'Notifications SMS activées');
