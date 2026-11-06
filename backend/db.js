const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.connect()
  .then(() => console.log('✅ Connecté à la base de données PostgreSQL'))
  .catch(err => console.error('❌ Erreur de connexion à la BDD:', err.message));

module.exports = pool;