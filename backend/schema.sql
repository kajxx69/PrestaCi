-- ==============================================
-- Base de données MySQL - Plateforme PWA Prestations
-- ==============================================

DROP DATABASE IF EXISTS prestations_pwa;
CREATE DATABASE prestations_pwa CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE prestations_pwa;

-- ==============================================
-- 1. GESTION DES UTILISATEURS
-- ==============================================

-- Table des rôles
CREATE TABLE roles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nom VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table principale des utilisateurs
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role_id INT NOT NULL,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    telephone VARCHAR(20),
    photo_profil VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    email_verification_token VARCHAR(255),
    reset_password_token VARCHAR(255),
    reset_password_expires TIMESTAMP NULL,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- Table des sessions utilisateurs (pour la sécurité)
CREATE TABLE user_sessions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    device_info TEXT,
    ip_address VARCHAR(45),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==============================================
-- 2. SYSTÈME DE CATÉGORIES
-- ==============================================

-- Catégories principales (ex: Beauté, Bien-être, etc.)
CREATE TABLE categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nom VARCHAR(100) NOT NULL,
    description TEXT,
    icone VARCHAR(255), -- URL ou nom d'icône
    couleur VARCHAR(7), -- Code couleur hex (#FFFFFF)
    ordre_affichage INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Sous-catégories (ex: Coiffure, Manucure sous Beauté)
CREATE TABLE sous_categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    categorie_id INT NOT NULL,
    nom VARCHAR(100) NOT NULL,
    description TEXT,
    icone VARCHAR(255),
    ordre_affichage INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (categorie_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- ==============================================
-- 3. PLANS D'ABONNEMENT
-- ==============================================

CREATE TABLE plans_abonnement (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nom VARCHAR(50) NOT NULL, -- Basique, Standard, Premium
    prix DECIMAL(10,2) DEFAULT 0.00, -- 0 pour Basique, 3000 pour Standard, etc.
    prix_promo DECIMAL(10,2) NULL, -- Prix promotionnel
    devise VARCHAR(10) DEFAULT 'FCFA',
    max_services INT DEFAULT 2, -- Limite de services
    max_reservations_mois INT DEFAULT 10, -- Limite réservations/mois
    mise_en_avant BOOLEAN DEFAULT FALSE, -- Priorité dans listings
    description TEXT,
    avantages JSON, -- Liste des avantages en JSON
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ==============================================
-- 4. PROFILS PRESTATAIRES
-- ==============================================

CREATE TABLE prestataires (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL UNIQUE,
    nom_commercial VARCHAR(150),
    bio TEXT,
    adresse TEXT,
    ville VARCHAR(100),
    pays VARCHAR(100) DEFAULT 'Côte d\'Ivoire',
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    telephone_pro VARCHAR(20),
    horaires_ouverture JSON, -- {lundi: "08:00-18:00", mardi: "08:00-18:00", ...}
    photos_etablissement JSON, -- Array d'URLs de photos
    plan_actuel_id INT DEFAULT 1, -- Par défaut plan Basique
    abonnement_expires_at TIMESTAMP NULL,
    note_moyenne DECIMAL(2,1) DEFAULT 0.0,
    nombre_avis INT DEFAULT 0,
    is_verified BOOLEAN DEFAULT FALSE, -- Prestataire vérifié
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (plan_actuel_id) REFERENCES plans_abonnement(id)
);

-- ==============================================
-- 5. SERVICES PROPOSÉS PAR LES PRESTATAIRES
-- ==============================================

CREATE TABLE services (
    id INT PRIMARY KEY AUTO_INCREMENT,
    prestataire_id INT NOT NULL,
    sous_categorie_id INT NOT NULL,
    nom VARCHAR(150) NOT NULL,
    description TEXT,
    prix DECIMAL(10,2) NOT NULL,
    devise VARCHAR(10) DEFAULT 'FCFA',
    duree_minutes INT NOT NULL, -- Durée en minutes
    photos JSON, -- Array d'URLs de photos du service
    is_domicile BOOLEAN DEFAULT FALSE, -- Service à domicile possible
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (prestataire_id) REFERENCES prestataires(id) ON DELETE CASCADE,
    FOREIGN KEY (sous_categorie_id) REFERENCES sous_categories(id),
    INDEX idx_prestataire_active (prestataire_id, is_active),
    INDEX idx_sous_categorie (sous_categorie_id)
);

-- ==============================================
-- 6. SYSTÈME DE RÉSERVATIONS
-- ==============================================

-- Statuts des réservations
CREATE TABLE statuts_reservation (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nom VARCHAR(50) NOT NULL UNIQUE, -- en_attente, acceptee, refusee, terminee, annulee
    couleur VARCHAR(7), -- Code couleur pour l'interface
    description TEXT
);

-- Table principale des réservations
CREATE TABLE reservations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    client_id INT NOT NULL,
    prestataire_id INT NOT NULL,
    service_id INT NOT NULL,
    statut_id INT DEFAULT 1, -- Par défaut "en_attente"
    date_reservation DATE NOT NULL,
    heure_debut TIME NOT NULL,
    heure_fin TIME NOT NULL,
    prix_final DECIMAL(10,2) NOT NULL,
    notes_client TEXT,
    notes_prestataire TEXT,
    a_domicile BOOLEAN DEFAULT FALSE,
    adresse_rdv TEXT, -- Si à domicile
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (prestataire_id) REFERENCES prestataires(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(id),
    FOREIGN KEY (statut_id) REFERENCES statuts_reservation(id),
    INDEX idx_client_date (client_id, date_reservation),
    INDEX idx_prestataire_date (prestataire_id, date_reservation),
    INDEX idx_statut (statut_id)
);

-- Historique des changements de statut
CREATE TABLE historique_reservations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    reservation_id INT NOT NULL,
    ancien_statut_id INT,
    nouveau_statut_id INT NOT NULL,
    commentaire TEXT,
    changed_by_user_id INT NOT NULL,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
    FOREIGN KEY (ancien_statut_id) REFERENCES statuts_reservation(id),
    FOREIGN KEY (nouveau_statut_id) REFERENCES statuts_reservation(id),
    FOREIGN KEY (changed_by_user_id) REFERENCES users(id)
);

-- ==============================================
-- 7. SYSTÈME D'AVIS ET NOTES
-- ==============================================

CREATE TABLE avis (
    id INT PRIMARY KEY AUTO_INCREMENT,
    reservation_id INT NOT NULL UNIQUE,
    client_id INT NOT NULL,
    prestataire_id INT NOT NULL,
    note INT NOT NULL CHECK (note >= 1 AND note <= 5),
    commentaire TEXT,
    photos JSON, -- Photos jointes à l'avis
    reponse_prestataire TEXT, -- Réponse du prestataire
    reponse_at TIMESTAMP NULL,
    is_visible BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (prestataire_id) REFERENCES prestataires(id) ON DELETE CASCADE,
    INDEX idx_prestataire (prestataire_id, is_visible),
    INDEX idx_note (note)
);

-- ==============================================
-- 8. PUBLICATIONS ET INTERACTIONS SOCIALES
-- ==============================================

-- Publications de prestations réalisées
CREATE TABLE publications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    client_id INT NOT NULL,
    prestataire_id INT NOT NULL, -- Prestataire tagué (obligatoire)
    service_id INT, -- Service associé (optionnel)
    description TEXT,
    photos JSON NOT NULL, -- Au moins une photo obligatoire
    videos JSON, -- URLs des vidéos (optionnel)
    is_visible BOOLEAN DEFAULT TRUE,
    nombre_likes INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (prestataire_id) REFERENCES prestataires(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL,
    INDEX idx_prestataire_visible (prestataire_id, is_visible),
    INDEX idx_created_at (created_at DESC)
);

-- Likes sur les publications
CREATE TABLE likes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    publication_id INT NOT NULL,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (publication_id) REFERENCES publications(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_like (publication_id, user_id),
    INDEX idx_publication (publication_id)
);

-- ==============================================
-- 9. SYSTÈME DE FAVORIS
-- ==============================================

-- Prestataires en favoris
CREATE TABLE favoris_prestataires (
    id INT PRIMARY KEY AUTO_INCREMENT,
    client_id INT NOT NULL,
    prestataire_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (prestataire_id) REFERENCES prestataires(id) ON DELETE CASCADE,
    UNIQUE KEY unique_favori_prestataire (client_id, prestataire_id)
);

-- Services en favoris
CREATE TABLE favoris_services (
    id INT PRIMARY KEY AUTO_INCREMENT,
    client_id INT NOT NULL,
    service_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
    UNIQUE KEY unique_favori_service (client_id, service_id)
);

-- Publications en favoris
CREATE TABLE favoris_publications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    client_id INT NOT NULL,
    publication_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (publication_id) REFERENCES publications(id) ON DELETE CASCADE,
    UNIQUE KEY unique_favori_publication (client_id, publication_id)
);

-- ==============================================
-- 10. GESTION DES PAIEMENTS WAVE
-- ==============================================

-- Transactions Wave
CREATE TABLE transactions_wave (
    id INT PRIMARY KEY AUTO_INCREMENT,
    prestataire_id INT NOT NULL,
    plan_id INT NOT NULL,
    transaction_id_wave VARCHAR(100) NOT NULL, -- ID saisi par le prestataire
    montant DECIMAL(10,2) NOT NULL,
    devise VARCHAR(10) DEFAULT 'FCFA',
    statut ENUM('en_attente', 'valide', 'rejete', 'rembourse') DEFAULT 'en_attente',
    validee_par_admin_id INT NULL,
    motif_rejet TEXT,
    date_paiement TIMESTAMP NOT NULL, -- Date de paiement Wave
    date_validation TIMESTAMP NULL, -- Date de validation admin
    duree_abonnement_jours INT DEFAULT 30, -- 30 jours par défaut
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (prestataire_id) REFERENCES prestataires(id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES plans_abonnement(id),
    FOREIGN KEY (validee_par_admin_id) REFERENCES users(id),
    INDEX idx_prestataire_statut (prestataire_id, statut),
    INDEX idx_transaction_wave (transaction_id_wave)
);

-- ==============================================
-- 11. NOTIFICATIONS PUSH
-- ==============================================

-- Tokens pour notifications push
CREATE TABLE push_tokens (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    token VARCHAR(500) NOT NULL,
    device_type ENUM('android', 'ios', 'web') NOT NULL,
    device_id VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_token (user_id, token(255))
);

-- Templates de notifications
CREATE TABLE notification_templates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nom VARCHAR(100) NOT NULL UNIQUE,
    titre VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    variables JSON, -- Variables disponibles pour le template
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Historique des notifications envoyées
CREATE TABLE notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    template_id INT,
    titre VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    type ENUM('info', 'success', 'warning', 'error') DEFAULT 'info',
    is_read BOOLEAN DEFAULT FALSE,
    data JSON, -- Données additionnelles (IDs, URLs, etc.)
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (template_id) REFERENCES notification_templates(id) ON DELETE SET NULL,
    INDEX idx_user_read (user_id, is_read),
    INDEX idx_sent_at (sent_at DESC)
);

-- ==============================================
-- 12. CONFIGURATION SYSTÈME
-- ==============================================

-- Paramètres globaux de l'application
CREATE TABLE app_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    cle VARCHAR(100) NOT NULL UNIQUE,
    valeur TEXT,
    type ENUM('string', 'integer', 'float', 'boolean', 'json') DEFAULT 'string',
    description TEXT,
    updated_by_admin_id INT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (updated_by_admin_id) REFERENCES users(id)
);

