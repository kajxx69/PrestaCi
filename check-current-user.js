// Script pour vérifier l'utilisateur actuellement connecté et ses services
const API_URL = 'http://localhost:4000/api';

async function checkCurrentUser() {
  console.log('🔍 Vérification de l\'utilisateur connecté et de ses services\n');
  
  // Simuler la récupération du token depuis le localStorage du navigateur
  console.log('⚠️  Pour tester avec votre session actuelle:');
  console.log('1. Ouvrez la console du navigateur (F12)');
  console.log('2. Exécutez: localStorage.getItem("prestaci-auth")');
  console.log('3. Copiez le token et utilisez-le ci-dessous\n');
  
  // Vous pouvez remplacer ce token par celui de votre session actuelle
  const YOUR_CURRENT_TOKEN = 'REMPLACEZ_PAR_VOTRE_TOKEN';
  
  if (YOUR_CURRENT_TOKEN === 'REMPLACEZ_PAR_VOTRE_TOKEN') {
    console.log('❌ Veuillez remplacer le token dans le script');
    console.log('   ou connectez-vous avec un compte de test:\n');
    
    // Se connecter avec le compte de test
    const testAccounts = [
      { email: 'john.doe@example.com', password: 'password123', role: 'Prestataire principal' },
      { email: 'prestataire.test@example.com', password: 'password123', role: 'Prestataire de test' }
    ];
    
    for (const account of testAccounts) {
      try {
        const response = await fetch(`${API_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(account),
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log(`\n📋 Compte: ${account.role}`);
          console.log(`   Email: ${account.email}`);
          console.log(`   User ID: ${data.user.id}`);
          
          // Récupérer les services
          const servicesResponse = await fetch(`${API_URL}/services`, {
            headers: { 'Authorization': `Bearer ${data.token}` },
            credentials: 'include'
          });
          
          if (servicesResponse.ok) {
            const services = await servicesResponse.json();
            console.log(`   Services: ${services.length}`);
            services.forEach(s => {
              console.log(`     - ID: ${s.id}, "${s.nom}", Actif: ${s.is_active ? '✅' : '❌'}`);
            });
          }
        }
      } catch (error) {
        console.log(`   ⚠️ Impossible de se connecter avec ${account.email}`);
      }
    }
  } else {
    // Utiliser le token fourni
    try {
      const meResponse = await fetch(`${API_URL}/auth/me`, {
        headers: { 'Authorization': `Bearer ${YOUR_CURRENT_TOKEN}` },
        credentials: 'include'
      });
      
      if (meResponse.ok) {
        const userData = await meResponse.json();
        console.log('✅ Utilisateur connecté:');
        console.log(`   ID: ${userData.id}`);
        console.log(`   Email: ${userData.email}`);
        console.log(`   Nom: ${userData.nom} ${userData.prenom}`);
        console.log(`   Rôle: ${userData.role_nom}`);
        
        // Récupérer les services
        const servicesResponse = await fetch(`${API_URL}/services`, {
          headers: { 'Authorization': `Bearer ${YOUR_CURRENT_TOKEN}` },
          credentials: 'include'
        });
        
        if (servicesResponse.ok) {
          const services = await servicesResponse.json();
          console.log(`\n📦 Vos services (${services.length}):`);
          services.forEach(s => {
            console.log(`   - ID: ${s.id}, "${s.nom}", Actif: ${s.is_active ? '✅' : '❌'}, Prestataire ID: ${s.prestataire_id}`);
          });
        }
      } else {
        console.log('❌ Token invalide ou expiré');
      }
    } catch (error) {
      console.error('❌ Erreur:', error.message);
    }
  }
  
  console.log('\n💡 Note: Vous ne pouvez modifier que VOS propres services.');
  console.log('   Les services ID 3, 4, 5 appartiennent au prestataire ID 1');
  console.log('   Le service ID 1 appartient au prestataire ID 3');
}

checkCurrentUser().catch(console.error);
