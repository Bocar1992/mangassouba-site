// backend/utils/validate.js
// Petites fonctions de validation / nettoyage partagées par toutes les routes.

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Texte nettoyé : chaîne, sans espaces superflus, longueur maximale.
function cleanStr(value, max = 255) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

// Entier strictement positif (ou null)
function toId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n < 2147483647 ? n : null;
}

// Entier dans [min, max] (ou null)
function toInt(value, min = 0, max = 1000000) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

// Montant décimal dans [min, max] (ou null)
function toMoney(value, min = 0, max = 1e9) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n * 100) / 100 : null;
}

// ---- Téléphone ----
// On ne garde que les chiffres et un éventuel "+" initial.
function normalizePhone(value) {
  if (typeof value !== 'string') return '';
  const v = value.trim().replace(/[\s().-]/g, '');
  return /^\+?[0-9]{8,15}$/.test(v) ? v : '';
}

// Clé de comparaison : les 8 derniers chiffres (numéro mauritanien),
// ce qui rend équivalents "46432253", "+22246432253" et "00222 46 43 22 53".
function phoneKey(value) {
  const digits = typeof value === 'string' ? value.replace(/[^0-9]/g, '') : '';
  return digits.length >= 8 ? digits.slice(-8) : null;
}

// Même calcul côté SQL (pour comparer avec la colonne "phone")
const phoneKeySql = (col = 'phone') =>
  `RIGHT(REGEXP_REPLACE(COALESCE(${col}, ''), '[^0-9]', '', 'g'), 8)`;

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const isEmail = (v) => typeof v === 'string' && v.length <= 150 && EMAIL_RE.test(v.trim());

// bcrypt ne lit que les 72 premiers octets : on refuse au-delà
function checkPassword(pw) {
  if (typeof pw !== 'string' || pw.length < 8) return 'Le mot de passe doit contenir au moins 8 caractères.';
  if (Buffer.byteLength(pw, 'utf8') > 72) return 'Le mot de passe est trop long (72 caractères maximum).';
  return null;
}

// Lien autorisé : http(s), chemin relatif ou ancre. Bloque javascript:, data:, etc.
function safeLink(url) {
  if (typeof url !== 'string') return null;
  const u = url.trim();
  if (!u) return null;
  if (/^https?:\/\/[^\s]+$/i.test(u) || /^\/(?!\/)[^\s]*$/.test(u) || /^#[\w-]*$/.test(u)) return u.slice(0, 500);
  return null;
}

// items stockés en JSONB : parfois renvoyés en texte, parfois en objet
function parseJsonItems(value) {
  try {
    const v = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(v) ? v : [];
  } catch (e) {
    return [];
  }
}

const fmtMoney = (n) =>
  // Intl utilise des espaces insécables fines que la police PDF (Helvetica) ne sait pas afficher
  new Intl.NumberFormat('fr-FR').format(Number(n) || 0).replace(/[\u202f\u00a0]/g, ' ');

module.exports = {
  HttpError, cleanStr, toId, toInt, toMoney,
  normalizePhone, phoneKey, phoneKeySql,
  isEmail, checkPassword, safeLink, parseJsonItems, fmtMoney,
};