-- Logs système
CREATE TABLE system_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    level ENUM('debug', 'info', 'warning', 'error', 'critical') DEFAULT 'info',
    message TEXT NOT NULL,
    context JSON, -- Contexte additionnel
    user_id INT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_level_date (level, created_at),
    INDEX idx_user_date (user_id, created_at)
);

-- ==============================================
-- INSERTION DES DONNÉES DE BASE
-- ==============================================

-- Rôles
INSERT INTO roles (nom, description) VALUES
('client', 'Utilisateur client de la plateforme'),
('prestataire', 'Prestataire de services'),
('admin', 'Administrateur de la plateforme');

-- Plans d'abonnement
INSERT INTO plans_abonnement (nom, prix, prix_promo, max_services, max_reservations_mois, mise_en_avant, description, avantages) VALUES
('Basique', 00, NULL, 2, 10, FALSE, 'Plan gratuit pour débuter', '["2 services maximum", "10 réservations/mois", "Support de base"]'),
('Standard', 3000, NULL, 20, 30, FALSE, 'Plan intermédiaire pour développer son activité', '["20 services maximum", "30 réservations/mois", "Support prioritaire", "Statistiques détaillées"]'),
('Premium', 10000, 10000.00, -1, -1, TRUE, 'Plan complet pour les professionnels', '["Services illimités", "Réservations illimitées", "Mise en avant prioritaire", "Support VIP", "Analytics avancés", "Badge vérifié"]');

