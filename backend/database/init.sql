-- PrestaCI Database Schema
-- Base de données pour l'application de prestations de services

CREATE DATABASE IF NOT EXISTS prestations_pwa CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE prestations_pwa;

-- Table des rôles utilisateurs
CREATE TABLE IF NOT EXISTS roles (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nom VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertion des rôles par défaut
INSERT IGNORE INTO roles (id, nom, description) VALUES 
(1, 'client', 'Utilisateur client'),
(2, 'prestataire', 'Prestataire de services'),
(3, 'admin', 'Administrateur');

-- Table des utilisateurs
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role_id INT NOT NULL DEFAULT 1,
  nom VARCHAR(100) NOT NULL,
  prenom VARCHAR(100) NOT NULL,
  telephone VARCHAR(20),
  ville VARCHAR(100),
  photo_profil LONGTEXT,
  is_active TINYINT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login TIMESTAMP NULL,
  FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- Table des sessions utilisateurs
CREATE TABLE IF NOT EXISTS user_sessions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  device_info TEXT,
  ip_address VARCHAR(45),
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Table des catégories de services
CREATE TABLE IF NOT EXISTS categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nom VARCHAR(100) NOT NULL,
  description TEXT,
  icone VARCHAR(100),
  couleur VARCHAR(7),
  ordre_affichage INT DEFAULT 0,
  is_active TINYINT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Table des sous-catégories
CREATE TABLE IF NOT EXISTS sous_categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  categorie_id INT NOT NULL,
  nom VARCHAR(100) NOT NULL,
  description TEXT,
  icone VARCHAR(100),
  ordre_affichage INT DEFAULT 0,
  is_active TINYINT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (categorie_id) REFERENCES categories(id)
);

-- Table des plans d'abonnement
CREATE TABLE IF NOT EXISTS plans_abonnement (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nom VARCHAR(100) NOT NULL,
  prix DECIMAL(10,2) NOT NULL DEFAULT 0,
  prix_promo DECIMAL(10,2),
  devise VARCHAR(10) DEFAULT 'FCFA',
  max_services INT DEFAULT -1,
  max_reservations_mois INT DEFAULT -1,
  mise_en_avant TINYINT DEFAULT 0,
  description TEXT,
  avantages JSON,
  is_active TINYINT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insertion des plans par défaut
INSERT IGNORE INTO plans_abonnement (id, nom, prix, max_services, max_reservations_mois, description) VALUES 
(1, 'Gratuit', 0, 3, 10, 'Plan gratuit avec fonctionnalités de base'),
(2, 'Standard', 5000, 10, 50, 'Plan standard pour petites entreprises'),
(3, 'Premium', 15000, -1, -1, 'Plan premium illimité');

-- Table des prestataires
CREATE TABLE IF NOT EXISTS prestataires (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL UNIQUE,
  nom_commercial VARCHAR(200) NOT NULL,
  ville VARCHAR(100),
  bio TEXT,
  telephone_pro VARCHAR(20),
  adresse TEXT,
  pays VARCHAR(100) DEFAULT 'Côte d\'Ivoire',
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  horaires_ouverture JSON,
  photos_etablissement JSON,
  is_verified TINYINT DEFAULT 0,
  note_moyenne DECIMAL(3,2) DEFAULT 0,
  nombre_avis INT DEFAULT 0,
  plan_actuel_id INT DEFAULT 1,
  abonnement_expires_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_actuel_id) REFERENCES plans_abonnement(id)
);

-- Table des services
CREATE TABLE IF NOT EXISTS services (
  id INT PRIMARY KEY AUTO_INCREMENT,
  prestataire_id INT NOT NULL,
  sous_categorie_id INT NOT NULL,
  nom VARCHAR(200) NOT NULL,
  description TEXT,
  prix DECIMAL(10,2) NOT NULL,
  devise VARCHAR(10) DEFAULT 'FCFA',
  duree_minutes INT NOT NULL,
  photos JSON,
  is_domicile TINYINT DEFAULT 0,
  is_active TINYINT DEFAULT 1,
  note_moyenne DECIMAL(3,2) DEFAULT 0,
  nombre_avis INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (prestataire_id) REFERENCES prestataires(id) ON DELETE CASCADE,
  FOREIGN KEY (sous_categorie_id) REFERENCES sous_categories(id)
);

-- Table des statuts de réservation
CREATE TABLE IF NOT EXISTS statuts_reservation (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nom VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  couleur VARCHAR(7),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertion des statuts par défaut
INSERT IGNORE INTO statuts_reservation (id, nom, description, couleur) VALUES 
(1, 'en_attente', 'En attente de confirmation', '#FFA500'),
(2, 'confirmee', 'Confirmée par le prestataire', '#00FF00'),
(3, 'acceptee', 'Acceptée et programmée', '#0000FF'),
(4, 'terminee', 'Service terminé', '#008000'),
(5, 'annulee', 'Annulée par le client', '#FF0000'),
(6, 'refusee', 'Refusée par le prestataire', '#800000');

-- Table des réservations
CREATE TABLE IF NOT EXISTS reservations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  client_id INT NOT NULL,
  prestataire_id INT NOT NULL,
  service_id INT NOT NULL,
  statut_id INT NOT NULL DEFAULT 1,
  date_reservation DATE NOT NULL,
  heure_debut TIME NOT NULL,
  heure_fin TIME NOT NULL,
  prix_final DECIMAL(10,2) NOT NULL,
  notes_client TEXT,
  a_domicile TINYINT DEFAULT 0,
  adresse_rdv TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES users(id),
  FOREIGN KEY (prestataire_id) REFERENCES prestataires(id),
  FOREIGN KEY (service_id) REFERENCES services(id),
  FOREIGN KEY (statut_id) REFERENCES statuts_reservation(id)
);

