import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function testAdminStats() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  console.log('🧪 TEST DE LA ROUTE /api/admin/stats:');

  try {
    // Test des requêtes exactes de la route admin/stats
    console.log('\n1️⃣ Statistiques utilisateurs:');
    const [userStats] = await connection.query(`
      SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN role_id = 1 THEN 1 ELSE 0 END) as clients,
        SUM(CASE WHEN role_id = 2 THEN 1 ELSE 0 END) as prestataires,
        SUM(CASE WHEN role_id = 3 THEN 1 ELSE 0 END) as admins
      FROM users
    `);
    console.log(JSON.stringify(userStats[0], null, 2));

    console.log('\n2️⃣ Statistiques services:');
    const [serviceStats] = await connection.query(`
      SELECT 
        COUNT(*) as total_services,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as services_actifs
      FROM services
    `);
    console.log(JSON.stringify(serviceStats[0], null, 2));

    console.log('\n3️⃣ Statistiques réservations:');
    const [reservationStats] = await connection.query(`
      SELECT 
        COUNT(*) as total_reservations,
        SUM(CASE WHEN statut_id = 2 THEN 1 ELSE 0 END) as confirmees,
        SUM(CASE WHEN statut_id = 1 THEN 1 ELSE 0 END) as en_attente
      FROM reservations
    `);
    console.log(JSON.stringify(reservationStats[0], null, 2));

    console.log('\n4️⃣ Statistiques notifications:');
    const [notificationStats] = await connection.query(`
      SELECT 
        COUNT(*) as total_notifications,
        SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as non_lues
      FROM notifications
    `);
    console.log(JSON.stringify(notificationStats[0], null, 2));

    console.log('\n✅ RÉSULTAT FINAL (comme retourné par l\'API):');
    const result = {
      users: userStats[0],
      services: serviceStats[0],
      reservations: reservationStats[0],
      notifications: notificationStats[0],
      generated_at: new Date().toISOString()
    };
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }

  await connection.end();
}

testAdminStats().catch(console.error);
