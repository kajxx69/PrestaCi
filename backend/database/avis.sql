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

-- Index pour les requêtes fréquentes
CREATE INDEX idx_avis_prestataire ON avis(prestataire_id);
CREATE INDEX idx_avis_service ON avis(service_id);
CREATE INDEX idx_avis_client ON avis(client_id);
CREATE INDEX idx_avis_note ON avis(note);
