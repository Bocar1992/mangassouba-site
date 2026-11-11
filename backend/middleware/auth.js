// backend/middleware/auth.js
const jwt = require('jsonwebtoken');
const db = require('../db');
require('dotenv').config();

function getToken(req) {
  const header = req.headers['authorization'];
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

// ---------- ADMIN ----------
// Vérifie le token ET que le compte existe toujours (un admin supprimé perd
// l'accès immédiatement) et relit son rôle en base (pas celui du token).
const verifyAdmin = async (req, res, next) => {
  const token = getToken(req);
  if (!token) {
    return res.status(401).json({ message: 'Accès refusé. Vous devez être connecté.' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch (error) {
    return res.status(401).json({ message: 'Session expirée ou invalide.' });
  }

  try {
    const result = await db.query('SELECT id, nom, email, role FROM admins WHERE id = $1', [decoded.id]);
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Compte introuvable. Veuillez vous reconnecter.' });
    }
    const a = result.rows[0];
    req.admin = {
      id: a.id,
      nom: a.nom,
      email: a.email,
      role: a.role,
      // Le tout premier compte (id 1) est toujours super admin
      isSuper: a.role === 'superadmin' || a.id === 1,
    };
    next();
  } catch (err) {
    console.error('verifyAdmin:', err.message);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
};

// À placer APRÈS verifyAdmin
const requireSuperAdmin = (req, res, next) => {
  if (!req.admin || !req.admin.isSuper) {
    return res.status(403).json({ message: 'Action réservée au Super Admin.' });
  }
  next();
};

// ---------- CLIENT ----------
const verifyClient = (req, res, next) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ message: 'Token manquant.' });
  try {
    req.customer = jwt.verify(token, process.env.JWT_CLIENT_SECRET, { algorithms: ['HS256'] });
    next();
  } catch (err) {
    res.status(401).json({ message: 'Session invalide ou expirée.' });
  }
};

// Client connecté si possible, sinon on continue en invité
const optionalClient = (req, res, next) => {
  req.customer = null;
  const token = getToken(req);
  if (token) {
    try {
      req.customer = jwt.verify(token, process.env.JWT_CLIENT_SECRET, { algorithms: ['HS256'] });
    } catch (err) { /* invité */ }
  }
  next();
};

module.exports = { verifyAdmin, requireSuperAdmin, verifyClient, optionalClient };
