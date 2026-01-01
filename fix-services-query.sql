-- Diagnostic du problème
-- ======================

-- 1. Vérifier le prestataire_id pour l'utilisateur de test
SELECT 
    u.id as user_id,
    u.email,
    p.id as prestataire_id,
    p.nom_commercial
FROM users u
LEFT JOIN prestataires p ON p.user_id = u.id
WHERE u.email = 'prestataire.test@example.com';

-- 2. Voir tous les services et leurs propriétaires
SELECT 
    s.id as service_id,
    s.nom as service_nom,
    s.prestataire_id,
    p.nom_commercial,
    p.user_id,
    u.email
FROM services s
JOIN prestataires p ON s.prestataire_id = p.id
JOIN users u ON p.user_id = u.id
ORDER BY s.id;

-- 3. Vérifier spécifiquement ce que devrait voir prestataire.test@example.com
-- (en supposant que son prestataire_id est 10 basé sur les logs précédents)
SELECT 
    s.*
FROM services s
WHERE s.prestataire_id = (
    SELECT p.id 
    FROM prestataires p 
    JOIN users u ON p.user_id = u.id 
    WHERE u.email = 'prestataire.test@example.com'
);

-- SOLUTION : Créer des services pour le bon prestataire
-- ======================================================

-- Obtenir le prestataire_id correct
SET @prestataire_test_id = (
    SELECT p.id 
    FROM prestataires p 
    JOIN users u ON p.user_id = u.id 
    WHERE u.email = 'prestataire.test@example.com'
);

-- Afficher le prestataire_id trouvé
SELECT @prestataire_test_id as 'Prestataire Test ID';

-- Si le prestataire n'a pas de services, en créer
INSERT INTO services (prestataire_id, sous_categorie_id, nom, description, prix, devise, duree_minutes, is_active, created_at, updated_at)
SELECT 
    @prestataire_test_id,
    1,
    'Mon Service Personnel 1',
    'Service de test appartenant au bon prestataire',
    8000,
    'FCFA',
    60,
    1,
    NOW(),
    NOW()
WHERE @prestataire_test_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM services WHERE prestataire_id = @prestataire_test_id
);

INSERT INTO services (prestataire_id, sous_categorie_id, nom, description, prix, devise, duree_minutes, is_active, created_at, updated_at)
SELECT 
    @prestataire_test_id,
    2,
    'Mon Service Personnel 2',
    'Autre service de test',
    12000,
    'FCFA',
    90,
    1,
    NOW(),
    NOW()
WHERE @prestataire_test_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM services WHERE prestataire_id = @prestataire_test_id AND nom = 'Mon Service Personnel 2'
);
