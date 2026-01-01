-- Vérifier et corriger la structure de la table notifications
-- Si la table n'existe pas, la créer
CREATE TABLE IF NOT EXISTS notifications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  type VARCHAR(50) DEFAULT 'system',
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSON,
  is_read BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_read (user_id, is_read),
  INDEX idx_sent_at (sent_at)
);

-- Ajouter les colonnes manquantes si elles n'existent pas
ALTER TABLE notifications 
  MODIFY COLUMN title VARCHAR(255) NOT NULL,
  MODIFY COLUMN message TEXT NOT NULL;

-- Vérifier que la colonne 'titre' n'existe pas (elle devrait être 'title')
-- Si elle existe, la renommer
SELECT COUNT(*) INTO @col_exists 
FROM information_schema.columns 
WHERE table_schema = DATABASE() 
  AND table_name = 'notifications' 
  AND column_name = 'titre';

SET @sql = IF(@col_exists > 0, 
  'ALTER TABLE notifications CHANGE COLUMN titre title VARCHAR(255) NOT NULL',
  'SELECT "Column titre does not exist"');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Créer la table admin_logs si elle n'existe pas
CREATE TABLE IF NOT EXISTS admin_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  admin_id INT NOT NULL,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id INT,
  details JSON,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_admin_action (admin_id, action),
  INDEX idx_created_at (created_at)
);
