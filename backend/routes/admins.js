const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../db');
const { verifyAdmin } = require('../middleware/auth');

// 1. VOIR TOUS LES ADMINS
router.get('/', verifyAdmin, async (req, res) => {
  try {
    const result = await db.query('SELECT id, nom, email, role, created_at FROM admins ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ message: 'Erreur serveur.' }); }
});

// 2. CRÉER UN NOUVEL ADMIN
router.post('/', verifyAdmin, async (req, res) => {
  const { nom, email, password, role } = req.body;
  if (!nom || !email || !password) return res.status(400).json({ message: 'Champs obligatoires manquants.' });

  try {
    const check = await db.query('SELECT * FROM admins WHERE email = $1', [email]);
    if (check.rows.length > 0) return res.status(400).json({ message: 'Cet email est déjà utilisé.' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const result = await db.query(
      'INSERT INTO admins (nom, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, nom, email, role',
      [nom, email, hashedPassword, role || 'admin']
    );
    res.status(201).json({ message: 'Admin créé avec succès !', admin: result.rows[0] });
  } catch (err) { res.status(500).json({ message: 'Erreur serveur.' }); }
});

// 3. MODIFIER UN ADMIN
router.put('/:id', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { nom, email, password, role } = req.body;

  try {
    let query = 'UPDATE admins SET nom = $1, email = $2, role = $3';
    let params = [nom, email, role, id];

    // Si un nouveau mot de passe est fourni, on le hash
    if (password && password.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      query += ', password = $4 WHERE id = $5 RETURNING id, nom, email, role';
      params = [nom, email, role, hashedPassword, id];
    } else {
      query += ' WHERE id = $4 RETURNING id, nom, email, role';
    }

    const result = await db.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Admin introuvable.' });
    res.json({ message: 'Admin modifié avec succès !', admin: result.rows[0] });
  } catch (err) { res.status(500).json({ message: 'Erreur serveur.' }); }
});

// 4. SUPPRIMER UN ADMIN
router.delete('/:id', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  // Empêcher de supprimer le tout premier superadmin (id=1) par sécurité
  if (id === '1') return res.status(403).json({ message: 'Impossible de supprimer le Super Admin principal.' });

  try {
    await db.query('DELETE FROM admins WHERE id = $1', [id]);
    res.json({ message: 'Admin supprimé.' });
  } catch (err) { res.status(500).json({ message: 'Erreur serveur.' }); }
});

module.exports = router;