import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function checkMissingColumns() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  console.log('🔍 VÉRIFICATION DES COLONNES MANQUANTES:');

  try {
    // Vérifier table avis
    console.log('\n⭐ Table AVIS:');
    const [avisColumns] = await connection.execute('DESCRIBE avis');
    const avisColumnNames = avisColumns.map(col => col.Field);
    
    const requiredAvisColumns = ['is_moderated', 'is_approved', 'moderation_reason', 'moderated_by', 'moderated_at'];
    requiredAvisColumns.forEach(col => {
      const exists = avisColumnNames.includes(col);
      console.log(`  ${exists ? '✅' : '❌'} ${col} ${exists ? '(existe)' : '(MANQUANTE)'}`);
    });

    // Vérifier table services
    console.log('\n📦 Table SERVICES:');
    const [serviceColumns] = await connection.execute('DESCRIBE services');
    const serviceColumnNames = serviceColumns.map(col => col.Field);
    
    const hasDeletedAt = serviceColumnNames.includes('deleted_at');
    console.log(`  ${hasDeletedAt ? '✅' : '❌'} deleted_at ${hasDeletedAt ? '(existe)' : '(MANQUANTE)'}`);

    // Vérifier table sous_categories
    console.log('\n🏷️ Table SOUS_CATEGORIES:');
    const [scColumns] = await connection.execute('DESCRIBE sous_categories');
    const scColumnNames = scColumns.map(col => col.Field);
    
    const hasIsActive = scColumnNames.includes('is_active');
    console.log(`  ${hasIsActive ? '✅' : '❌'} is_active ${hasIsActive ? '(existe)' : '(MANQUANTE)'}`);

    // Vérifier table admin_logs
    console.log('\n📋 Table ADMIN_LOGS:');
    try {
      const [adminLogsColumns] = await connection.execute('DESCRIBE admin_logs');
      console.log(`  ✅ admin_logs existe avec ${adminLogsColumns.length} colonnes`);
    } catch (e) {
      console.log(`  ❌ admin_logs MANQUANTE`);
    }

    // Générer le script SQL nécessaire
    console.log('\n' + '='.repeat(50));
    console.log('📝 SCRIPT SQL À EXÉCUTER:');
    console.log('='.repeat(50));

    let sqlScript = '';

    // Admin logs si manquante
    try {
      await connection.execute('DESCRIBE admin_logs');
    } catch (e) {
      sqlScript += `
-- Créer la table admin_logs
CREATE TABLE \`admin_logs\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`admin_id\` int(11) NOT NULL,
  \`action\` varchar(100) NOT NULL,
  \`target_type\` varchar(50) NOT NULL,
  \`target_id\` int(11) NOT NULL,
  \`details\` json DEFAULT NULL,
  \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_admin_logs_admin_id\` (\`admin_id\`),
  KEY \`idx_admin_logs_created_at\` (\`created_at\`),
  KEY \`idx_admin_logs_action\` (\`action\`),
  FOREIGN KEY (\`admin_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;
    }

    // Colonnes avis manquantes
    const missingAvisColumns = requiredAvisColumns.filter(col => !avisColumnNames.includes(col));
    if (missingAvisColumns.length > 0) {
      sqlScript += `
-- Ajouter colonnes manquantes à la table avis
ALTER TABLE \`avis\``;
      missingAvisColumns.forEach((col, index) => {
        const columnDef = {
          'is_moderated': 'tinyint(1) NOT NULL DEFAULT 0',
          'is_approved': 'tinyint(1) NOT NULL DEFAULT 1', 
          'moderation_reason': 'text DEFAULT NULL',
          'moderated_by': 'int(11) DEFAULT NULL',
          'moderated_at': 'timestamp NULL DEFAULT NULL'
        };
        sqlScript += `${index === 0 ? ' ' : ','}
ADD COLUMN \`${col}\` ${columnDef[col]}`;
      });
      sqlScript += ';\n';
    }

    // Colonne services manquante
    if (!hasDeletedAt) {
      sqlScript += `
-- Ajouter deleted_at à la table services
ALTER TABLE \`services\` 
ADD COLUMN \`deleted_at\` timestamp NULL DEFAULT NULL;
`;
    }

    // Mise à jour des données
    sqlScript += `
-- Marquer tous les avis existants comme modérés
UPDATE \`avis\` SET 
  \`is_moderated\` = 1, 
  \`is_approved\` = 1, 
  \`moderated_at\` = \`created_at\`
WHERE \`is_moderated\` = 0;

-- Ajouter paramètres app_settings
INSERT IGNORE INTO \`app_settings\` (\`key_name\`, \`value\`, \`description\`) VALUES
('maintenance_mode', '0', 'Mode maintenance activé/désactivé'),
('site_name', 'PrestaCI', 'Nom du site'),
('commission_rate', '5.0', 'Taux de commission par défaut (%)'),
('currency', 'FCFA', 'Devise par défaut');
`;

    if (sqlScript.trim()) {
      console.log(sqlScript);
    } else {
      console.log('✅ AUCUNE MODIFICATION NÉCESSAIRE - Toutes les colonnes existent déjà !');
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }

  await connection.end();
}

checkMissingColumns().catch(console.error);
