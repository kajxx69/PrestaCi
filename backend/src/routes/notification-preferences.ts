import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { pool } from '../db.js';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

const router = express.Router();

// Récupérer les préférences de notifications de l'utilisateur
router.get('/', requireAuth, async (req, res) => {
  try {
    const user_id = req.user!.id;

    const [preferences] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM user_notification_preferences WHERE user_id = ?`,
      [user_id]
    );

    if (preferences.length === 0) {
      // Créer les préférences par défaut si elles n'existent pas
      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO user_notification_preferences (user_id) VALUES (?)`,
        [user_id]
      );

      // Récupérer les préférences nouvellement créées
      const [newPreferences] = await pool.execute<RowDataPacket[]>(
        `SELECT * FROM user_notification_preferences WHERE user_id = ?`,
        [user_id]
      );

      return res.json(newPreferences[0]);
    }

    res.json(preferences[0]);

  } catch (error) {
    console.error('Erreur récupération préférences notifications:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Mettre à jour les préférences de notifications
router.put('/', requireAuth, async (req, res) => {
  try {
    const user_id = req.user!.id;
    const {
      push_enabled,
      email_enabled,
      sms_enabled,
      new_reservation,
      reservation_confirmed,
      reservation_cancelled,
      new_publication,
      new_like,
      new_comment,
      new_follower,
      promotions,
      tips
    } = req.body;

    // Vérifier si les préférences existent
    const [existing] = await pool.execute<RowDataPacket[]>(
      `SELECT id FROM user_notification_preferences WHERE user_id = ?`,
      [user_id]
    );

    if (existing.length === 0) {
      // Créer les préférences
      await pool.execute<ResultSetHeader>(
        `INSERT INTO user_notification_preferences (
          user_id, push_enabled, email_enabled, sms_enabled,
          new_reservation, reservation_confirmed, reservation_cancelled,
          new_publication, new_like, new_comment, new_follower,
          promotions, tips
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user_id, push_enabled, email_enabled, sms_enabled,
          new_reservation, reservation_confirmed, reservation_cancelled,
          new_publication, new_like, new_comment, new_follower,
          promotions, tips
        ]
      );
    } else {
      // Mettre à jour les préférences existantes
      await pool.execute(
        `UPDATE user_notification_preferences SET
          push_enabled = ?, email_enabled = ?, sms_enabled = ?,
          new_reservation = ?, reservation_confirmed = ?, reservation_cancelled = ?,
          new_publication = ?, new_like = ?, new_comment = ?, new_follower = ?,
          promotions = ?, tips = ?, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ?`,
        [
          push_enabled, email_enabled, sms_enabled,
          new_reservation, reservation_confirmed, reservation_cancelled,
          new_publication, new_like, new_comment, new_follower,
          promotions, tips, user_id
        ]
      );
    }

    // Récupérer les préférences mises à jour
    const [updatedPreferences] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM user_notification_preferences WHERE user_id = ?`,
      [user_id]
    );

    res.json({
      ok: true,
      message: 'Préférences mises à jour avec succès',
      preferences: updatedPreferences[0]
    });

  } catch (error) {
    console.error('Erreur mise à jour préférences notifications:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Réinitialiser les préférences aux valeurs par défaut
router.post('/reset', requireAuth, async (req, res) => {
  try {
    const user_id = req.user!.id;

    await pool.execute(
      `UPDATE user_notification_preferences SET
        push_enabled = 1, email_enabled = 1, sms_enabled = 0,
        new_reservation = 1, reservation_confirmed = 1, reservation_cancelled = 1,
        new_publication = 0, new_like = 0, new_comment = 0, new_follower = 0,
        promotions = 1, tips = 1, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ?`,
      [user_id]
    );

    // Récupérer les préférences réinitialisées
    const [resetPreferences] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM user_notification_preferences WHERE user_id = ?`,
      [user_id]
    );

    res.json({
      ok: true,
      message: 'Préférences réinitialisées aux valeurs par défaut',
      preferences: resetPreferences[0]
    });

  } catch (error) {
    console.error('Erreur réinitialisation préférences notifications:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