-- Statuts de réservation
INSERT INTO statuts_reservation (nom, couleur, description) VALUES
('en_attente', '#FFA500', 'Réservation en attente de validation'),
('acceptee', '#28A745', 'Réservation acceptée par le prestataire'),
('refusee', '#DC3545', 'Réservation refusée par le prestataire'),
('terminee', '#17A2B8', 'Prestation terminée'),
('annulee', '#6C757D', 'Réservation annulée'),
('confirmee', '#007BFF', 'Réservation confirmée (rappel envoyé)');

-- Catégories principales
INSERT INTO categories (nom, description, icone, couleur, ordre_affichage) VALUES
('Beauté', 'Services de beauté et esthétique', 'beauty.svg', '#FF69B4', 1),
('Bien-être', 'Services de détente et bien-être', 'wellness.svg', '#9370DB', 2),
('Coiffure', 'Services de coiffure et coupe', 'hair.svg', '#FFD700', 3),
('Ongles', 'Services de manucure et pédicure', 'nails.svg', '#FF6347', 4),
('Massage', 'Services de massage thérapeutique', 'massage.svg', '#32CD32', 5),
('Fitness', 'Services de remise en forme', 'fitness.svg', '#FF4500', 6);

-- Quelques sous-catégories d'exemple
INSERT INTO sous_categories (categorie_id, nom, description, ordre_affichage) VALUES
(1, 'Maquillage', 'Services de maquillage professionnel', 1),
(1, 'Épilation', 'Services d\'épilation', 2),
(1, 'Soins du visage', 'Nettoyage et soins faciaux', 3),
(3, 'Coupe homme', 'Coupe et coiffure masculine', 1),
(3, 'Coupe femme', 'Coupe et coiffure féminine', 2),
(3, 'Coloration', 'Coloration et mèches', 3),
(4, 'Manucure', 'Soins des mains et ongles', 1),
(4, 'Pédicure', 'Soins des pieds et ongles', 2),
(4, 'Nail art', 'Décoration d\'ongles artistique', 3);

