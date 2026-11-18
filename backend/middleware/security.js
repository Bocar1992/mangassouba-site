// backend/middleware/security.js
// Limiteurs de débit (anti brute-force / anti spam / protection du quota IA).
const rateLimit = require('express-rate-limit');

const make = (windowMs, limit, message) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message, response: message },
  });

const MIN = 60 * 1000;

module.exports = {
  // Filet de sécurité global sur toute l'API
  apiLimiter: make(15 * MIN, 600, 'Trop de requêtes. Réessayez dans quelques minutes.'),
  // Connexions admin / client : 10 essais par 15 min et par IP
  loginLimiter: make(15 * MIN, 10, 'Trop de tentatives de connexion. Réessayez dans 15 minutes.'),
  registerLimiter: make(60 * MIN, 10, 'Trop d\'inscriptions depuis cette adresse. Réessayez plus tard.'),
  orderLimiter: make(60 * MIN, 20, 'Trop de commandes depuis cette adresse. Réessayez plus tard.'),
  trackLimiter: make(15 * MIN, 20, 'Trop de recherches. Réessayez dans quelques minutes.'),
  reviewLimiter: make(60 * MIN, 10, 'Trop d\'avis envoyés. Réessayez plus tard.'),
  promoLimiter: make(15 * MIN, 30, 'Trop de tentatives. Réessayez dans quelques minutes.'),
  aiChatLimiter: make(10 * MIN, 20, 'Vous envoyez trop de messages. Patientez quelques minutes ou appelez-nous au 00222 46 43 22 53.'),
  aiAdminLimiter: make(10 * MIN, 30, 'Trop de demandes à l\'IA. Réessayez dans quelques minutes.'),
};
