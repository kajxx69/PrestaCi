-- Ajouter la colonne ville à la table users
USE prestations_pwa;

ALTER TABLE users ADD COLUMN IF NOT EXISTS ville VARCHAR(100) DEFAULT NULL AFTER telephone;
