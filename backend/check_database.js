import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function checkDatabase() {
  try {
    // Connexion à la base de données avec vos paramètres
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 8889,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'root',
      database: process.env.DB_NAME || 'prestations_pwa'
    });

    console.log('✅ Connexion à la base de données réussie !');
    console.log(`📊 Base de données: ${process.env.DB_NAME}`);
    console.log('=' .repeat(50));

    // Lister toutes les tables
    const [tables] = await connection.execute('SHOW TABLES');
    console.log('📋 TABLES EXISTANTES:');
    tables.forEach((table, index) => {
      const tableName = Object.values(table)[0];
      console.log(`${index + 1}. ${tableName}`);
    });

    console.log('\n' + '=' .repeat(50));

    // Vérifier les tables spécifiques nécessaires pour l'admin
    const requiredTables = [
      'users', 'services', 'categories', 'sous_categories', 
      'reservations', 'avis', 'notifications', 
      'admin_logs', 'subscription_plans', 'subscriptions', 'app_settings'
    ];

    console.log('🔍 VÉRIFICATION DES TABLES REQUISES:');
    const existingTables = tables.map(table => Object.values(table)[0]);
    
    for (const table of requiredTables) {
      const exists = existingTables.includes(table);
      console.log(`${exists ? '✅' : '❌'} ${table} ${exists ? '(existe)' : '(MANQUANTE)'}`);
    }

    // Vérifier la structure des tables importantes
    console.log('\n' + '=' .repeat(50));
    console.log('🔧 STRUCTURE DES TABLES PRINCIPALES:');

    // Vérifier la table users
    if (existingTables.includes('users')) {
      console.log('\n👥 Table USERS:');
      const [userColumns] = await connection.execute('DESCRIBE users');
      userColumns.forEach(col => {
        console.log(`  - ${col.Field} (${col.Type}) ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'}`);
      });
    }

    // Vérifier la table avis
    if (existingTables.includes('avis')) {
      console.log('\n⭐ Table AVIS:');
      const [avisColumns] = await connection.execute('DESCRIBE avis');
      const hasModeration = avisColumns.some(col => col.Field === 'is_moderated');
      console.log(`  Colonnes de modération: ${hasModeration ? '✅ Présentes' : '❌ Manquantes'}`);
      
      if (!hasModeration) {
        console.log('  📝 Colonnes à ajouter: is_moderated, is_approved, moderation_reason, moderated_by, moderated_at');
      }
    }

    // Vérifier la table services
    if (existingTables.includes('services')) {
      console.log('\n📦 Table SERVICES:');
      const [serviceColumns] = await connection.execute('DESCRIBE services');
      const hasSoftDelete = serviceColumns.some(col => col.Field === 'deleted_at');
      console.log(`  Soft delete (deleted_at): ${hasSoftDelete ? '✅ Présent' : '❌ Manquant'}`);
    }

    // Vérifier la table categories
    if (existingTables.includes('categories')) {
      console.log('\n🏷️ Table CATEGORIES:');
      const [catColumns] = await connection.execute('DESCRIBE categories');
      const hasExtras = catColumns.some(col => col.Field === 'icone');
      console.log(`  Colonnes étendues (icone, couleur): ${hasExtras ? '✅ Présentes' : '❌ Manquantes'}`);
    }

    console.log('\n' + '=' .repeat(50));
    console.log('📋 RÉSUMÉ:');
    
    const missingTables = requiredTables.filter(table => !existingTables.includes(table));
    if (missingTables.length > 0) {
      console.log('❌ Tables manquantes:', missingTables.join(', '));
      console.log('💡 Exécutez le script SQL dans phpMyAdmin pour les créer');
    } else {
      console.log('✅ Toutes les tables requises sont présentes');
    }

    await connection.end();

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.log('\n💡 Vérifiez:');
    console.log('- Que MAMP/XAMPP est démarré');
    console.log('- Les paramètres dans le fichier .env');
    console.log('- Que la base de données existe');
  }
}

checkDatabase();
