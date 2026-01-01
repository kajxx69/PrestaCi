import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function checkPlansStructure() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  console.log('🔍 ANALYSE DE VOS TABLES D\'ABONNEMENT:');

  try {
    // Vérifier la structure de plans_abonnement
    const [planColumns] = await connection.execute('DESCRIBE plans_abonnement');
    console.log('\n📋 Table plans_abonnement:');
    planColumns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type}) ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });

    // Voir le contenu
    const [planData] = await connection.execute('SELECT * FROM plans_abonnement LIMIT 3');
    console.log('\n📊 Données existantes:');
    planData.forEach((plan, i) => {
      console.log(`  ${i+1}. ${JSON.stringify(plan)}`);
    });

  } catch (e) {
    console.log('❌ Erreur plans_abonnement:', e.message);
  }

  // Chercher d'autres tables liées
  const [tables] = await connection.execute('SHOW TABLES');
  const abonnementTables = tables.filter(table => {
    const name = Object.values(table)[0].toLowerCase();
    return name.includes('abonnement') || name.includes('subscription') || name.includes('plan');
  });

  console.log('\n📋 TOUTES LES TABLES LIÉES AUX ABONNEMENTS:');
  for (const table of abonnementTables) {
    const tableName = Object.values(table)[0];
    console.log(`\n🔸 ${tableName}:`);
    try {
      const [columns] = await connection.execute(`DESCRIBE ${tableName}`);
      columns.forEach(col => {
        console.log(`    ${col.Field} (${col.Type})`);
      });
    } catch (e) {
      console.log(`    ❌ Erreur: ${e.message}`);
    }
  }

  await connection.end();
}

checkPlansStructure().catch(console.error);
