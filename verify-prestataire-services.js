// Script pour vérifier et créer des services pour chaque prestataire
const mysql = require('mysql2/promise');

async function verifyAndFixServices() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'prestaci'
  });

  try {
    console.log('🔍 Vérification des prestataires et leurs services\n');
    
    // 1. Lister tous les prestataires
    const [prestataires] = await connection.execute(`
      SELECT p.id, p.nom_commercial, p.user_id, u.email, u.nom, u.prenom
      FROM prestataires p
      JOIN users u ON p.user_id = u.id
      ORDER BY p.id
    `);
    
    console.log('📋 Prestataires existants:');
    for (const p of prestataires) {
      console.log(`\nPrestataire ID ${p.id}: ${p.nom_commercial}`);
      console.log(`  User: ${p.email} (${p.nom} ${p.prenom})`);
      
      // Compter les services de ce prestataire
      const [services] = await connection.execute(
        'SELECT id, nom, is_active FROM services WHERE prestataire_id = ?',
        [p.id]
      );
      
      if (services.length > 0) {
        console.log(`  Services (${services.length}):`);
        services.forEach(s => {
          console.log(`    - ID ${s.id}: ${s.nom} (${s.is_active ? 'Actif' : 'Inactif'})`);
        });
      } else {
        console.log(`  ⚠️ Aucun service`);
        
        // Créer des services de démonstration pour ce prestataire
        if (p.email === 'john.doe@example.com' || p.email === 'prestataire.test@example.com') {
          console.log(`  ✨ Création de services de démonstration...`);
          
          const servicesToCreate = [
            {
              nom: `${p.nom_commercial} - Service Premium`,
              description: `Service premium offert par ${p.nom_commercial}`,
              prix: 15000,
              duree: 120,
              categorie: 1
            },
            {
              nom: `${p.nom_commercial} - Service Standard`,
              description: `Service standard offert par ${p.nom_commercial}`,
              prix: 8000,
              duree: 60,
              categorie: 2
            },
            {
              nom: `${p.nom_commercial} - Service Express`,
              description: `Service express offert par ${p.nom_commercial}`,
              prix: 5000,
              duree: 30,
              categorie: 1
            }
          ];
          
          for (const service of servicesToCreate) {
            try {
              await connection.execute(
                `INSERT INTO services (prestataire_id, sous_categorie_id, nom, description, prix, devise, duree_minutes, is_active, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, 'FCFA', ?, 1, NOW(), NOW())`,
                [p.id, service.categorie, service.nom, service.description, service.prix, service.duree]
              );
              console.log(`    ✅ Créé: ${service.nom}`);
            } catch (err) {
              console.log(`    ❌ Erreur création: ${err.message}`);
            }
          }
        }
      }
    }
    
    // 2. Vérifier les services orphelins
    console.log('\n\n🔍 Vérification des services orphelins...');
    const [orphans] = await connection.execute(`
      SELECT s.id, s.nom, s.prestataire_id
      FROM services s
      LEFT JOIN prestataires p ON s.prestataire_id = p.id
      WHERE p.id IS NULL
    `);
    
    if (orphans.length > 0) {
      console.log(`⚠️ ${orphans.length} services orphelins trouvés:`);
      orphans.forEach(s => {
        console.log(`  - Service ID ${s.id}: "${s.nom}" (prestataire_id=${s.prestataire_id} n'existe pas)`);
      });
      
      // Optionnel : supprimer les orphelins
      console.log('\n  Suppression des services orphelins...');
      await connection.execute('DELETE FROM services WHERE prestataire_id NOT IN (SELECT id FROM prestataires)');
      console.log('  ✅ Services orphelins supprimés');
    } else {
      console.log('✅ Aucun service orphelin');
    }
    
    // 3. Résumé final
    console.log('\n\n📊 Résumé final:');
    const [summary] = await connection.execute(`
      SELECT 
        p.id,
        p.nom_commercial,
        COUNT(s.id) as nb_services,
        SUM(CASE WHEN s.is_active = 1 THEN 1 ELSE 0 END) as nb_actifs
      FROM prestataires p
      LEFT JOIN services s ON s.prestataire_id = p.id
      GROUP BY p.id, p.nom_commercial
      ORDER BY p.id
    `);
    
    console.log('Prestataire | Services | Actifs');
    console.log('--------------------------------');
    summary.forEach(row => {
      console.log(`${row.nom_commercial.padEnd(20)} | ${String(row.nb_services).padEnd(8)} | ${row.nb_actifs}`);
    });
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await connection.end();
  }
}

// Exécuter le script
verifyAndFixServices().then(() => {
  console.log('\n✅ Vérification terminée');
}).catch(console.error);
