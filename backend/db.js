// backend/db.js
require('dotenv').config();
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL manquant dans le fichier .env');
  process.exit(1);
}

// On vérifie si on est en ligne (sur Render) ou en local (sur ton PC)
// Si l'URL contient "render.com", on active le SSL. Sinon, on le désactive.
const isProduction = process.env.DATABASE_URL.includes('render.com');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
});

// Test de connexion au démarrage
pool.connect()
  .then(client => {
    console.log('✅ Connecté à PostgreSQL');
    client.release();
  })
  .catch(err => {
    console.error('❌ Erreur de connexion à la BDD:', err.message);
  });

const query = (text, params) => pool.query(text, params);

module.exports = { pool, query };