-- Templates de notifications
INSERT INTO notification_templates (nom, titre, message, variables) VALUES
('reservation_confirmee', 'Réservation confirmée !', 'Votre réservation pour {{service_nom}} le {{date}} à {{heure}} a été confirmée.', '["service_nom", "date", "heure", "prestataire_nom"]'),
('reservation_acceptee', 'Réservation acceptée', '{{prestataire_nom}} a accepté votre demande de réservation pour {{service_nom}}.', '["prestataire_nom", "service_nom", "date", "heure"]'),
('reservation_refusee', 'Réservation refusée', 'Désolé, {{prestataire_nom}} n\'est pas disponible pour cette créneaux.', '["prestataire_nom", "service_nom"]'),
('rappel_rdv', 'Rappel de rendez-vous', 'N\'oubliez pas votre rendez-vous demain à {{heure}} chez {{prestataire_nom}}.', '["heure", "prestataire_nom", "service_nom"]'),
('nouvelle_reservation', 'Nouvelle demande de réservation', '{{client_nom}} souhaite réserver {{service_nom}} pour le {{date}} à {{heure}}.', '["client_nom", "service_nom", "date", "heure"]'),
('paiement_valide', 'Paiement validé', 'Votre abonnement {{plan_nom}} a été activé avec succès !', '["plan_nom", "duree"]');

