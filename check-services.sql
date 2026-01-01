-- Vérifier les services et leurs prestataires
SELECT 
    s.id,
    s.nom,
    s.prestataire_id,
    s.is_active,
    p.user_id,
    u.email
FROM services s
JOIN prestataires p ON s.prestataire_id = p.id
JOIN users u ON p.user_id = u.id
ORDER BY s.id DESC
LIMIT 10;

-- Vérifier le prestataire de test
SELECT * FROM prestataires WHERE user_id = (
    SELECT id FROM users WHERE email = 'prestataire.test@example.com'
);

-- Vérifier tous les services du prestataire de test
SELECT s.* 
FROM services s
JOIN prestataires p ON s.prestataire_id = p.id
JOIN users u ON p.user_id = u.id
WHERE u.email = 'prestataire.test@example.com';
