import fs from 'fs/promises';
import path from 'path';

// Script pour adapter toutes les routes admin aux tables existantes
const replacements = [
  // Remplacer subscription_plans par plans_abonnement
  { from: 'subscription_plans', to: 'plans_abonnement' },
  
  // Remplacer subscriptions par transactions_wave avec adaptations
  { from: 'FROM subscriptions s', to: 'FROM transactions_wave s' },
  { from: 'JOIN subscriptions s', to: 'JOIN transactions_wave s' },
  { from: 'LEFT JOIN subscriptions s', to: 'LEFT JOIN transactions_wave s' },
  
  // Adapter les colonnes
  { from: 's.statut = \'actif\'', to: 's.statut = \'valide\'' },
  { from: 's.user_id', to: 's.prestataire_id' },
  
  // Adapter les noms de colonnes pour plans_abonnement
  { from: 'p.features', to: 'p.avantages' },
  { from: 'p.is_popular', to: 'p.mise_en_avant' },
];

const routeFiles = [
  'src/routes/admin-plans.ts',
  'src/routes/admin-statistics.ts'
];

async function updateRouteFiles() {
  console.log('🔄 Mise à jour des routes pour utiliser vos tables existantes...');
  
  for (const filePath of routeFiles) {
    try {
      console.log(`\n📝 Traitement de ${filePath}...`);
      
      let content = await fs.readFile(filePath, 'utf8');
      let changes = 0;
      
      for (const replacement of replacements) {
        const regex = new RegExp(replacement.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        const matches = content.match(regex);
        if (matches) {
          content = content.replace(regex, replacement.to);
          changes += matches.length;
          console.log(`  ✅ ${matches.length}x: ${replacement.from} → ${replacement.to}`);
        }
      }
      
      if (changes > 0) {
        await fs.writeFile(filePath, content, 'utf8');
        console.log(`  💾 ${changes} modifications sauvegardées`);
      } else {
        console.log(`  ℹ️  Aucune modification nécessaire`);
      }
      
    } catch (error) {
      console.error(`❌ Erreur avec ${filePath}:`, error.message);
    }
  }
  
  console.log('\n✅ Mise à jour terminée !');
  console.log('📋 Prochaines étapes:');
  console.log('1. Exécutez simple_fix_no_mapping.sql dans phpMyAdmin');
  console.log('2. Redémarrez votre serveur backend');
  console.log('3. Testez les routes admin');
}

updateRouteFiles().catch(console.error);
