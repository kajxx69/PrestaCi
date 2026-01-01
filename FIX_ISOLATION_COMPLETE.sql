-- ========================================
-- SCRIPT DE CORRECTION DE L'ISOLATION DES SERVICES
-- ========================================

-- 1. DIAGNOSTIC : Identifier le problème
-- ----------------------------------------

-- Voir tous les utilisateurs prestataires et leurs IDs
SELECT 
    u.id as user_id,
    u.email,
    u.nom,
    u.prenom,
    p.id as prestataire_id,
    p.nom_commercial
FROM users u
LEFT JOIN prestataires p ON p.user_id = u.id
WHERE u.role_id = 2
ORDER BY u.id;

-- Voir à qui appartiennent les services problématiques
SELECT 
    s.id as service_id,
    s.nom as service_nom,
    s.prestataire_id,
    p.nom_commercial,
    p.user_id,
    u.email
FROM services s
LEFT JOIN prestataires p ON s.prestataire_id = p.id
LEFT JOIN users u ON p.user_id = u.id
WHERE s.id IN (1, 3, 4, 5)
ORDER BY s.id;

-- 2. IDENTIFIER L'UTILISATEUR CONNECTÉ
-- -------------------------------------
-- Remplacez 'votre.email@example.com' par l'email avec lequel vous vous connectez

SET @current_user_email = 'john.doe@example.com'; -- CHANGEZ CETTE VALEUR !

-- Récupérer les infos de cet utilisateur
SELECT 
    u.id as user_id,
    u.email,
    p.id as prestataire_id,
    p.nom_commercial
FROM users u
LEFT JOIN prestataires p ON p.user_id = u.id
WHERE u.email = @current_user_email;

-- 3. CRÉER UN PROFIL PRESTATAIRE SI NÉCESSAIRE
-- ----------------------------------------------

-- Si l'utilisateur n'a pas de profil prestataire, décommentez et exécutez :
/*
INSERT INTO prestataires (user_id, nom_commercial, ville, adresse, latitude, longitude, created_at, updated_at)
SELECT 
    u.id,
    CONCAT('Services ', u.nom, ' ', u.prenom),
    'Abidjan',
    '123 Rue Test',
    5.3600,
    -4.0083,
    NOW(),
    NOW()
FROM users u
WHERE u.email = @current_user_email
AND NOT EXISTS (
    SELECT 1 FROM prestataires p WHERE p.user_id = u.id
);
*/

-- 4. CRÉER DES SERVICES POUR LE PRESTATAIRE CONNECTÉ
-- ----------------------------------------------------

-- Obtenir le prestataire_id
SET @prestataire_id = (
    SELECT p.id 
    FROM prestataires p 
    JOIN users u ON p.user_id = u.id 
    WHERE u.email = @current_user_email
);

-- Afficher le prestataire_id trouvé
SELECT @prestataire_id as 'Votre Prestataire ID';

-- Vérifier les services existants
SELECT 
    'Services actuels pour ce prestataire:' as Info,
    COUNT(*) as Nombre
FROM services 
WHERE prestataire_id = @prestataire_id;

-- Lister les services existants
SELECT id, nom, prix, is_active 
FROM services 
WHERE prestataire_id = @prestataire_id;

-- Si aucun service n'existe, en créer
INSERT INTO services (
    prestataire_id, 
    sous_categorie_id, 
    nom, 
    description, 
    prix, 
    devise, 
    duree_minutes, 
    is_active, 
    created_at, 
    updated_at
)
SELECT 
    @prestataire_id,
    1,
    'Mon Service Premium Personnel',
    'Service premium exclusif',
    15000,
    'FCFA',
    120,
    1,
    NOW(),
    NOW()
WHERE @prestataire_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM services 
    WHERE prestataire_id = @prestataire_id 
    AND nom = 'Mon Service Premium Personnel'
);

INSERT INTO services (
    prestataire_id, 
    sous_categorie_id, 
    nom, 
    description, 
    prix, 
    devise, 
    duree_minutes, 
    is_active, 
    created_at, 
    updated_at
)
SELECT 
    @prestataire_id,
    2,
    'Mon Service Standard Personnel',
    'Service standard de qualité',
    8000,
    'FCFA',
    60,
    1,
    NOW(),
    NOW()
WHERE @prestataire_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM services 
    WHERE prestataire_id = @prestataire_id 
    AND nom = 'Mon Service Standard Personnel'
);

INSERT INTO services (
    prestataire_id, 
    sous_categorie_id, 
    nom, 
    description, 
    prix, 
    devise, 
    duree_minutes, 
    is_active, 
    created_at, 
    updated_at
)
SELECT 
    @prestataire_id,
    1,
    'Mon Service Express Personnel',
    'Service rapide et efficace',
    5000,
    'FCFA',
    30,
    1,
    NOW(),
    NOW()
WHERE @prestataire_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM services 
    WHERE prestataire_id = @prestataire_id 
    AND nom = 'Mon Service Express Personnel'
);

-- 5. VÉRIFICATION FINALE
-- -----------------------

-- Afficher les services du prestataire après création
SELECT 
    'Services après création:' as Info;

SELECT 
    s.id,
    s.nom,
    s.prix,
    s.devise,
    s.duree_minutes,
    s.is_active,
    s.prestataire_id
FROM services s
WHERE s.prestataire_id = @prestataire_id
ORDER BY s.id DESC;

-- 6. TEST DE LA REQUÊTE EXACTE UTILISÉE PAR L'API
-- -------------------------------------------------

-- Simuler la requête de l'API
SELECT 
    'Test requête API (devrait retourner UNIQUEMENT vos services):' as Info;

SELECT * 
FROM services 
WHERE prestataire_id = @prestataire_id 
ORDER BY created_at DESC;

-- 7. VÉRIFIER QU'AUCUN AUTRE SERVICE N'EST VISIBLE
-- --------------------------------------------------

SELECT 
    'Services qui NE devraient PAS apparaître (autres prestataires):' as Info;

SELECT 
    s.id,
    s.nom,
    s.prestataire_id,
    p.nom_commercial as 'Appartient à'
FROM services s
JOIN prestataires p ON s.prestataire_id = p.id
WHERE s.prestataire_id != @prestataire_id
LIMIT 10;

-- ========================================
-- FIN DU SCRIPT
-- ========================================

-- INSTRUCTIONS :
-- 1. Changez @current_user_email ligne 37 avec votre email
-- 2. Exécutez ce script dans votre client MySQL
-- 3. Redémarrez le serveur backend
-- 4. Déconnectez-vous et reconnectez-vous dans l'application
-- 5. Vous ne devriez voir QUE vos propres services