-- Paramètres de l'application
INSERT INTO app_settings (cle, valeur, type, description) VALUES
('app_name', 'Prestations PWA', 'string', 'Nom de l\'application'),
('wave_number', '+225 XX XX XX XX XX', 'string', 'Numéro Wave pour les paiements'),
('max_photos_publication', '5', 'integer', 'Nombre maximum de photos par publication'),
('duree_session_heures', '24', 'integer', 'Durée de session en heures'),
('email_admin', 'admin@prestations-pwa.com', 'string', 'Email de l\'administrateur principal'),
('maintenance_mode', 'false', 'boolean', 'Mode maintenance activé'),
('timezone', 'Africa/Abidjan', 'string', 'Fuseau horaire de l\'application');

-- ==============================================
-- VUES UTILES POUR LES STATISTIQUES
-- ==============================================

-- Vue pour les statistiques des prestataires
CREATE VIEW stats_prestataires AS
SELECT
     p.id,
    p.nom_commercial,
    u.nom,
    u.prenom,
    pa.nom as plan_nom,
    COUNT(DISTINCT s.id) as nombre_services,
    COUNT(DISTINCT r.id) as nombre_reservations,
    COUNT(DISTINCT CASE WHEN r.statut_id = 4 THEN r.id END) as reservations_terminees,
    AVG(a.note) as note_moyenne,
    COUNT(DISTINCT a.id) as nombre_avis,
    p.created_at as date_inscription
FROM prestataires p
JOIN users u ON p.user_id = u.id
JOIN plans_abonnement pa ON p.plan_actuel_id = pa.id
LEFT JOIN services s ON p.id = s.prestataire_id AND s.is_active = 1
LEFT JOIN reservations r ON p.id = r.prestataire_id
LEFT JOIN avis a ON p.id = a.prestataire_id AND a.is_visible = 1
GROUP BY p.id, p.nom_commercial, u.nom, u.prenom, pa.nom, p.created_at;

-- Vue pour le dashboard admin
CREATE VIEW dashboard_stats AS
SELECT
    (SELECT COUNT(*) FROM users WHERE role_id = 1) as total_clients,
    (SELECT COUNT(*) FROM users WHERE role_id = 2) as total_prestataires,
    (SELECT COUNT(*) FROM prestataires WHERE plan_actuel_id > 1 AND abonnement_expires_at > NOW()) as prestataires_payes,
    (SELECT COUNT(*) FROM reservations WHERE MONTH(created_at) = MONTH(CURDATE())) as reservations_mois,
    (SELECT SUM(montant) FROM transactions_wave WHERE statut = 'valide' AND MONTH(date_validation) = MONTH(CURDATE())) as revenus_mois,
    (SELECT COUNT(*) FROM publications WHERE MONTH(created_at) = MONTH(CURDATE())) as publications_mois;

-- ==============================================
-- INDEX POUR LES PERFORMANCES
-- ==============================================

-- Index pour les recherches géographiques
CREATE INDEX idx_prestataires_geo ON prestataires(latitude, longitude);

-- Index pour les recherches par ville
CREATE INDEX idx_prestataires_ville ON prestataires(ville, is_verified);

-- Index pour les recherches de services
CREATE INDEX idx_services_prix ON services(prix, is_active);
CREATE INDEX idx_services_domicile ON services(is_domicile, is_active);

