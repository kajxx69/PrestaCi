import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function checkTableStructures() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  console.log('🔍 VÉRIFICATION DES STRUCTURES DE TABLES PROBLÉMATIQUES:');

  try {
    // Vérifier table notifications
    console.log('\n📢 Table NOTIFICATIONS:');
    const [notifColumns] = await connection.execute('DESCRIBE notifications');
    notifColumns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type})`);
    });

    // Vérifier table reservations
    console.log('\n📅 Table RESERVATIONS:');
    const [resColumns] = await connection.execute('DESCRIBE reservations');
    resColumns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type})`);
    });

    // Vérifier quelques données pour voir les valeurs de statut
    console.log('\n📊 EXEMPLES DE DONNÉES:');
    
    try {
      const [resData] = await connection.execute('SELECT DISTINCT statut FROM reservations LIMIT 5');
      console.log('Statuts réservations:', resData.map(r => r.statut));
    } catch (e) {
      console.log('Erreur statuts réservations:', e.message);
    }

    try {
      const [notifData] = await connection.execute('SELECT * FROM notifications LIMIT 2');
      console.log('Exemple notifications:', notifData.length, 'lignes');
      if (notifData.length > 0) {
        console.log('Colonnes notifications:', Object.keys(notifData[0]));
      }
    } catch (e) {
      console.log('Erreur notifications:', e.message);
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }

  await connection.end();
}

checkTableStructures().catch(console.error);
