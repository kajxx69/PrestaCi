// Script de test pour la suppression de service
const BASE_URL = 'http://localhost:4000';

async function testDeleteService() {
  try {
    // 1. D'abord, se connecter comme prestataire
    console.log('1. Connexion en tant que prestataire...');
    const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        email: 'prestataire@test.com', // Remplacez par un email de prestataire valide
        password: 'password123' // Remplacez par le mot de passe
      })
    });
    
    if (!loginResponse.ok) {
      console.error('Erreur de connexion:', await loginResponse.text());
      return;
    }
    
    const loginData = await loginResponse.json();
    const token = loginData.token;
    console.log('Token JWT:', token);
    
    // 2. Récupérer la liste des services
    console.log('\n2. Récupération des services...');
    const servicesResponse = await fetch(`${BASE_URL}/api/services`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    });
    
    if (!servicesResponse.ok) {
      console.error('Erreur récupération services:', await servicesResponse.text());
      return;
    }
    
    const services = await servicesResponse.json();
    console.log('Services trouvés:', services);
    
    if (services.length === 0) {
      console.log('Aucun service à supprimer');
      return;
    }
    
    // 3. Tenter de supprimer le premier service
    const serviceToDelete = services[0];
    console.log(`\n3. Tentative de suppression du service ID ${serviceToDelete.id}: "${serviceToDelete.nom}"`);
    
    const deleteResponse = await fetch(`${BASE_URL}/api/services/${serviceToDelete.id}`, {
      method: 'DELETE',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    });
    
    console.log('Status de la réponse:', deleteResponse.status);
    const deleteResult = await deleteResponse.json();
    console.log('Résultat de la suppression:', deleteResult);
    
  } catch (error) {
    console.error('Erreur:', error);
  }
}

// Exécuter le test
testDeleteService();
