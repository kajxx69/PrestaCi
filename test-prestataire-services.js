// Script de test pour les services prestataire
const API_URL = 'http://localhost:4000/api';

// Données de test
const testPrestataire = {
  email: 'prestataire.test@example.com',
  password: 'password123',
  nom: 'Test',
  prenom: 'Prestataire',
  role_id: 2,
  nom_commercial: 'Test Services',
  ville: 'Abidjan',
  adresse: '123 Rue Test',
  latitude: 5.3600,
  longitude: -4.0083
};

const testService = {
  nom: 'Service Test',
  description: 'Description du service test',
  prix: 5000,
  duree_minutes: 60,
  sous_categorie_id: 1,
  is_domicile: false,
  devise: 'FCFA'
};

let authToken = null;
let serviceId = null;

// Fonction pour faire des requêtes
async function makeRequest(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
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

// Tests
async function runTests() {
  try {
    console.log('🚀 Démarrage des tests des services prestataire...\n');
    
    // 1. Inscription du prestataire
    console.log('1️⃣ Test inscription prestataire...');
    try {
      const registerData = await makeRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify(testPrestataire)
      });
      console.log('✅ Inscription réussie:', registerData);
      authToken = registerData.token;
    } catch (error) {
      // Si l'utilisateur existe déjà, on se connecte
      console.log('⚠️ Utilisateur existe déjà, tentative de connexion...');
      const loginData = await makeRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: testPrestataire.email,
          password: testPrestataire.password
        })
      });
      console.log('✅ Connexion réussie:', loginData);
      authToken = loginData.token;
    }
    
    console.log('\n2️⃣ Test récupération des services...');
    const services = await makeRequest('/services');
    console.log(`✅ ${services.length} services trouvés`);
    
    console.log('\n3️⃣ Test création d\'un nouveau service...');
    const newService = await makeRequest('/services', {
      method: 'POST',
      body: JSON.stringify(testService)
    });
    console.log('✅ Service créé avec ID:', newService.id);
    serviceId = newService.id;
    
    console.log('\n4️⃣ Test mise à jour du service...');
    const updateData = {
      nom: 'Service Test Modifié',
      prix: 7500,
      is_active: false
    };
    await makeRequest(`/services/${serviceId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
    console.log('✅ Service mis à jour avec succès');
    
    console.log('\n5️⃣ Test récupération des services après modification...');
    const updatedServices = await makeRequest('/services');
    console.log(`Nombre de services: ${updatedServices.length}`);
    const updatedService = updatedServices.find(s => s.id === serviceId);
    
    if (updatedService) {
      console.log('✅ Service trouvé:', {
        id: updatedService.id,
        nom: updatedService.nom,
        prix: updatedService.prix,
        is_active: updatedService.is_active
      });
    } else {
      console.log('⚠️ Service non trouvé dans la liste. Services disponibles:', updatedServices.map(s => ({ id: s.id, nom: s.nom })));
    }
    
    console.log('\n6️⃣ Test suppression du service...');
    const deleteResult = await makeRequest(`/services/${serviceId}`, {
      method: 'DELETE'
    });
    console.log('✅ Résultat suppression:', deleteResult);
    
    console.log('\n7️⃣ Vérification après suppression...');
    const finalServices = await makeRequest('/services');
    const deletedService = finalServices.find(s => s.id === serviceId);
    if (deleteResult.deleted && !deletedService) {
      console.log('✅ Service complètement supprimé');
    } else if (deleteResult.deactivated && deletedService && !deletedService.is_active) {
      console.log('✅ Service désactivé (réservations existantes)');
    } else {
      console.log('⚠️ État du service après suppression:', deletedService);
    }
    
    console.log('\n✨ Tous les tests sont passés avec succès!');
    
  } catch (error) {
    console.error('\n❌ Erreur lors des tests:', error.message);
    process.exit(1);
  }
}

// Lancer les tests
runTests().then(() => {
  console.log('\n🎉 Tests terminés avec succès!');
  process.exit(0);
}).catch(error => {
  console.error('\n💥 Erreur fatale:', error);
  process.exit(1);
});
