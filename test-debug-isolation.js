// Test de la route de debug pour comprendre le problème d'isolation
const API_URL = 'http://localhost:4000/api';

async function testDebugIsolation() {
  console.log('🔍 Test de debug pour l\'isolation des services\n');
  
  // Se connecter avec le compte de test
  const loginResponse = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'prestataire.test@example.com',
      password: 'password123'
    }),
    credentials: 'include'
  });
  
  if (!loginResponse.ok) {
    console.log('❌ Impossible de se connecter');
    return;
  }
  
  const loginData = await loginResponse.json();
  const token = loginData.token;
  console.log(`✅ Connecté - User ID: ${loginData.user.id}\n`);
  
  // Appeler la route de debug
  console.log('📊 Appel de la route de debug /services/debug/my-services');
  console.log('='.repeat(60));
  
  const debugResponse = await fetch(`${API_URL}/services/debug/my-services`, {
    headers: { 'Authorization': `Bearer ${token}` },
    credentials: 'include'
  });
  
  if (!debugResponse.ok) {
    console.log('❌ Erreur lors de l\'appel de debug');
    return;
  }
  
  const debugData = await debugResponse.json();
  
  // Afficher les résultats de manière structurée
  console.log('\n👤 UTILISATEUR:');
  console.log(`   ID: ${debugData.user?.id}`);
  console.log(`   Email: ${debugData.user?.email}`);
  console.log(`   Nom: ${debugData.user?.nom} ${debugData.user?.prenom}`);
  
  console.log('\n🏢 PRESTATAIRE:');
  console.log(`   Trouvé: ${debugData.prestataire.found ? '✅' : '❌'}`);
  console.log(`   ID: ${debugData.prestataire.id || 'AUCUN'}`);
  console.log(`   Nom commercial: ${debugData.prestataire.nom_commercial || 'N/A'}`);
  
  console.log('\n📦 MES SERVICES (requête filtrée):');
  console.log(`   Nombre: ${debugData.myServices.count}`);
  console.log(`   Requête SQL: ${debugData.myServices.query}`);
  console.log(`   Prestataire ID utilisé: ${debugData.myServices.prestataireIdUsed}`);
  
  if (debugData.myServices.services.length > 0) {
    console.log('   Liste:');
    debugData.myServices.services.forEach(s => {
      console.log(`     - ID ${s.id}: "${s.nom}"`);
      console.log(`       Prestataire ID: ${s.prestataire_id} ${s.prestataire_id === debugData.prestataire.id ? '✅' : '❌ PROBLÈME!'}`);
    });
  } else {
    console.log('   ⚠️ Aucun service trouvé');
  }
  
  console.log('\n🗄️ TOUS LES SERVICES EN BASE:');
  debugData.allServicesInDB.forEach(s => {
    console.log(`   - ID ${s.id}: "${s.nom}" (Prestataire ${s.prestataire_id})`);
  });
  
  console.log('\n🔍 ANALYSE:');
  console.log(`   Isolation correcte: ${debugData.analysis.correctIsolation ? '✅' : '❌'}`);
  if (debugData.analysis.problemServices.length > 0) {
    console.log(`   ⚠️ Services problématiques: ${debugData.analysis.problemServices.join(', ')}`);
  }
  
  // Maintenant, comparer avec la route normale /services
  console.log('\n\n📋 Comparaison avec la route normale /services');
  console.log('='.repeat(60));
  
  const servicesResponse = await fetch(`${API_URL}/services`, {
    headers: { 'Authorization': `Bearer ${token}` },
    credentials: 'include'
  });
  
  if (servicesResponse.ok) {
    const services = await servicesResponse.json();
    console.log(`Nombre de services retournés: ${services.length}`);
    
    if (services.length > 0) {
      // Vérifier si les services correspondent
      const serviceIds = services.map(s => s.id).sort();
      const debugServiceIds = debugData.myServices.services.map(s => s.id).sort();
      
      console.log(`IDs route normale: [${serviceIds.join(', ')}]`);
      console.log(`IDs route debug: [${debugServiceIds.join(', ')}]`);
      
      if (JSON.stringify(serviceIds) === JSON.stringify(debugServiceIds)) {
        console.log('✅ Les deux routes retournent les mêmes services');
      } else {
        console.log('❌ INCOHÉRENCE! Les routes retournent des services différents');
        
        // Identifier les différences
        const onlyInNormal = serviceIds.filter(id => !debugServiceIds.includes(id));
        const onlyInDebug = debugServiceIds.filter(id => !serviceIds.includes(id));
        
        if (onlyInNormal.length > 0) {
          console.log(`   Services uniquement dans /services: ${onlyInNormal.join(', ')}`);
        }
        if (onlyInDebug.length > 0) {
          console.log(`   Services uniquement dans /debug: ${onlyInDebug.join(', ')}`);
        }
      }
    }
  }
  
  console.log('\n💡 DIAGNOSTIC:');
  if (!debugData.prestataire.found) {
    console.log('❌ PROBLÈME: Aucun prestataire trouvé pour cet utilisateur!');
    console.log('   Solution: Créer un profil prestataire pour cet utilisateur');
  } else if (debugData.myServices.count === 0) {
    console.log('⚠️ Le prestataire existe mais n\'a aucun service');
    console.log('   Solution: Créer des services pour ce prestataire');
  } else if (!debugData.analysis.correctIsolation) {
    console.log('❌ PROBLÈME CRITIQUE: Des services d\'autres prestataires sont retournés!');
    console.log('   Vérifier la requête SQL et les données en base');
  } else {
    console.log('✅ Tout semble correct');
  }
}

// Exécuter le test
testDebugIsolation().then(() => {
  console.log('\n✅ Test terminé');
  process.exit(0);
}).catch(error => {
  console.error('💥 Erreur:', error);
  process.exit(1);
});
