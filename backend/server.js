const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

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
const bannerRoutes = require('./routes/banners'); // NOUVEAU
const aiRoutes = require('./routes/ai'); // NOUVEAU

// --- UTILISATION DES ROUTES ---
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
app.use('/api/banners', bannerRoutes); // NOUVEAU
app.use('/api/ai', aiRoutes); // NOUVEAU
app.get('/api/test', (req, res) => {
  res.json({ message: "Bienvenue sur le serveur de Mangassouba et Fils !" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});