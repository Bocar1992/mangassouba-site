const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { verifyAdmin } = require('../middleware/auth'); // NOUVEAU
require('dotenv').config();

// CONNEXION ADMIN
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await db.query('SELECT * FROM admins WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect.' });
    }

    const admin = result.rows[0];
    const validPassword = await bcrypt.compare(password, admin.password);
    if (!validPassword) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect.' });
    }

    const token = jwt.sign(
      { id: admin.id, nom: admin.nom, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
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

// NOUVEAU : CHANGER SON PROPRE MOT DE PASSE (Admin connecté)
router.put('/change-password', verifyAdmin, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const adminId = req.admin.id; // Récupéré grâce au token JWT (verifyAdmin)

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ message: 'Veuillez fournir l\'ancien et le nouveau mot de passe.' });
  }

  try {
    // 1. Vérifier l'ancien mot de passe
    const result = await db.query('SELECT password FROM admins WHERE id = $1', [adminId]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Admin introuvable.' });

    const validPassword = await bcrypt.compare(oldPassword, result.rows[0].password);
    if (!validPassword) {
      return res.status(401).json({ message: 'L\'ancien mot de passe est incorrect.' });
    }

    // 2. Hacher le nouveau
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // 3. Mettre à jour
    await db.query('UPDATE admins SET password = $1 WHERE id = $2', [hashedPassword, adminId]);
    
    res.json({ message: 'Mot de passe modifié avec succès !' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

module.exports = router;