-- Créer uniquement les tables manquantes (sans DROP DATABASE)
-- Date: 2025-10-05

USE prestations_pwa;

-- Table favoris_publications (si elle n'existe pas)
CREATE TABLE IF NOT EXISTS favoris_publications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    client_id INT NOT NULL,
    publication_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (publication_id) REFERENCES publications(id) ON DELETE CASCADE,
    UNIQUE KEY unique_favori_publication (client_id, publication_id)
);

-- Vérifier les autres tables de favoris
CREATE TABLE IF NOT EXISTS favoris_prestataires (
    id INT PRIMARY KEY AUTO_INCREMENT,
    client_id INT NOT NULL,
    prestataire_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (prestataire_id) REFERENCES prestataires(id) ON DELETE CASCADE,
    UNIQUE KEY unique_favori_prestataire (client_id, prestataire_id)
);

CREATE TABLE IF NOT EXISTS favoris_services (
    id INT PRIMARY KEY AUTO_INCREMENT,
    client_id INT NOT NULL,
    service_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
    UNIQUE KEY unique_favori_service (client_id, service_id)
);

SELECT 'Tables de favoris créées avec succès!' AS message;
