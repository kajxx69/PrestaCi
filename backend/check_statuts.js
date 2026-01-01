import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function checkStatuts() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  console.log('📊 STATUTS DE RÉSERVATION:');
  try {
    const [statuts] = await connection.execute('SELECT * FROM statuts_reservation');
    statuts.forEach(s => console.log(`  ${s.id}: ${s.nom}`));
    
    console.log('\n📊 EXEMPLE RÉSERVATIONS:');
    const [reservations] = await connection.execute('SELECT statut_id, COUNT(*) as count FROM reservations GROUP BY statut_id LIMIT 5');
    reservations.forEach(r => console.log(`  statut_id ${r.statut_id}: ${r.count} réservations`));
    
  } catch (e) {
    console.log('Erreur:', e.message);
  }

  await connection.end();
}

checkStatuts().catch(console.error);
