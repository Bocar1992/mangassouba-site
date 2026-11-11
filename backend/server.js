// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const isProd = process.env.NODE_ENV === 'production';

// ---------- Vérification de la configuration au démarrage ----------
for (const key of ['DATABASE_URL', 'JWT_SECRET', 'JWT_CLIENT_SECRET']) {
  if (!process.env[key]) {
    console.error(`❌ Variable d'environnement manquante : ${key}`);
    process.exit(1);
  }
}
if (process.env.JWT_SECRET === process.env.JWT_CLIENT_SECRET) {
  console.error('❌ JWT_SECRET et JWT_CLIENT_SECRET doivent être DIFFÉRENTS.');
  process.exit(1);
}
for (const key of ['JWT_SECRET', 'JWT_CLIENT_SECRET']) {
  if (process.env[key].length < 32) {
    const msg = `${key} est trop court (32 caractères minimum conseillés).`;
    if (isProd) { console.error('❌ ' + msg); process.exit(1); }
    console.warn('⚠️ ' + msg);
  }
}

const db = require('./db');
const { HttpError } = require('./utils/validate');
const { apiLimiter } = require('./middleware/security');

const app = express();
app.disable('x-powered-by');
// Render (et la plupart des hébergeurs) placent le serveur derrière un proxy :
// nécessaire pour que les limiteurs voient la vraie IP du visiteur.
app.set('trust proxy', process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) : 1);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS : en production, listez vos domaines dans CORS_ORIGINS
// ex : CORS_ORIGINS=https://www.monsite.com,https://monsite.netlify.app
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean);
if (allowedOrigins.length === 0) {
  console.warn('⚠️ CORS_ORIGINS non défini : toutes les origines sont acceptées. Définissez-le en production.');
}
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600,
}));

app.use(express.json({ limit: '100kb' }));
app.use('/api', apiLimiter);

// --- ROUTES ---
app.use('/api/auth', require('./routes/auth'));
app.use('/api/client-auth', require('./routes/clientAuth'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/utils', require('./routes/utils'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/admins', require('./routes/admins'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/accounting', require('./routes/accounting'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/banners', require('./routes/banners'));
app.use('/api/ai', require('./routes/ai'));

app.get('/api/test', (req, res) => {
  res.json({ message: "Bienvenue sur le serveur de Mangassouba et Fils !" });
});

// Utile pour un service de "ping" (UptimeRobot, etc.) qui évite l'endormissement de Render
app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(503).json({ status: 'db_error' });
  }
});

// --- 404 + gestion globale des erreurs ---
app.use('/api', (req, res) => res.status(404).json({ message: 'Route introuvable.' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
  if (err && err.name === 'MulterError') {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Fichier trop volumineux.' : 'Fichier invalide.';
    return res.status(400).json({ message: msg });
  }
  if (err && err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Requête invalide (JSON mal formé).' });
  if (err && err.type === 'entity.too.large') return res.status(413).json({ message: 'Requête trop volumineuse.' });
  console.error(err);
  res.status(500).json({ message: 'Erreur serveur.' });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});

// Arrêt propre (redéploiement Render)
process.on('SIGTERM', () => {
  server.close(() => db.pool.end().then(() => process.exit(0)));
});
