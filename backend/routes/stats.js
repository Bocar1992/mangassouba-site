const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyAdmin } = require('../middleware/auth');

router.get('/', verifyAdmin, async (req, res) => {
  try {
    // Toutes les statistiques en une seule requête (au lieu de 7 allers-retours)
    const r = await db.query(`
      SELECT
        (SELECT COALESCE(SUM(total), 0) FROM orders WHERE status = 'livrée')            AS ca,
        (SELECT COUNT(*) FROM orders WHERE status = 'en attente')                       AS attente,
        (SELECT COALESCE(SUM(prix_achat * stock), 0) FROM products)                     AS valeur_stock,
        (SELECT COALESCE(SUM(amount), 0) FROM expenses)                                 AS depenses,
        (SELECT COUNT(*) FROM products WHERE stock < 5)                                 AS alertes,
        (SELECT COUNT(*) FROM products)                                                 AS produits,
        (SELECT COALESCE(SUM(
            (COALESCE((i->>'prix')::numeric, 0) - COALESCE(p.prix_achat, 0)) * COALESCE((i->>'qty')::numeric, 0)
         ), 0)
         FROM orders o
         CROSS JOIN LATERAL jsonb_array_elements(
           CASE WHEN jsonb_typeof(o.items) = 'array' THEN o.items ELSE '[]'::jsonb END) AS i
         LEFT JOIN products p ON p.id = NULLIF(i->>'id', '')::int
         WHERE o.status = 'livrée')
        - (SELECT COALESCE(SUM(discount_amount), 0) FROM orders WHERE status = 'livrée') AS marge_brute
    `);
    const row = r.rows[0];

    const chiffreAffaires = parseFloat(row.ca) || 0;
    const totalDepenses = parseFloat(row.depenses) || 0;

    res.json({
      chiffreAffaires,
      commandesEnAttente: parseInt(row.attente),
      valeurStock: parseFloat(row.valeur_stock) || 0,
      totalDepenses,
      // Bénéfice estimé = CA - dépenses (les achats de stock sont saisis dans les dépenses)
      benefice: chiffreAffaires - totalDepenses,
      // Information complémentaire : marge sur les ventes livrées (prix de vente - prix d'achat actuel - remises)
      margeBrute: parseFloat(row.marge_brute) || 0,
      alertesStock: parseInt(row.alertes),
      totalProduits: parseInt(row.produits),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

module.exports = router;
