import fs from 'fs/promises';

// Script pour corriger toutes les routes admin avec les vrais noms de colonnes
const fixes = [
  // Fichier admin-statistics.ts
  {
    file: 'src/routes/admin-statistics.ts',
    replacements: [
      // Il reste encore des anciennes références
      { from: "statut = 'terminee'", to: 'statut_id = 4' },
      { from: 'prix_total', to: 'prix_final' }
    ]
  },
  
  // Fichier admin-notifications.ts  
  {
    file: 'src/routes/admin-notifications.ts',
    replacements: [
      // Il reste encore created_at dans certaines requêtes
      { from: 'n.created_at', to: 'n.sent_at' },
      { from: 'created_at', to: 'sent_at' }
    ]
  },
  
  // Fichier admin-maintenance.ts
  {
    file: 'src/routes/admin-maintenance.ts',
    replacements: [
      // Il reste encore created_at pour notifications
      { from: 'created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)', to: 'sent_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)' }
    ]
  }
];

async function fixAllRoutes() {
  console.log('🔧 CORRECTION DE TOUTES LES ROUTES ADMIN...');
  
  for (const fileConfig of fixes) {
    try {
      console.log(`\n📝 Traitement de ${fileConfig.file}...`);
      
      let content = await fs.readFile(fileConfig.file, 'utf8');
      let totalChanges = 0;
      
      for (const replacement of fileConfig.replacements) {
        const regex = new RegExp(replacement.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        const matches = content.match(regex);
        
        if (matches) {
          content = content.replace(regex, replacement.to);
          totalChanges += matches.length;
          console.log(`  ✅ ${matches.length}x: ${replacement.from} → ${replacement.to}`);
        }
      }
      
      if (totalChanges > 0) {
        await fs.writeFile(fileConfig.file, content, 'utf8');
        console.log(`  💾 ${totalChanges} modifications sauvegardées`);
      } else {
        console.log(`  ℹ️  Aucune modification nécessaire`);
      }
      
    } catch (error) {
      console.error(`❌ Erreur avec ${fileConfig.file}:`, error.message);
    }
  }
  
  console.log('\n✅ CORRECTION TERMINÉE !');
  console.log('🚀 Redémarrez votre serveur backend pour voir vos vraies données');
}

fixAllRoutes().catch(console.error);