-- Table de l'historique des réservations
CREATE TABLE IF NOT EXISTS historique_reservations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  reservation_id INT NOT NULL,
  ancien_statut_id INT,
  nouveau_statut_id INT NOT NULL,
  commentaire TEXT,
  changed_by_user_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
  FOREIGN KEY (ancien_statut_id) REFERENCES statuts_reservation(id),
  FOREIGN KEY (nouveau_statut_id) REFERENCES statuts_reservation(id),
  FOREIGN KEY (changed_by_user_id) REFERENCES users(id)
);

-- Table des publications
CREATE TABLE IF NOT EXISTS publications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  client_id INT NOT NULL,
  prestataire_id INT NOT NULL,
  service_id INT,
  description TEXT NOT NULL,
  photos JSON,
  videos JSON,
  nombre_likes INT DEFAULT 0,
  is_visible TINYINT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES users(id),
  FOREIGN KEY (prestataire_id) REFERENCES prestataires(id),
  FOREIGN KEY (service_id) REFERENCES services(id)
);

-- Table des likes sur publications
CREATE TABLE IF NOT EXISTS likes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  publication_id INT NOT NULL,
  user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_like (publication_id, user_id),
  FOREIGN KEY (publication_id) REFERENCES publications(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Table des favoris prestataires
CREATE TABLE IF NOT EXISTS favoris_prestataires (
  id INT PRIMARY KEY AUTO_INCREMENT,
  client_id INT NOT NULL,
  prestataire_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_fav_prestataire (client_id, prestataire_id),
  FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (prestataire_id) REFERENCES prestataires(id) ON DELETE CASCADE
);

-- Table des favoris services
CREATE TABLE IF NOT EXISTS favoris_services (
  id INT PRIMARY KEY AUTO_INCREMENT,
  client_id INT NOT NULL,
  service_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_fav_service (client_id, service_id),
  FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

-- Table des favoris publications
CREATE TABLE IF NOT EXISTS favoris_publications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  client_id INT NOT NULL,
  publication_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_fav_publication (client_id, publication_id),
  FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (publication_id) REFERENCES publications(id) ON DELETE CASCADE
);

-- Table des paramètres de l'application
CREATE TABLE IF NOT EXISTS app_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  cle VARCHAR(100) NOT NULL UNIQUE,
  valeur TEXT,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insertion des paramètres par défaut
INSERT IGNORE INTO app_settings (cle, valeur, description) VALUES 
('duree_session_heures', '24', 'Durée de validité des sessions en heures'),
('maintenance_mode', '0', 'Mode maintenance (0=off, 1=on)'),
('max_upload_size', '50', 'Taille maximale des uploads en MB');

-- Index pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_prestataires_ville ON prestataires(ville);
CREATE INDEX IF NOT EXISTS idx_services_prestataire ON services(prestataire_id);
CREATE INDEX IF NOT EXISTS idx_services_categorie ON services(sous_categorie_id);
CREATE INDEX IF NOT EXISTS idx_reservations_client ON reservations(client_id);

-- Table pour les avis clients
CREATE TABLE IF NOT EXISTS avis (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reservation_id INT NOT NULL,
  client_id INT NOT NULL,
  prestataire_id INT NOT NULL,
  service_id INT NOT NULL,
  note INT NOT NULL CHECK (note BETWEEN 1 AND 5),
  commentaire TEXT,
  photos JSON,
  is_verified TINYINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (prestataire_id) REFERENCES prestataires(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
  UNIQUE KEY unique_reservation_avis (reservation_id)
);

-- Index pour les requêtes fréquentes sur les avis
CREATE INDEX IF NOT EXISTS idx_avis_prestataire ON avis(prestataire_id);
CREATE INDEX IF NOT EXISTS idx_avis_service ON avis(service_id);
CREATE INDEX IF NOT EXISTS idx_avis_client ON avis(client_id);
CREATE INDEX IF NOT EXISTS idx_avis_note ON avis(note);

-- Table pour les préférences de notifications utilisateur
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  push_enabled TINYINT DEFAULT 1,
  email_enabled TINYINT DEFAULT 1,
  sms_enabled TINYINT DEFAULT 0,
  new_reservation TINYINT DEFAULT 1,
  reservation_confirmed TINYINT DEFAULT 1,
  reservation_cancelled TINYINT DEFAULT 1,
  new_publication TINYINT DEFAULT 0,
  new_like TINYINT DEFAULT 0,
  new_comment TINYINT DEFAULT 0,
  new_follower TINYINT DEFAULT 0,
  promotions TINYINT DEFAULT 1,
  tips TINYINT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_preferences (user_id)
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_notification_prefs_user ON user_notification_preferences(user_id);

COMMIT;
