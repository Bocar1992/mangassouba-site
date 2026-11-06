const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyAdmin } = require('../middleware/auth');

// 1. VOIR TOUS LES CLIENTS
router.get('/', verifyAdmin, async (req, res) => {
  try {
    const result = await db.query('SELECT id, name, phone, email, points, created_at FROM customers ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ message: 'Erreur serveur.' }); }
});

// 2. SUPPRIMER UN CLIENT
router.delete('/:id', verifyAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM customers WHERE id = $1', [req.params.id]);
    res.json({ message: 'Client supprimé.' });
  } catch (err) { res.status(500).json({ message: 'Erreur serveur.' }); }
});

module.exports = router;