const jwt = require('jsonwebtoken');
require('dotenv').config();

const verifyAdmin = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Accès refusé. Token manquant.' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded; // Contient id, nom, role
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Token invalide ou expiré.' });
  }
};

// NOUVEAU : Vérifie si l'admin est un superadmin
const verifySuperAdmin = (req, res, next) => {
    verifyAdmin(req, res, () => {
        if (req.admin.role !== 'superadmin') {
            return res.status(403).json({ message: 'Accès refusé. Réservé au Super Administrateur.' });
        }
        next();
    });
};

const verifyClient = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Accès refusé. Token manquant.' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_CLIENT_SECRET);
    req.client = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Token client invalide ou expiré.' });
  }
};

module.exports = { verifyAdmin, verifySuperAdmin, verifyClient };