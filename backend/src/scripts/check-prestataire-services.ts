import { pool } from '../db.js';

async function checkPrestataireServices() {
  try {
    console.log('=== Vérification des services et prestataires ===\n');
    
    // 1. Lister tous les prestataires avec leurs users
    const [prestataires]: any = await pool.query(`
      SELECT 
        p.id as prestataire_id,
        p.user_id,
        u.email,
        u.nom,
        u.prenom,
        COUNT(s.id) as nombre_services
      FROM prestataires p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN services s ON s.prestataire_id = p.id
      GROUP BY p.id, p.user_id, u.email, u.nom, u.prenom
      ORDER BY p.id
    `);
    
    console.log('Prestataires trouvés:');
    console.table(prestataires);
    
    // 2. Vérifier s'il y a des services orphelins
    const [orphanServices]: any = await pool.query(`
      SELECT 
        s.id,
        s.nom,
        s.prestataire_id,
        s.created_at
      FROM services s
      LEFT JOIN prestataires p ON s.prestataire_id = p.id
      WHERE p.id IS NULL
    `);
    
    if (orphanServices.length > 0) {
      console.log('\n⚠️ Services orphelins (sans prestataire valide):');
      console.table(orphanServices);
    } else {
      console.log('\n✅ Aucun service orphelin');
    }
    
    // 3. Vérifier les doublons de prestataires (même user_id)
    const [duplicates]: any = await pool.query(`
      SELECT 
        user_id,
        COUNT(*) as count,
        GROUP_CONCAT(id) as prestataire_ids
      FROM prestataires
      GROUP BY user_id
      HAVING count > 1
    `);
    
    if (duplicates.length > 0) {
      console.log('\n⚠️ Utilisateurs avec plusieurs profils prestataires:');
      console.table(duplicates);
    } else {
      console.log('\n✅ Aucun doublon de prestataire');
    }
    
    // 4. Afficher les services par prestataire
    for (const prestataire of prestataires) {
      if (prestataire.nombre_services > 0) {
        const [services]: any = await pool.query(
          'SELECT id, nom, is_active, created_at FROM services WHERE prestataire_id = ?',
          [prestataire.prestataire_id]
        );
        console.log(`\nServices du prestataire ${prestataire.email} (ID: ${prestataire.prestataire_id}):`);
        console.table(services);
      }
    }
    
  } catch (error) {
    console.error('Erreur:', error);
  } finally {
    await pool.end();
  }
}

checkPrestataireServices();