-- Index pour les statistiques de notes
CREATE INDEX idx_avis_note_visible ON avis(note, is_visible, created_at);

-- Index pour les publications par date
CREATE INDEX idx_publications_date ON publications(created_at DESC, is_visible);

-- ==============================================
-- TRIGGERS POUR MAINTENIR LES STATISTIQUES
-- ==============================================

-- Trigger pour mettre à jour le nombre de likes sur une publication
DELIMITER $$
CREATE TRIGGER update_publication_likes_insert
AFTER INSERT ON likes
FOR EACH ROW
BEGIN
    UPDATE publications
    SET nombre_likes = (SELECT COUNT(*) FROM likes WHERE publication_id = NEW.publication_id)
    WHERE id = NEW.publication_id;
END$$

CREATE TRIGGER update_publication_likes_delete
AFTER DELETE ON likes
FOR EACH ROW
BEGIN
    UPDATE publications
    SET nombre_likes = (SELECT COUNT(*) FROM likes WHERE publication_id = OLD.publication_id)
    WHERE id = OLD.publication_id;
END$$

-- Trigger pour mettre à jour les statistiques des prestataires après un avis
CREATE TRIGGER update_prestataire_stats_avis
AFTER INSERT ON avis
FOR EACH ROW
BEGIN
    UPDATE prestataires
    SET
        note_moyenne = (SELECT AVG(note) FROM avis WHERE prestataire_id = NEW.prestataire_id AND is_visible = 1),
        nombre_avis = (SELECT COUNT(*) FROM avis WHERE prestataire_id = NEW.prestataire_id AND is_visible = 1)
    WHERE id = NEW.prestataire_id;
END$$

-- Trigger pour mettre à jour l'abonnement après validation de paiement
CREATE TRIGGER update_abonnement_after_payment
AFTER UPDATE ON transactions_wave
FOR EACH ROW
BEGIN
    IF NEW.statut = 'valide' AND OLD.statut != 'valide' THEN
        UPDATE prestataires
        SET
            plan_actuel_id = NEW.plan_id,
            abonnement_expires_at = DATE_ADD(NOW(), INTERVAL NEW.duree_abonnement_jours DAY)
        WHERE id = NEW.prestataire_id;
    END IF;
END$$

DELIMITER ;

-- ==============================================
-- PROCÉDURES STOCKÉES UTILES
-- ==============================================

-- Procédure pour nettoyer les sessions expirées
DELIMITER $$
CREATE PROCEDURE CleanExpiredSessions()
BEGIN
    DELETE FROM user_sessions WHERE expires_at < NOW();
END$$

-- Procédure pour calculer les statistiques mensuelles
CREATE PROCEDURE GetMonthlyStats(IN target_month INT, IN target_year INT)
BEGIN
    SELECT
        COUNT(DISTINCT u.id) as nouveaux_clients,
        COUNT(DISTINCT p.id) as nouveaux_prestataires,
        COUNT(DISTINCT r.id) as total_reservations,
        SUM(tw.montant) as revenus_valides,
        COUNT(DISTINCT pub.id) as nouvelles_publications
    FROM users u
    LEFT JOIN prestataires p ON u.id = p.user_id AND MONTH(p.created_at) = target_month AND YEAR(p.created_at) = target_year
    LEFT JOIN reservations r ON MONTH(r.created_at) = target_month AND YEAR(r.created_at) = target_year
    LEFT JOIN transactions_wave tw ON tw.statut = 'valide' AND MONTH(tw.date_validation) = target_month AND YEAR(tw.date_validation) = target_year
    LEFT JOIN publications pub ON MONTH(pub.created_at) = target_month AND YEAR(pub.created_at) = target_year
    WHERE (u.role_id = 1 AND MONTH(u.created_at) = target_month AND YEAR(u.created_at) = target_year)
       OR (u.role_id = 2 AND MONTH(u.created_at) = target_month AND YEAR(u.created_at) = target_year);
END$$

DELIMITER ;

