import { pool } from '../db.js';
async function createTestServices() {
    try {
        // Demander quel prestataire utiliser
        const userEmail = process.argv[2] || 'provider@test.com';
        console.log(`Création de services de test pour: ${userEmail}\n`);
        // Trouver l'utilisateur et son prestataire_id
        const [userRows] = await pool.query('SELECT u.id, u.email, p.id as prestataire_id FROM users u JOIN prestataires p ON u.id = p.user_id WHERE u.email = ?', [userEmail]);
        if (userRows.length === 0) {
            console.error(`❌ Aucun prestataire trouvé pour l'email: ${userEmail}`);
            console.log('\nPrestataires disponibles:');
            const [prestataires] = await pool.query('SELECT u.email FROM users u JOIN prestataires p ON u.id = p.user_id');
            prestataires.forEach((p) => console.log(`  - ${p.email}`));
            process.exit(1);
        }
        const user = userRows[0];
        console.log(`✅ Prestataire trouvé: ID ${user.prestataire_id}\n`);
        // Récupérer une sous-catégorie pour les services
        const [subCategories] = await pool.query('SELECT id, nom FROM sous_categories LIMIT 1');
        if (subCategories.length === 0) {
            console.error('❌ Aucune sous-catégorie trouvée. Création d\'une catégorie de test...');
            // Créer une catégorie et sous-catégorie de test
            const [catResult] = await pool.query('INSERT INTO categories (nom, description, icone, couleur, is_active) VALUES (?, ?, ?, ?, ?)', ['Services Test', 'Catégorie de test', 'settings', '#3B82F6', 1]);
            const [subCatResult] = await pool.query('INSERT INTO sous_categories (categorie_id, nom, description, is_active) VALUES (?, ?, ?, ?)', [catResult.insertId, 'Sous-catégorie Test', 'Pour les tests', 1]);
            subCategories[0] = { id: subCatResult.insertId, nom: 'Sous-catégorie Test' };
        }
        const sousCategorieId = subCategories[0].id;
        console.log(`Utilisation de la sous-catégorie: ${subCategories[0].nom} (ID: ${sousCategorieId})\n`);
        // Services à créer
        const services = [
            {
                nom: 'Service Test 1 - Consultation',
                description: 'Service de consultation test',
                prix: 15000,
                duree_minutes: 60
            },
            {
                nom: 'Service Test 2 - Formation',
                description: 'Service de formation test',
                prix: 25000,
                duree_minutes: 120
            },
            {
                nom: 'Service Test 3 - Assistance',
                description: 'Service d\'assistance test',
                prix: 10000,
                duree_minutes: 30
            }
        ];
        console.log('Création des services...\n');
        for (const service of services) {
            try {
                const [result] = await pool.query(`INSERT INTO services (
            prestataire_id, sous_categorie_id, nom, description, 
            prix, devise, duree_minutes, is_active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, 'XOF', ?, 1, NOW(), NOW())`, [
                    user.prestataire_id,
                    sousCategorieId,
                    service.nom,
                    service.description,
                    service.prix,
                    service.duree_minutes
                ]);
                console.log(`✅ Service créé: "${service.nom}" (ID: ${result.insertId})`);
            }
            catch (error) {
                if (error.code === 'ER_DUP_ENTRY') {
                    console.log(`⚠️ Service "${service.nom}" existe déjà`);
                }
                else {
                    console.error(`❌ Erreur création service "${service.nom}":`, error.message);
                }
            }
        }
        // Afficher les services du prestataire
        const [allServices] = await pool.query('SELECT id, nom, prix, devise, is_active FROM services WHERE prestataire_id = ?', [user.prestataire_id]);
        console.log('\n📋 Services du prestataire:');
        console.table(allServices);
    }
    catch (error) {
        console.error('Erreur:', error);
    }
    finally {
        await pool.end();
    }
}
createTestServices();
