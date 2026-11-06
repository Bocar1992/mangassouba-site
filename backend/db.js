// backend/db.js
require('dotenv').config();
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL manquant dans le fichier .env');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
<<<<<<< HEAD
  // On force le SSL pour Render (et la plupart des hébergeurs cloud)
=======
  // On force le SSL pour Render
>>>>>>> 84bb5ae775b7f701ad6e568c994180ca6af3a1e2
  ssl: {
    rejectUnauthorized: false
  },
  max: 10,
  idleTimeoutMillis: 30000,
});

// Petit test de connexion au démarrage
pool.connect()
  .then(client => {
    console.log('✅ Connecté à PostgreSQL');
    client.release();
  })
  .catch(err => {
    console.error('❌ Erreur de connexion PostgreSQL :', err.message);
  });

const query = (text, params) => pool.query(text, params);

<<<<<<< HEAD
module.exports = { pool, query };
=======
module.exports = { pool, query };
>>>>>>> 84bb5ae775b7f701ad6e568c994180ca6af3a1e2
