const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { verifyClient } = require('../middleware/auth');
const { loginLimiter, registerLimiter } = require('../middleware/security');
const { cleanStr, normalizePhone, phoneKey, phoneKeySql, checkPassword } = require('../utils/validate');
require('dotenv').config();

const ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 12;
const DUMMY_HASH = bcrypt.hashSync('mot-de-passe-factice', 10);

const signToken = (c) => jwt.sign(
  { id: c.id, phone: c.phone, name: c.name },
  process.env.JWT_CLIENT_SECRET,
  { expiresIn: '7d', algorithm: 'HS256' }
);

// 1. INSCRIPTION CLIENT
router.post('/register', registerLimiter, async (req, res) => {
  const name = cleanStr(req.body.name, 100);
  const phone = normalizePhone(req.body.phone);
  const password = req.body.password;

  if (!name || !phone || !password) {
    return res.status(400).json({ message: 'Tous les champs sont obligatoires (téléphone valide : 8 à 15 chiffres).' });
  }
  const pwError = checkPassword(password);
  if (pwError) return res.status(400).json({ message: pwError });

  try {
    // Le numéro est comparé sur ses 8 derniers chiffres (46432253 = +22246432253)
    const checkUser = await db.query(`SELECT id FROM customers WHERE ${phoneKeySql('phone')} = $1`, [phoneKey(phone)]);
    if (checkUser.rows.length > 0) {
      return res.status(400).json({ message: 'Ce numéro de téléphone est déjà utilisé.' });
    }

    const hashedPassword = await bcrypt.hash(password, ROUNDS);
    const result = await db.query(
      'INSERT INTO customers (name, phone, password) VALUES ($1, $2, $3) RETURNING id, name, phone, points',
      [name, phone, hashedPassword]
    );

    res.status(201).json({ message: 'Inscription réussie !', token: signToken(result.rows[0]), customer: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ message: 'Ce numéro de téléphone est déjà utilisé.' });
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// 2. CONNEXION CLIENT
router.post('/login', loginLimiter, async (req, res) => {
  const key = phoneKey(typeof req.body.phone === 'string' ? req.body.phone : '');
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!key || !password || password.length > 200) {
    return res.status(401).json({ message: 'Numéro ou mot de passe incorrect.' });
  }

  try {
    const result = await db.query(`SELECT * FROM customers WHERE ${phoneKeySql('phone')} = $1`, [key]);
    const customer = result.rows[0];
    const validPassword = await bcrypt.compare(password, customer ? customer.password : DUMMY_HASH);

    if (!customer || !validPassword) {
      return res.status(401).json({ message: 'Numéro ou mot de passe incorrect.' });
    }

    res.json({
      message: 'Connexion réussie !',
      token: signToken(customer),
      customer: { id: customer.id, name: customer.name, phone: customer.phone, points: customer.points }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// 3. VOIR SON PROFIL ET SES COMMANDES (Protégé)
router.get('/profile', verifyClient, async (req, res) => {
  try {
    const userRes = await db.query('SELECT id, name, phone, points FROM customers WHERE id = $1', [req.customer.id]);
    if (userRes.rows.length === 0) return res.status(404).json({ message: 'Utilisateur introuvable.' });

    const customer = userRes.rows[0];
    const ordersRes = await db.query(
      `SELECT id, total, status, created_at FROM orders
       WHERE ${phoneKeySql('phone')} = $1 ORDER BY created_at DESC LIMIT 100`,
      [phoneKey(customer.phone)]
    );

    res.json({ customer, orders: ordersRes.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

module.exports = router;
