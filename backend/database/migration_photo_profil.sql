-- Migration pour corriger la taille de la colonne photo_profil
-- Exécuter cette migration pour résoudre l'erreur "Data too long"

-- Modifier la colonne photo_profil pour accepter des images plus grandes
ALTER TABLE users MODIFY COLUMN photo_profil LONGTEXT;

-- Vérifier que la modification a été appliquée
DESCRIBE users;
