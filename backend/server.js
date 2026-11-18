const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const db = require('./db');

const app = express();

// SÉCURITÉ : Protège les en-têtes HTTP (empêche le clickjacking, le sniffing MIME, etc.)
app.use(helmet());

// SÉCURITÉ : Restreindre les origines (CORS)
// En production, on n'autorise que ton site Render et le localhost pour le dev
const originesAutorisees = [
    'https://mangassouba-frontend.onrender.com',
    'http://localhost:5500',
    'http://127.0.0.1:5500'
];
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || originesAutorisees.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Bloqué par la politique CORS de sécurité.'));
        }
    }
}));

app.use(express.json());

// SÉCURITÉ : Limiter les tentatives de connexion (Anti Brute-Force)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Maximum 10 tentatives par IP toutes les 15 min
    message: { message: "Trop de tentatives de connexion. Veuillez réessayer dans 15 minutes." }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/client-auth/login', authLimiter);

// SÉCURITÉ : Limiter l'utilisation de l'IA pour éviter le spam
const aiLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 heure
    max: 30, // Maximum 30 messages par heure
    message: { response: "Vous avez atteint la limite de messages avec l'assistant. Réessayez plus tard." }
});
app.use('/api/ai/chat', aiLimiter);


// --- NOS ROUTES ---
const authRoutes = require('./routes/auth');
const clientAuthRoutes = require('./routes/clientAuth');
const categoryRoutes = require('./routes/categories');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const utilsRoutes = require('./routes/utils');
const statsRoutes = require('./routes/stats');
const adminRoutes = require('./routes/admins');
const customerRoutes = require('./routes/customers');
const accountingRoutes = require('./routes/accounting');
const reviewRoutes = require('./routes/reviews');
const bannerRoutes = require('./routes/banners');
const aiRoutes = require('./routes/ai');

app.use('/api/auth', authRoutes);
app.use('/api/client-auth', clientAuthRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/utils', utilsRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/admins', adminRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/accounting', accountingRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/ai', aiRoutes);

app.get('/api/test', (req, res) => {
  res.json({ message: "Bienvenue sur le serveur de Mangassouba et Fils !" });
});

// Gestion globale des erreurs (pour ne pas exposer les traces du serveur)
app.use((err, req, res, next) => {
    console.error("Erreur interceptée :", err.message);
    if (err.message.includes('CORS')) {
        return res.status(403).json({ message: "Accès refusé par la sécurité." });
    }
    res.status(500).json({ message: "Une erreur interne est survenue." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Serveur sécurisé démarré sur http://localhost:${PORT}`);
});