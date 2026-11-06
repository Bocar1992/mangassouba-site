const jwt = require('jsonwebtoken');
require('dotenv').config();

const verifyAdmin = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer TOKEN"

  if (!token) {
    return res.status(401).json({ message: 'Accès refusé. Vous devez être connecté.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded; // On sauvegarde les infos de l'admin
    next(); // On laisse passer
  } catch (error) {
    return res.status(403).json({ message: 'Session expirée ou invalide.' });
  }
};

module.exports = { verifyAdmin };