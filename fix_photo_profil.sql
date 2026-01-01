-- Script SQL pour corriger la colonne photo_profil
-- Exécuter cette requête dans votre client MySQL

-- Vérifier la structure actuelle
DESCRIBE users;

-- Modifier la colonne photo_profil pour accepter des images plus grandes
ALTER TABLE users MODIFY COLUMN photo_profil LONGTEXT;

-- Vérifier que la modification a été appliquée
DESCRIBE users;

-- Afficher un message de confirmation
SELECT 'Migration terminée avec succès ! Vous pouvez maintenant uploader des photos de profil.' AS message;
