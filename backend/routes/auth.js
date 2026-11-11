const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { verifyAdmin } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/security');
const { cleanStr, checkPassword } = require('../utils/validate');
require('dotenv').config();

const ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 12;
// Hash factice : on fait toujours un bcrypt.compare, même si l'email n'existe pas,
// pour que le temps de réponse ne révèle pas quels emails sont des comptes admin.
const DUMMY_HASH = bcrypt.hashSync('mot-de-passe-factice', 10);

// CONNEXION ADMIN
router.post('/login', loginLimiter, async (req, res) => {
  const email = cleanStr(req.body.email, 150).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!email || !password || password.length > 200) {
    return res.status(400).json({ message: 'Email et mot de passe obligatoires.' });
  }

  try {
    const result = await db.query('SELECT * FROM admins WHERE LOWER(email) = $1', [email]);
    const admin = result.rows[0];
    const validPassword = await bcrypt.compare(password, admin ? admin.password : DUMMY_HASH);

    if (!admin || !validPassword) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect.' });
    }

    const token = jwt.sign(
      { id: admin.id, nom: admin.nom, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: '12h', algorithm: 'HS256' }
    );

    res.json({
      message: 'Connexion réussie !',
      token,
      admin: { id: admin.id, nom: admin.nom, email: admin.email, role: admin.role }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// CHANGER SON PROPRE MOT DE PASSE (Admin connecté)
router.put('/change-password', verifyAdmin, loginLimiter, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const adminId = req.admin.id;

  if (typeof oldPassword !== 'string' || typeof newPassword !== 'string' || !oldPassword || !newPassword) {
    return res.status(400).json({ message: 'Veuillez fournir l\'ancien et le nouveau mot de passe.' });
  }
  const pwError = checkPassword(newPassword);
  if (pwError) return res.status(400).json({ message: pwError });
  if (oldPassword === newPassword) {
    return res.status(400).json({ message: 'Le nouveau mot de passe doit être différent de l\'ancien.' });
  }

  try {
    const result = await db.query('SELECT password FROM admins WHERE id = $1', [adminId]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Admin introuvable.' });

    const validPassword = await bcrypt.compare(oldPassword, result.rows[0].password);
    if (!validPassword) {
      // 400 (et non 401) : un 401 déconnecterait l'admin côté interface
      return res.status(400).json({ message: 'L\'ancien mot de passe est incorrect.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, ROUNDS);
    await db.query('UPDATE admins SET password = $1 WHERE id = $2', [hashedPassword, adminId]);

    res.json({ message: 'Mot de passe modifié avec succès !' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

module.exports = router;
