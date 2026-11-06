const express = require('express');
const router = express.Router();
const db = require('../db');

// 1. VOIR LES AVIS D'UN PRODUIT (Public)
router.get('/:productId', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM reviews WHERE product_id = $1 ORDER BY created_at DESC',
      [req.params.productId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// 2. LAISSER UN AVIS (Public)
router.post('/', async (req, res) => {
  const { product_id, client_name, rating, comment } = req.body;
  
  if (!product_id || !client_name || !rating) {
    return res.status(400).json({ message: 'Veuillez remplir tous les champs obligatoires.' });
  }

  try {
    const result = await db.query(
      'INSERT INTO reviews (product_id, client_name, rating, comment) VALUES ($1, $2, $3, $4) RETURNING *',
      [product_id, client_name, rating, comment || null]
    );
    res.status(201).json({ message: 'Avis ajouté avec succès !', review: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

module.exports = router;