// Script pour corriger définitivement l'isolation des services
const mysql = require('./backend/node_modules/mysql2/promise');

async function fixServicesIsolation() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'prestaci'
  });

  try {
    console.log('🔧 Correction de l\'isolation des services\n');
    
    // 1. Identifier le prestataire connecté (celui qui a le problème)
    console.log('📋 Recherche du prestataire pour l\'utilisateur de test...');
    const [userRows] = await connection.execute(
      `SELECT u.id, u.email, p.id as prestataire_id, p.nom_commercial
       FROM users u
       LEFT JOIN prestataires p ON p.user_id = u.id
       WHERE u.email IN ('john.doe@example.com', 'prestataire.test@example.com', 'jane.smith@example.com')
       ORDER BY u.id`
    );
    
    console.log('Utilisateurs prestataires trouvés:');
    for (const user of userRows) {
      console.log(`  User ID ${user.id}: ${user.email}`);
      console.log(`    -> Prestataire ID: ${user.prestataire_id || 'AUCUN'} ${user.nom_commercial ? `(${user.nom_commercial})` : ''}`);
    }
    
    // 2. Vérifier à qui appartiennent les services problématiques
    console.log('\n🔍 Vérification des services ID 1, 3, 4, 5...');
    const [problemServices] = await connection.execute(
      `SELECT s.id, s.nom, s.prestataire_id, p.nom_commercial, u.email
       FROM services s
       LEFT JOIN prestataires p ON s.prestataire_id = p.id
       LEFT JOIN users u ON p.user_id = u.id
       WHERE s.id IN (1, 3, 4, 5)
       ORDER BY s.id`
    );
    
    console.log('Services problématiques:');
    for (const service of problemServices) {
      console.log(`  Service ID ${service.id}: "${service.nom}"`);
      console.log(`    Appartient à: Prestataire ${service.prestataire_id} (${service.nom_commercial || 'INCONNU'})`);
      console.log(`    Email propriétaire: ${service.email || 'N/A'}`);
    }
    
    // 3. Pour chaque utilisateur prestataire, s'assurer qu'il a ses propres services
    console.log('\n✨ Création de services pour les prestataires sans services...');
    
    for (const user of userRows) {
      if (!user.prestataire_id) {
        console.log(`\n⚠️ ${user.email} n'a pas de profil prestataire`);
        
        // Créer un profil prestataire si nécessaire
        if (user.email === 'john.doe@example.com' || user.email === 'jane.smith@example.com') {
          console.log(`  Création d'un profil prestataire...`);
          const [result] = await connection.execute(
            `INSERT INTO prestataires (user_id, nom_commercial, ville, adresse, latitude, longitude, created_at, updated_at)
             VALUES (?, ?, 'Abidjan', '123 Rue Test', 5.3600, -4.0083, NOW(), NOW())`,
            [user.id, `Services ${user.email.split('@')[0]}`]
          );
          user.prestataire_id = result.insertId;
          console.log(`  ✅ Prestataire créé avec ID: ${user.prestataire_id}`);
        }
      }
      
      if (user.prestataire_id) {
        // Vérifier si ce prestataire a des services
        const [existingServices] = await connection.execute(
          'SELECT COUNT(*) as count FROM services WHERE prestataire_id = ?',
          [user.prestataire_id]
        );
        
        if (existingServices[0].count === 0) {
          console.log(`\n📦 Création de services pour ${user.email} (Prestataire ID: ${user.prestataire_id})...`);
          
          // Créer 3 services de démonstration
          const services = [
            { nom: 'Service Premium', prix: 15000, duree: 120 },
            { nom: 'Service Standard', prix: 8000, duree: 60 },
            { nom: 'Service Express', prix: 5000, duree: 30 }
          ];
          
          for (const service of services) {
            await connection.execute(
              `INSERT INTO services (prestataire_id, sous_categorie_id, nom, description, prix, devise, duree_minutes, is_active, created_at, updated_at)
               VALUES (?, 1, ?, ?, ?, 'FCFA', ?, 1, NOW(), NOW())`,
              [
                user.prestataire_id,
                `${service.nom} - ${user.email.split('@')[0]}`,
                `Service offert par ${user.email}`,
                service.prix,
                service.duree
              ]
            );
            console.log(`    ✅ Créé: ${service.nom}`);
          }
        } else {
          console.log(`\n✅ ${user.email} a déjà ${existingServices[0].count} service(s)`);
        }
      }
    }
    
    // 4. Vérification finale
    console.log('\n📊 Vérification finale de l\'isolation...');
    
    for (const user of userRows) {
      if (user.prestataire_id) {
        const [services] = await connection.execute(
          'SELECT id, nom FROM services WHERE prestataire_id = ? ORDER BY id',
          [user.prestataire_id]
        );
        
        console.log(`\n${user.email} (Prestataire ${user.prestataire_id}):`);
        if (services.length > 0) {
          console.log(`  Services (${services.length}):`);
          for (const s of services) {
            console.log(`    - ID ${s.id}: ${s.nom}`);
          }
        } else {
          console.log('  ⚠️ Aucun service');
        }
      }
    }
    
    // 5. Test de la requête exacte utilisée par l'API
    console.log('\n🔬 Test de la requête SQL utilisée par l\'API...');
    
    // Simuler pour l'utilisateur john.doe
    const testEmail = 'john.doe@example.com';
    const [testUser] = await connection.execute(
      'SELECT id FROM users WHERE email = ?',
      [testEmail]
    );
    
    if (testUser.length > 0) {
      const userId = testUser[0].id;
      const [prestataireTest] = await connection.execute(
        'SELECT id, nom_commercial FROM prestataires WHERE user_id = ? LIMIT 1',
        [userId]
      );
      
      if (prestataireTest.length > 0) {
        const prestataireId = prestataireTest[0].id;
        const [servicesTest] = await connection.execute(
          'SELECT * FROM services WHERE prestataire_id = ? ORDER BY created_at DESC',
          [prestataireId]
        );
        
        console.log(`\nPour ${testEmail}:`);
        console.log(`  User ID: ${userId}`);
        console.log(`  Prestataire ID: ${prestataireId}`);
        console.log(`  Services trouvés: ${servicesTest.length}`);
        console.log(`  IDs: [${servicesTest.map(s => s.id).join(', ')}]`);
      }
    }
    
    console.log('\n✅ Correction terminée!');
    console.log('\n💡 Recommandations:');
    console.log('1. Redémarrez le serveur backend');
    console.log('2. Déconnectez-vous et reconnectez-vous dans l\'application');
    console.log('3. Vérifiez que vous ne voyez que VOS services');
    console.log('4. Si le problème persiste, vérifiez les logs du serveur');
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await connection.end();
  }
}

// Exécuter le script
fixServicesIsolation().catch(console.error);
