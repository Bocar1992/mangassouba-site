// backend/db.js
require('dotenv').config();
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL manquant dans le fichier .env');
  process.exit(1);
}

// SSL : activé automatiquement sur Render ou si l'URL contient sslmode=require.
// On peut forcer avec DB_SSL=true / DB_SSL=false.
// DB_SSL_STRICT=true active la vérification stricte du certificat.
const url = process.env.DATABASE_URL;
let useSsl = url.includes('render.com') || /sslmode=require/i.test(url);
if (process.env.DB_SSL === 'true') useSsl = true;
if (process.env.DB_SSL === 'false') useSsl = false;

const pool = new Pool({
  connectionString: url,
  ssl: useSsl ? { rejectUnauthorized: process.env.DB_SSL_STRICT === 'true' } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  statement_timeout: 20000,
});

// Évite qu'une coupure de connexion inactive fasse tomber tout le serveur
pool.on('error', (err) => {
  console.error('⚠️ Erreur inattendue sur une connexion PostgreSQL inactive :', err.message);
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
