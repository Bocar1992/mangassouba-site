const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyAdmin } = require('../middleware/auth');

router.get('/', verifyAdmin, async (req, res) => {
  try {
    const isSuper = req.admin.role === 'superadmin';

    const caResult = await db.query("SELECT SUM(total) as ca FROM orders WHERE status = 'livrée'");
    const chiffreAffaires = parseFloat(caResult.rows[0].ca) || 0;

    const attenteResult = await db.query("SELECT COUNT(*) as count FROM orders WHERE status = 'en attente'");
    const commandesEnAttente = parseInt(attenteResult.rows[0].count);

    const alertesResult = await db.query("SELECT COUNT(*) as count FROM products WHERE stock < 5");
    const alertesStock = parseInt(alertesResult.rows[0].count);

    const produitsResult = await db.query("SELECT COUNT(*) as count FROM products");
    const totalProduits = parseInt(produitsResult.rows[0].count);

    // Si c'est un superadmin, on calcule et renvoie les données financières
    let valeurStock = 0;
    let totalDepenses = 0;
    let benefice = 0;

    if (isSuper) {
        const stockResult = await db.query("SELECT SUM(prix_achat * stock) as valeur FROM products");
        valeurStock = parseFloat(stockResult.rows[0].valeur) || 0;

        const depensesResult = await db.query("SELECT SUM(amount) as total FROM expenses");
        totalDepenses = parseFloat(depensesResult.rows[0].total) || 0;

        benefice = chiffreAffaires - totalDepenses;
    }

    res.json({
      chiffreAffaires: isSuper ? chiffreAffaires : null,
      commandesEnAttente,
      valeurStock: isSuper ? valeurStock : null,
      totalDepenses: isSuper ? totalDepenses : null,
      benefice: isSuper ? benefice : null,
      alertesStock,
      totalProduits,
      role: req.admin.role
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

module.exports = router;