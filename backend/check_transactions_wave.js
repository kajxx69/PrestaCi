import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function checkTransactionsWave() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  console.log('🔍 ANALYSE DE LA TABLE transactions_wave:');

  try {
    // Structure de la table
    const [columns] = await connection.execute('DESCRIBE transactions_wave');
    console.log('\n📋 Structure de transactions_wave:');
    columns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type}) ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? `[${col.Key}]` : ''}`);
    });

    // Données d'exemple
    const [data] = await connection.execute('SELECT * FROM transactions_wave LIMIT 3');
    console.log('\n📊 Exemples de données:');
    data.forEach((row, i) => {
      console.log(`\n  ${i+1}. ${JSON.stringify(row, null, 2)}`);
    });

    // Statistiques
    const [stats] = await connection.execute(`
      SELECT 
        COUNT(*) as total_transactions,
        COUNT(DISTINCT prestataire_id) as prestataires_uniques,
        SUM(montant) as montant_total,
        GROUP_CONCAT(DISTINCT statut) as statuts_disponibles
      FROM transactions_wave
    `);
    
    console.log('\n📈 Statistiques:');
    console.log(`  - Total transactions: ${stats[0].total_transactions}`);
    console.log(`  - Prestataires uniques: ${stats[0].prestataires_uniques}`);
    console.log(`  - Montant total: ${stats[0].montant_total}`);
    console.log(`  - Statuts disponibles: ${stats[0].statuts_disponibles}`);

  } catch (e) {
    console.log('❌ Erreur:', e.message);
  }

  await connection.end();
}

checkTransactionsWave().catch(console.error);
