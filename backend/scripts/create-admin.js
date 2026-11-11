// Crée (ou réinitialise) un Super Admin.
// Usage :  npm run create-admin -- email@exemple.com "Nom Prénom" "MotDePasseSolide"
// Le mot de passe n'est jamais écrit en clair dans le dépôt ni dans la base (haché avec bcrypt).
require('dotenv').config();
const bcrypt = require('bcrypt');
const { pool } = require('../db');
const { isEmail, checkPassword } = require('../utils/validate');

(async () => {
  const [email, nom, password] = process.argv.slice(2);
  if (!email || !nom || !password) {
    console.error('Usage : npm run create-admin -- email@exemple.com "Nom Prénom" "MotDePasse"');
    process.exit(1);
  }
  if (!isEmail(email)) { console.error('Email invalide.'); process.exit(1); }
  const pwError = checkPassword(password);
  if (pwError) { console.error(pwError); process.exit(1); }

  try {
    const hash = await bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS) || 12);
    const r = await pool.query(
      `INSERT INTO admins (nom, email, password, role) VALUES ($1, LOWER($2), $3, 'superadmin')
       ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password, nom = EXCLUDED.nom, role = 'superadmin'
       RETURNING id, email`,
      [nom, email, hash]
    );
    console.log(`✅ Super Admin prêt : ${r.rows[0].email} (id ${r.rows[0].id})`);
  } catch (err) {
    console.error('❌ Échec :', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
