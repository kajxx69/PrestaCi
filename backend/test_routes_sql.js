import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function testRoutesSql() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  console.log('🧪 TEST DES REQUÊTES SQL CORRIGÉES:');

  const tests = [
    {
      name: 'Statistiques générales',
      query: `
        SELECT 
          (SELECT COUNT(*) FROM users WHERE role_id = 1) as total_clients,
          (SELECT COUNT(*) FROM users WHERE role_id = 2) as total_prestataires,
          (SELECT COUNT(*) FROM services WHERE deleted_at IS NULL) as total_services,
          (SELECT COUNT(*) FROM reservations) as total_reservations,
          (SELECT COUNT(*) FROM reservations WHERE statut_id = 4) as reservations_terminees,
          (SELECT SUM(prix_final) FROM reservations WHERE statut_id = 4) as revenus_totaux,
          (SELECT AVG(note) FROM avis WHERE is_moderated = 1 AND is_approved = 1) as note_moyenne_globale,
          (SELECT COUNT(*) FROM avis WHERE is_moderated = 1 AND is_approved = 1) as total_avis_approuves
      `
    },
    {
      name: 'Notifications avec sent_at',
      query: `
        SELECT 
          n.*,
          u.nom as user_nom,
          u.email as user_email
        FROM notifications n
        LEFT JOIN users u ON n.user_id = u.id
        ORDER BY n.sent_at DESC
        LIMIT 5
      `
    },
    {
      name: 'Maintenance status',
      query: `
        SELECT 
          COUNT(*) as total_notifications,
          COUNT(CASE WHEN is_read = 0 THEN 1 END) as notifications_non_lues,
          COUNT(CASE WHEN sent_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR) THEN 1 END) as notifications_derniere_heure
        FROM notifications
      `
    }
  ];

  for (const test of tests) {
    try {
      console.log(`\n✅ ${test.name}:`);
      const [results] = await connection.execute(test.query);
      console.log('  Résultat:', JSON.stringify(results[0] || results.length + ' lignes', null, 2));
    } catch (error) {
      console.log(`❌ ${test.name}:`);
      console.log('  Erreur:', error.message);
    }
  }

  await connection.end();
  console.log('\n🎉 TEST TERMINÉ - Vos vraies données devraient maintenant apparaître !');
}

testRoutesSql().catch(console.error);
