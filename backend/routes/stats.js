const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyAdmin } = require('../middleware/auth');

router.get('/', verifyAdmin, async (req, res) => {
  try {
    // 1. Chiffre d'affaires (commandes livrées)
    const caResult = await db.query("SELECT SUM(total) as ca FROM orders WHERE status = 'livrée'");
    const chiffreAffaires = parseFloat(caResult.rows[0].ca) || 0;

    // 2. Nombre de commandes en attente
    const attenteResult = await db.query("SELECT COUNT(*) as count FROM orders WHERE status = 'en attente'");
    const commandesEnAttente = parseInt(attenteResult.rows[0].count);

    // 3. Valeur du stock (au prix d'achat)
    const stockResult = await db.query("SELECT SUM(prix_achat * stock) as valeur FROM products");
    const valeurStock = parseFloat(stockResult.rows[0].valeur) || 0;

    // 4. Total des dépenses
    const depensesResult = await db.query("SELECT SUM(amount) as total FROM expenses");
    const totalDepenses = parseFloat(depensesResult.rows[0].total) || 0;

    // 5. Bénéfice estimé (CA - Dépenses)
    const benefice = chiffreAffaires - totalDepenses;

    // 6. Alertes stock (moins de 5)
    const alertesResult = await db.query("SELECT COUNT(*) as count FROM products WHERE stock < 5");
    const alertesStock = parseInt(alertesResult.rows[0].count);

    // 7. Total de produits (C'est la ligne qui manquait !)
    const produitsResult = await db.query("SELECT COUNT(*) as count FROM products");
    const totalProduits = parseInt(produitsResult.rows[0].count);

    res.json({
      chiffreAffaires,
      commandesEnAttente,
      valeurStock,
      totalDepenses,
      benefice,
      alertesStock,
      totalProduits // On l'ajoute ici
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

module.exports = router;