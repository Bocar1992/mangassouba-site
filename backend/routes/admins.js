const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../db');
const { verifyAdmin, requireSuperAdmin } = require('../middleware/auth');
const { cleanStr, toId, isEmail, checkPassword } = require('../utils/validate');

const ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 12;
const ROLES = ['admin', 'superadmin'];

// Toute la gestion des comptes admin est réservée au Super Admin
router.use(verifyAdmin, requireSuperAdmin);

// 1. VOIR TOUS LES ADMINS
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT id, nom, email, role, created_at FROM admins ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ message: 'Erreur serveur.' }); }
});

// 2. CRÉER UN NOUVEL ADMIN
router.post('/', async (req, res) => {
  const nom = cleanStr(req.body.nom, 100);
  const email = cleanStr(req.body.email, 150).toLowerCase();
  const role = req.body.role || 'admin';
  const { password } = req.body;

  if (!nom || !email || !password) return res.status(400).json({ message: 'Champs obligatoires manquants.' });
  if (!isEmail(email)) return res.status(400).json({ message: 'Email invalide.' });
  if (!ROLES.includes(role)) return res.status(400).json({ message: 'Rôle invalide.' });
  const pwError = checkPassword(password);
  if (pwError) return res.status(400).json({ message: pwError });

  try {
    const check = await db.query('SELECT id FROM admins WHERE LOWER(email) = $1', [email]);
    if (check.rows.length > 0) return res.status(400).json({ message: 'Cet email est déjà utilisé.' });

    const hashedPassword = await bcrypt.hash(password, ROUNDS);
    const result = await db.query(
      'INSERT INTO admins (nom, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, nom, email, role',
      [nom, email, hashedPassword, role]
    );
    res.status(201).json({ message: 'Admin créé avec succès !', admin: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ message: 'Cet email est déjà utilisé.' });
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// 3. MODIFIER UN ADMIN
router.put('/:id', async (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Identifiant invalide.' });

  const nom = cleanStr(req.body.nom, 100);
  const email = cleanStr(req.body.email, 150).toLowerCase();
  const role = req.body.role || 'admin';
  const password = typeof req.body.password === 'string' ? req.body.password.trim() : '';

  if (!nom || !email) return res.status(400).json({ message: 'Nom et email obligatoires.' });
  if (!isEmail(email)) return res.status(400).json({ message: 'Email invalide.' });
  if (!ROLES.includes(role)) return res.status(400).json({ message: 'Rôle invalide.' });
  if (password) {
    const pwError = checkPassword(password);
    if (pwError) return res.status(400).json({ message: pwError });
  }

  // Le Super Admin principal (id 1) ne peut être modifié que par lui-même
  if (id === 1 && req.admin.id !== 1) {
    return res.status(403).json({ message: 'Seul le Super Admin principal peut modifier son propre compte.' });
  }
  // ...et il ne peut pas perdre son rôle (sinon plus personne ne gère les admins)
  if (id === 1 && role !== 'superadmin') {
    return res.status(400).json({ message: 'Le Super Admin principal doit rester Super Admin.' });
  }

  try {
    const dup = await db.query('SELECT id FROM admins WHERE LOWER(email) = $1 AND id <> $2', [email, id]);
    if (dup.rows.length > 0) return res.status(400).json({ message: 'Cet email est déjà utilisé.' });

    let result;
    if (password) {
      const hashedPassword = await bcrypt.hash(password, ROUNDS);
      result = await db.query(
        'UPDATE admins SET nom = $1, email = $2, role = $3, password = $4 WHERE id = $5 RETURNING id, nom, email, role',
        [nom, email, role, hashedPassword, id]
      );
    } else {
      result = await db.query(
        'UPDATE admins SET nom = $1, email = $2, role = $3 WHERE id = $4 RETURNING id, nom, email, role',
        [nom, email, role, id]
      );
    }
    if (result.rows.length === 0) return res.status(404).json({ message: 'Admin introuvable.' });
    res.json({ message: 'Admin modifié avec succès !', admin: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// 4. SUPPRIMER UN ADMIN
router.delete('/:id', async (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Identifiant invalide.' });
  if (id === 1) return res.status(403).json({ message: 'Impossible de supprimer le Super Admin principal.' });
  if (id === req.admin.id) return res.status(400).json({ message: 'Vous ne pouvez pas supprimer votre propre compte.' });

  try {
    await db.query('DELETE FROM admins WHERE id = $1', [id]);
    res.json({ message: 'Admin supprimé.' });
  } catch (err) { res.status(500).json({ message: 'Erreur serveur.' }); }
});

module.exports = router;
