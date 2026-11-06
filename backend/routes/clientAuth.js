const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
require('dotenv').config();

// 1. INSCRIPTION CLIENT
router.post('/register', async (req, res) => {
  const { name, phone, password } = req.body;

  if (!name || !phone || !password) {
    return res.status(400).json({ message: 'Tous les champs sont obligatoires.' });
  }

  try {
    // Vérifier si le téléphone existe déjà
    const checkUser = await db.query('SELECT * FROM customers WHERE phone = $1', [phone]);
    if (checkUser.rows.length > 0) {
      return res.status(400).json({ message: 'Ce numéro de téléphone est déjà utilisé.' });
    }

    // Hacher le mot de passe
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insérer dans la base
    const result = await db.query(
      'INSERT INTO customers (name, phone, password) VALUES ($1, $2, $3) RETURNING id, name, phone, points',
      [name, phone, hashedPassword]
    );

    // Générer un token
    const token = jwt.sign(
      { id: result.rows[0].id, phone: result.rows[0].phone, name: result.rows[0].name },
      process.env.JWT_CLIENT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ message: 'Inscription réussie !', token, customer: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// 2. CONNEXION CLIENT
router.post('/login', async (req, res) => {
  const { phone, password } = req.body;

  try {
    const result = await db.query('SELECT * FROM customers WHERE phone = $1', [phone]);
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Numéro ou mot de passe incorrect.' });
    }

    const customer = result.rows[0];
    const validPassword = await bcrypt.compare(password, customer.password);
    if (!validPassword) {
      return res.status(401).json({ message: 'Numéro ou mot de passe incorrect.' });
    }

    const token = jwt.sign(
      { id: customer.id, phone: customer.phone, name: customer.name },
      process.env.JWT_CLIENT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ 
      message: 'Connexion réussie !', 
      token, 
      customer: { id: customer.id, name: customer.name, phone: customer.phone, points: customer.points } 
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// 3. VOIR SON PROFIL ET SES COMMANDES (Protégé)
router.get('/profile', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token manquant.' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_CLIENT_SECRET);
    
    // Récupérer les infos du client
    const userRes = await db.query('SELECT id, name, phone, points FROM customers WHERE id = $1', [decoded.id]);
    if (userRes.rows.length === 0) return res.status(404).json({ message: 'Utilisateur introuvable.' });

    // Récupérer ses commandes (via son numéro de téléphone)
    const ordersRes = await db.query(
      'SELECT id, total, status, created_at FROM orders WHERE phone = $1 ORDER BY created_at DESC',
      [decoded.phone]
    );

    res.json({ customer: userRes.rows[0], orders: ordersRes.rows });
  } catch (err) {
    res.status(403).json({ message: 'Session invalide ou expirée.' });
  }
});

module.exports = router;