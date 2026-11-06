// backend/db.js
require('dotenv').config();
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL manquant dans le fichier .env');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // On force le SSL pour Render
  ssl: {
    rejectUnauthorized: false
  },
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.connect()
  .then(client => {
    console.log('✅ Connecté à PostgreSQL');
    client.release();
  })
  .catch(err => {
    console.error('❌ Erreur de connexion PostgreSQL :', err.message);
  });

const query = (text, params) => pool.query(text, params);

module.exports = { pool, query };
