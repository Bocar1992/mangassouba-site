const express = require('express');
const router = express.Router();
const db = require('../db');

// Récupérer les zones de livraison
router.get('/delivery-zones', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM delivery_zones ORDER BY price ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// Vérifier un code promo
router.post('/promo', async (req, res) => {
  const { code } = req.body;
  try {
    const result = await db.query('SELECT * FROM promo_codes WHERE code = $1 AND is_active = true', [code]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Code promo invalide ou expiré.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

module.exports = router;