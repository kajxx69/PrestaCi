import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
dotenv.config();

async function createAdmin() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  console.log('👑 CRÉATION D\'UN COMPTE ADMIN');

  try {
    // Vérifier si un admin existe déjà
    const [existingAdmins] = await connection.execute(
      'SELECT COUNT(*) as count FROM users WHERE role_id = 3'
    );

    if (existingAdmins[0].count > 0) {
      console.log('✅ Un admin existe déjà. Voici les comptes admin :');
      const [admins] = await connection.execute(
        'SELECT id, email, nom, prenom, is_active FROM users WHERE role_id = 3'
      );
      admins.forEach(admin => {
        console.log(`  - ${admin.email} (${admin.nom} ${admin.prenom}) - ${admin.is_active ? 'Actif' : 'Inactif'}`);
      });
      
      console.log('\n💡 Vous pouvez vous connecter avec un de ces comptes.');
      console.log('💡 Ou modifier un utilisateur existant en admin avec :');
      console.log('   UPDATE users SET role_id = 3 WHERE email = "votre_email@example.com";');
    } else {
      // Créer un nouveau compte admin
      const email = 'admin@prestaci.com';
      const password = 'admin123';
      const hashedPassword = await bcrypt.hash(password, 10);

      await connection.execute(`
        INSERT INTO users (email, password_hash, role_id, nom, prenom, is_active, email_verified, created_at, updated_at) 
        VALUES (?, ?, 3, 'Admin', 'PrestaCI', 1, 1, NOW(), NOW())
      `, [email, hashedPassword]);

      console.log('✅ Compte admin créé avec succès !');
      console.log(`📧 Email: ${email}`);
      console.log(`🔑 Mot de passe: ${password}`);
      console.log('\n🚀 Vous pouvez maintenant vous connecter sur http://localhost:5173');
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }

  await connection.end();
}

createAdmin().catch(console.error);
