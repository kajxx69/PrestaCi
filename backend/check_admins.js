import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function checkAdmins() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  console.log('👑 VÉRIFICATION DES COMPTES ADMIN');

  try {
    // Lister tous les admins
    const [admins] = await connection.execute(`
      SELECT id, email, nom, prenom, is_active, created_at 
      FROM users 
      WHERE role_id = 3
      ORDER BY created_at DESC
    `);

    if (admins.length > 0) {
      console.log(`✅ ${admins.length} compte(s) admin trouvé(s) :`);
      admins.forEach((admin, index) => {
        console.log(`  ${index + 1}. ${admin.email} (${admin.nom} ${admin.prenom})`);
        console.log(`     - ID: ${admin.id}`);
        console.log(`     - Statut: ${admin.is_active ? '✅ Actif' : '❌ Inactif'}`);
        console.log(`     - Créé: ${admin.created_at}`);
        console.log('');
      });
      
      console.log('💡 POUR VOUS CONNECTER :');
      console.log('1. Allez sur http://localhost:5173');
      console.log('2. Utilisez un des emails ci-dessus');
      console.log('3. Si vous ne connaissez pas le mot de passe, modifiez-le dans phpMyAdmin');
      
    } else {
      console.log('❌ Aucun compte admin trouvé.');
      console.log('\n💡 SOLUTIONS :');
      console.log('1. Transformer un utilisateur existant en admin :');
      
      // Lister quelques utilisateurs existants
      const [users] = await connection.execute(`
        SELECT id, email, nom, prenom, role_id 
        FROM users 
        ORDER BY created_at DESC 
        LIMIT 5
      `);
      
      if (users.length > 0) {
        console.log('\n📋 Utilisateurs existants :');
        users.forEach(user => {
          const roleText = user.role_id === 1 ? 'Client' : user.role_id === 2 ? 'Prestataire' : 'Admin';
          console.log(`  - ${user.email} (${roleText})`);
        });
        
        console.log('\n🔧 Pour transformer un utilisateur en admin, exécutez dans phpMyAdmin :');
        console.log(`UPDATE users SET role_id = 3 WHERE email = 'EMAIL_DE_VOTRE_CHOIX';`);
      }
      
      console.log('\n2. Ou créer un nouveau compte admin via l\'inscription normale puis modifier le role_id');
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }

  await connection.end();
}

checkAdmins().catch(console.error);
