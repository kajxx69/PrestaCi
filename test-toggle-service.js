// Test pour le toggle de service (masquer/activer)
const API_URL = 'http://localhost:4000/api';

// Fonction pour faire des requêtes
async function makeRequest(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  // Récupérer le token depuis le localStorage simulé
  const authData = {
    email: 'prestataire.test@example.com',
    password: 'password123'
  };
  
  // Se connecter d'abord
  const loginResponse = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(authData),
    credentials: 'include'
  });
  
  const loginData = await loginResponse.json();
  const token = loginData.token;
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include'
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`);
  }
  
  return data;
}

// Test principal
async function testToggleService() {
  try {
    console.log('🔍 Test du toggle de service (masquer/activer)\n');
    
    // 1. Récupérer la liste des services
    console.log('1️⃣ Récupération des services...');
    const services = await makeRequest('/services');
    console.log(`Trouvé ${services.length} services:`);
    services.forEach(s => {
      console.log(`  - ID: ${s.id}, Nom: "${s.nom}", Actif: ${s.is_active}, Prestataire ID: ${s.prestataire_id}`);
    });
    
    // 2. Essayer de toggle le service ID 3
    console.log('\n2️⃣ Tentative de toggle du service ID 3...');
    try {
      const result = await makeRequest('/services/3', {
        method: 'PUT',
        body: JSON.stringify({ is_active: false })
      });
      console.log('✅ Service modifié avec succès');
    } catch (error) {
      console.log('❌ Erreur:', error.message);
      console.log('   → Ce service appartient probablement à un autre prestataire');
    }
    
    // 3. Créer un nouveau service et le toggle
    console.log('\n3️⃣ Création d\'un nouveau service pour tester le toggle...');
    const newService = await makeRequest('/services', {
      method: 'POST',
      body: JSON.stringify({
        nom: 'Service Test Toggle',
        description: 'Service pour tester le toggle',
        prix: 3000,
        duree_minutes: 30,
        sous_categorie_id: 1,
        devise: 'FCFA',
        is_active: true
      })
    });
    console.log('✅ Service créé avec ID:', newService.id);
    
    // 4. Toggle le nouveau service (désactiver)
    console.log('\n4️⃣ Désactivation du nouveau service...');
    await makeRequest(`/services/${newService.id}`, {
      method: 'PUT',
      body: JSON.stringify({ is_active: false })
    });
    console.log('✅ Service désactivé');
    
    // 5. Vérifier le statut
    console.log('\n5️⃣ Vérification du statut...');
    const updatedServices = await makeRequest('/services');
    const updatedService = updatedServices.find(s => s.id === newService.id);
    if (updatedService) {
      console.log(`✅ Service ID ${newService.id}: is_active = ${updatedService.is_active}`);
    }
    
    // 6. Toggle à nouveau (réactiver)
    console.log('\n6️⃣ Réactivation du service...');
    await makeRequest(`/services/${newService.id}`, {
      method: 'PUT',
      body: JSON.stringify({ is_active: true })
    });
    console.log('✅ Service réactivé');
    
    // 7. Nettoyer (supprimer le service de test)
    console.log('\n7️⃣ Nettoyage...');
    await makeRequest(`/services/${newService.id}`, {
      method: 'DELETE'
    });
    console.log('✅ Service de test supprimé');
    
    console.log('\n✨ Test terminé avec succès!');
    
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    process.exit(1);
  }
}

// Lancer le test
testToggleService().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('💥 Erreur fatale:', error);
  process.exit(1);
});
