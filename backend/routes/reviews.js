const express = require('express');
const router = express.Router();
const db = require('../db');
const { reviewLimiter } = require('../middleware/security');
const { cleanStr, toId, toInt } = require('../utils/validate');

// 1. VOIR LES AVIS D'UN PRODUIT (Public)
router.get('/:productId', async (req, res) => {
  const productId = toId(req.params.productId);
  if (!productId) return res.status(400).json({ message: 'Produit invalide.' });
  try {
    const result = await db.query(
      'SELECT id, client_name, rating, comment, created_at FROM reviews WHERE product_id = $1 ORDER BY created_at DESC LIMIT 100',
      [productId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// 2. LAISSER UN AVIS (Public, limité en débit)
router.post('/', reviewLimiter, async (req, res) => {
  const product_id = toId(req.body.product_id);
  const client_name = cleanStr(req.body.client_name, 100);
  const rating = toInt(req.body.rating, 1, 5);
  const comment = cleanStr(req.body.comment, 1000);

  if (!product_id || !client_name || !rating) {
    return res.status(400).json({ message: 'Veuillez remplir tous les champs obligatoires (note de 1 à 5).' });
  }

  try {
    const exists = await db.query('SELECT 1 FROM products WHERE id = $1', [product_id]);
    if (exists.rowCount === 0) return res.status(404).json({ message: 'Produit introuvable.' });

    const result = await db.query(
      'INSERT INTO reviews (product_id, client_name, rating, comment) VALUES ($1, $2, $3, $4) RETURNING id, client_name, rating, comment, created_at',
      [product_id, client_name, rating, comment || null]
    );
    res.status(201).json({ message: 'Avis ajouté avec succès !', review: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

module.exports = router;
