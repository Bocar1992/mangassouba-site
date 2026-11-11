const express = require('express');
const router = express.Router();
const db = require('../db');
const { promoLimiter } = require('../middleware/security');
const { cleanStr } = require('../utils/validate');

// Récupérer les zones de livraison
router.get('/delivery-zones', async (req, res) => {
  try {
    const result = await db.query('SELECT id, name, price FROM delivery_zones ORDER BY price ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// Vérifier un code promo (insensible à la casse, limité en débit contre le "devinage" de codes)
router.post('/promo', promoLimiter, async (req, res) => {
  const code = cleanStr(req.body.code, 50);
  if (!code) return res.status(400).json({ message: 'Code promo manquant.' });
  try {
    const result = await db.query(
      'SELECT code, discount_percent FROM promo_codes WHERE UPPER(code) = UPPER($1) AND is_active = true',
      [code]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Code promo invalide ou expiré.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

module.exports = router;
