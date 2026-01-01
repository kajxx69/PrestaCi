-- Diagnostic : Vérifier l'état actuel des services et prestataires
-- ================================================================

-- 1. Afficher tous les services avec leurs propriétaires
SELECT 
    s.id AS service_id,
    s.nom AS service_nom,
    s.prestataire_id,
    p.nom_commercial,
    p.user_id,
    u.email,
    u.nom AS user_nom,
    u.prenom AS user_prenom
FROM services s
LEFT JOIN prestataires p ON s.prestataire_id = p.id
LEFT JOIN users u ON p.user_id = u.id
ORDER BY s.id;

-- 2. Vérifier les prestataires existants
SELECT 
    p.id AS prestataire_id,
    p.nom_commercial,
    p.user_id,
    u.email,
    u.nom,
    u.prenom
FROM prestataires p
JOIN users u ON p.user_id = u.id
ORDER BY p.id;

-- 3. Identifier les services orphelins (sans prestataire valide)
SELECT 
    s.id,
    s.nom,
    s.prestataire_id,
    'ORPHELIN - Prestataire inexistant' AS probleme
FROM services s
WHERE NOT EXISTS (
    SELECT 1 FROM prestataires p WHERE p.id = s.prestataire_id
);

-- 4. Vérifier spécifiquement le prestataire de test
SELECT 
    p.id AS prestataire_id,
    p.user_id,
    u.email,
    COUNT(s.id) AS nombre_services
FROM prestataires p
JOIN users u ON p.user_id = u.id
LEFT JOIN services s ON s.prestataire_id = p.id
WHERE u.email = 'prestataire.test@example.com'
GROUP BY p.id, p.user_id, u.email;

-- 5. Services du prestataire john.doe
SELECT 
    s.id,
    s.nom,
    s.prestataire_id,
    s.is_active
FROM services s
JOIN prestataires p ON s.prestataire_id = p.id
JOIN users u ON p.user_id = u.id
WHERE u.email = 'john.doe@example.com';

-- CORRECTIONS (décommenter pour exécuter)
-- ========================================

-- Option 1: Créer des services de test pour le prestataire.test@example.com
/*
-- Récupérer l'ID du prestataire de test
SET @prestataire_test_id = (
    SELECT p.id 
    FROM prestataires p 
    JOIN users u ON p.user_id = u.id 
    WHERE u.email = 'prestataire.test@example.com'
);

-- Créer des services de test pour ce prestataire
INSERT INTO services (prestataire_id, sous_categorie_id, nom, description, prix, devise, duree_minutes, is_active, created_at, updated_at)
VALUES 
    (@prestataire_test_id, 1, 'Mon Service Test 1', 'Description service test 1', 5000, 'FCFA', 60, 1, NOW(), NOW()),
    (@prestataire_test_id, 2, 'Mon Service Test 2', 'Description service test 2', 7500, 'FCFA', 90, 1, NOW(), NOW());
*/

-- Option 2: Réassigner les services orphelins au prestataire john.doe
/*
UPDATE services 
SET prestataire_id = 1 
WHERE prestataire_id NOT IN (SELECT id FROM prestataires);
*/
