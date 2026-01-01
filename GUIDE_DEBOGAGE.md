# 🔧 Guide de Débogage - Dashboard Prestataire

## ✅ **Backend Vérifié - Fonctionne Parfaitement**

Le test d'authentification confirme que :
- ✅ Authentification backend opérationnelle
- ✅ Toutes les APIs protégées accessibles
- ✅ Cookies de session fonctionnels

## 🎯 **Problèmes Frontend Possibles**

### **1. Utilisateur Non Connecté**

**Symptômes :**
- Dashboard affiche encore des données mockées
- Erreurs 401 dans la console du navigateur
- Pas d'appels API visibles dans Network

**Solution :**
1. Ouvrir http://localhost:5173
2. **Se déconnecter** si déjà connecté
3. **S'inscrire** comme nouveau prestataire :
   ```
   Email: test@prestaci.com
   Mot de passe: password123
   Rôle: Prestataire
   Nom commercial: Mon Salon
   Ville: Abidjan
   Adresse: Cocody
   ```
4. **Vérifier** que la connexion est effective

### **2. Cache du Navigateur**

**Symptômes :**
- Modifications non visibles
- Anciennes données affichées
- Composants non mis à jour

**Solution :**
1. **Vider le cache** : `Ctrl+Shift+R` (ou `Cmd+Shift+R` sur Mac)
2. **Mode incognito** : Tester dans une fenêtre privée
3. **DevTools** : F12 → Network → "Disable cache"
4. **Hard refresh** : F12 → Clic droit sur refresh → "Empty Cache and Hard Reload"

### **3. Cache de Développement Vite**

**Symptômes :**
- Modifications du code non appliquées
- Serveur de dev ne recharge pas

**Solution :**
```bash
# Arrêter le serveur frontend
Ctrl+C

# Vider le cache Vite
rm -rf node_modules/.vite
rm -rf dist

# Redémarrer
npm run dev
```

### **4. Vérifications Console**

**Ouvrir F12 → Console et vérifier :**

**✅ Pas d'erreurs :**
```
✅ Pas d'erreurs 401/403
✅ Pas d'erreurs CORS
✅ Pas d'erreurs JavaScript
```

**✅ Appels API visibles (F12 → Network) :**
```
✅ GET /api/dashboard/stats
✅ GET /api/services
✅ GET /api/prestataire/reservations
```

**✅ Réponses correctes :**
```json
{
  "reservations_total": 0,
  "services_actifs": 0,
  "note_moyenne": 0,
  "revenus_mois": 0
}
```

## 🚀 **Test Rapide de Validation**

### **1. Créer un Service**
1. Aller dans l'onglet "Services"
2. Cliquer "Nouveau service"
3. Remplir le formulaire
4. **Vérifier** qu'il apparaît dans la liste

### **2. Vérifier les Statistiques**
1. Aller dans l'onglet "Dashboard"
2. **Vérifier** que "Services actifs" = 1
3. **Vérifier** que les données ne sont plus mockées

### **3. Test des Réservations**
1. Aller dans l'onglet "Réservations"
2. **Vérifier** que la liste se charge (même si vide)
3. **Tester** les filtres

## 🔍 **Débogage Avancé**

### **Vérifier l'État de l'Authentification**

**Console du navigateur :**
```javascript
// Vérifier les cookies
document.cookie

// Tester une API directement
fetch('/api/dashboard/stats', { credentials: 'include' })
  .then(r => r.json())
  .then(console.log)
```

### **Forcer le Rechargement des Composants**

**Si les modifications ne s'appliquent pas :**
1. Modifier légèrement un composant (ajouter un espace)
2. Sauvegarder
3. Vérifier que Vite recompile
4. Rafraîchir le navigateur

## 🎯 **Checklist de Résolution**

- [ ] Backend démarré sur :4000
- [ ] Frontend démarré sur :5173
- [ ] Utilisateur connecté comme prestataire
- [ ] Cache navigateur vidé
- [ ] Console sans erreurs
- [ ] Appels API visibles dans Network
- [ ] Données dynamiques (pas mockées)

## 🎉 **Résultat Attendu**

Après ces étapes, vous devriez voir :
- 📊 **Dashboard** avec statistiques à 0 (dynamiques)
- 🛠️ **Services** avec liste vide mais fonctionnelle
- 📅 **Réservations** avec liste vide mais filtres actifs
- 💳 **Plans** avec abonnement "Basique" actuel

**Si le problème persiste, le backend fonctionne parfaitement - c'est un problème de cache ou de session frontend !**
