// Test pour vérifier l'isolation des services par prestataire
const API_URL = 'http://localhost:4000/api';

async function testServicesIsolation() {
  console.log('🔍 Test d\'isolation des services par prestataire\n');
  
  // Comptes de test
  const accounts = [
    { 
      email: 'john.doe@example.com', 
      password: 'password123',
      expectedServices: ['Service ID 3, 4, 5 (si prestataire ID 1)']
    },
    { 
      email: 'prestataire.test@example.com', 
      password: 'password123',
      expectedServices: ['Ses propres services uniquement']
    }
  ];
  
  for (const account of accounts) {
    console.log(`\n📋 Test avec: ${account.email}`);
    console.log('='.repeat(50));
    
    try {
      // 1. Connexion
      const loginResponse = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: account.email,
          password: account.password
        }),
        credentials: 'include'
      });
      
      if (!loginResponse.ok) {
        console.log(`❌ Impossible de se connecter avec ${account.email}`);
        continue;
      }
      
      const loginData = await loginResponse.json();
      const token = loginData.token;
      console.log(`✅ Connecté - User ID: ${loginData.user.id}`);
      
      // 2. Récupérer les infos du prestataire via /auth/me
      const meResponse = await fetch(`${API_URL}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });
      
      if (meResponse.ok) {
        const userData = await meResponse.json();
        console.log(`   Nom: ${userData.nom} ${userData.prenom}`);
        console.log(`   Rôle: ${userData.role_nom}`);
      }
      
      // 3. Récupérer les services
      const servicesResponse = await fetch(`${API_URL}/services`, {
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });
      
      if (!servicesResponse.ok) {
        const error = await servicesResponse.json();
        console.log(`❌ Erreur récupération services: ${error.error}`);
        continue;
      }
      
      const services = await servicesResponse.json();
      console.log(`\n📦 Services trouvés: ${services.length}`);
      
      if (services.length > 0) {
        console.log('Liste des services:');
        services.forEach(s => {
          console.log(`  - ID ${s.id}: "${s.nom}"`);
          console.log(`    Prestataire ID: ${s.prestataire_id}`);
          console.log(`    Prix: ${s.prix} ${s.devise}`);
          console.log(`    Actif: ${s.is_active ? '✅' : '❌'}`);
        });
        
        // Vérifier que tous les services ont le même prestataire_id
        const prestataireIds = [...new Set(services.map(s => s.prestataire_id))];
        if (prestataireIds.length === 1) {
          console.log(`\n✅ Tous les services appartiennent au prestataire ID: ${prestataireIds[0]}`);
        } else {
          console.log(`\n⚠️ PROBLÈME: Services de plusieurs prestataires: ${prestataireIds.join(', ')}`);
        }
      } else {
        console.log('⚠️ Aucun service trouvé pour ce prestataire');
        
        // Créer un service de test
        console.log('\n🔨 Création d\'un service de test...');
        try {
          const createResponse = await fetch(`${API_URL}/services`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              nom: `Service Test - ${account.email}`,
              description: 'Service créé automatiquement pour test',
              prix: 5000,
              duree_minutes: 60,
              sous_categorie_id: 1,
              devise: 'FCFA',
              is_active: true
            }),
            credentials: 'include'
          });
          
          if (createResponse.ok) {
            const newService = await createResponse.json();
            console.log(`✅ Service créé avec ID: ${newService.id}`);
            
            // Vérifier qu'il apparaît dans la liste
            const checkResponse = await fetch(`${API_URL}/services`, {
              headers: { 'Authorization': `Bearer ${token}` },
              credentials: 'include'
            });
            
            if (checkResponse.ok) {
              const updatedServices = await checkResponse.json();
              const found = updatedServices.find(s => s.id === newService.id);
              if (found) {
                console.log(`✅ Le nouveau service apparaît bien dans la liste`);
                console.log(`   Prestataire ID du service: ${found.prestataire_id}`);
              } else {
                console.log(`❌ Le nouveau service n'apparaît pas dans la liste`);
              }
            }
          } else {
            const error = await createResponse.json();
            console.log(`❌ Erreur création: ${error.error}`);
          }
        } catch (err) {
          console.log(`❌ Erreur: ${err.message}`);
        }
      }
      
    } catch (error) {
      console.error(`❌ Erreur pour ${account.email}:`, error.message);
    }
  }
  
  console.log('\n\n📊 Conclusion:');
  console.log('- Chaque prestataire doit voir UNIQUEMENT ses propres services');
  console.log('- Les services créés doivent apparaître immédiatement dans la liste');
  console.log('- Le prestataire_id doit être cohérent pour tous les services d\'un même utilisateur');
}

// Exécuter le test
testServicesIsolation().then(() => {
  console.log('\n✅ Test terminé');
  process.exit(0);
}).catch(error => {
  console.error('💥 Erreur:', error);
  process.exit(1);
});
