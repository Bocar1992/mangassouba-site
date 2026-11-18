const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt'); // NOUVEAU : Pour hacher le mot de passe par défaut
const db = require('../db');
const { verifyAdmin } = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const path = require('path');

// 1. CRÉER UNE COMMANDE (Public - Client)
router.post('/', async (req, res) => {
  const { clientName, phone, address, items, payment, delivery_zone, delivery_fee, promo_code, discount_amount } = req.body;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // SÉCURITÉ : On recalcule le total côté serveur
    let vraiTotal = 0;
    let itemsVerifies = [];

    for (let item of items) {
      const prodRes = await client.query('SELECT prix, stock FROM products WHERE id = $1', [item.id]);
      if (prodRes.rows.length === 0) throw new Error("Produit introuvable");
      
      const produit = prodRes.rows[0];
      if (produit.stock < item.qty) throw new Error("Stock insuffisant pour " + item.nom);

      vraiTotal += (parseFloat(produit.prix) * item.qty);
      itemsVerifies.push({ id: item.id, nom: item.nom, prix: parseFloat(produit.prix), qty: item.qty });
    }

    // On applique la réduction basée sur le vrai total
    let vraieReduction = 0;
    if (promo_code) {
        const promoRes = await client.query('SELECT discount_percent FROM promo_codes WHERE code = $1 AND is_active = true', [promo_code]);
        if (promoRes.rows.length > 0) {
            vraieReduction = (vraiTotal * promoRes.rows[0].discount_percent) / 100;
        }
    }

    const totalFinal = vraiTotal - vraieReduction + (delivery_fee || 0);

    const orderResult = await client.query(
      `INSERT INTO orders (clientName, phone, address, items, total, payment, promo_code, discount_amount, delivery_zone, delivery_fee, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'en attente') RETURNING *`,
      [clientName, phone, address, JSON.stringify(itemsVerifies), totalFinal, payment, promo_code, vraieReduction, delivery_zone, delivery_fee]
    );

    for (let item of itemsVerifies) {
      await client.query(
        'UPDATE products SET stock = stock - $1 WHERE id = $2',
        [item.qty, item.id]
      );
    }

    // --- NOUVEAU : GESTION AUTOMATIQUE DU CLIENT ---
    const pointsGagnes = Math.floor(totalFinal / 100);
    
    // 1. On vérifie si le client existe déjà
    const clientRes = await client.query('SELECT id FROM customers WHERE phone = $1', [phone]);
    
    if (clientRes.rows.length === 0) {
        // 2. Le client n'existe pas, on le crée !
        // On utilise son numéro de téléphone comme mot de passe par défaut
        const salt = await bcrypt.genSalt(10);
        const defaultHashedPassword = await bcrypt.hash(phone, salt); 
        
        await client.query(
            'INSERT INTO customers (name, phone, password, points) VALUES ($1, $2, $3, $4)',
            [clientName, phone, defaultHashedPassword, pointsGagnes]
        );
    } else {
        // 3. Le client existe déjà, on met juste à jour ses points
        if (pointsGagnes > 0) {
            await client.query(
                'UPDATE customers SET points = points + $1 WHERE phone = $2',
                [pointsGagnes, phone]
            );
        }
    }
    // -----------------------------------------------

    await client.query('COMMIT');
    res.status(201).json({ message: 'Commande enregistrée avec succès !', order: orderResult.rows[0] });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Erreur commande:", err);
    res.status(500).json({ message: err.message || 'Erreur lors de la commande.' });
  } finally {
    client.release();
  }
});

// 2. VOIR TOUTES LES COMMANDES (Admin)
router.get('/', verifyAdmin, async (req, res) => {
  try {
    const result = await db.query('SELECT *, clientname AS "clientName" FROM orders ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ message: 'Erreur serveur.' }); }
});

// 3. CRÉER UNE COMMANDE MANUELLE (Admin)
router.post('/admin', verifyAdmin, async (req, res) => {
  const { clientName, phone, address, items, payment, status, total } = req.body;
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const orderResult = await client.query(
      `INSERT INTO orders (clientName, phone, address, items, total, payment, delivery_zone, delivery_fee, status) 
       VALUES ($1, $2, $3, $4, $5, $6, 'Manuel', 0, $7) RETURNING *`,
      [clientName, phone, address, JSON.stringify(items), total, payment, status]
    );
    for (let item of items) {
      if(item.id) await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [item.qty, item.id]);
    }
    await client.query('COMMIT');
    res.status(201).json({ message: 'Commande manuelle créée !', order: orderResult.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Erreur.' });
  } finally { client.release(); }
});

// 4. MODIFIER LE STATUT
router.put('/:id', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const result = await db.query('UPDATE orders SET status = $1 WHERE id = $2 RETURNING *', [status, id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Commande introuvable.' });
    res.json({ message: 'Statut mis à jour.', order: result.rows[0] });
  } catch (err) { res.status(500).json({ message: 'Erreur serveur.' }); }
});

// 5. MODIFIER UNE COMMANDE COMPLÈTE (Admin)
router.put('/admin/:id', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { clientName, phone, address, items, payment, status, total } = req.body;
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const oldOrderRes = await client.query('SELECT items FROM orders WHERE id = $1', [id]);
    if (oldOrderRes.rows.length === 0) throw new Error('Commande introuvable');
    
    const oldItems = typeof oldOrderRes.rows[0].items === 'string' ? JSON.parse(oldOrderRes.rows[0].items) : oldOrderRes.rows[0].items;
    
    for (let item of oldItems) {
      if(item.id) await client.query('UPDATE products SET stock = stock + $1 WHERE id = $2', [item.qty, item.id]);
    }

    const result = await client.query(
      `UPDATE orders SET clientName=$1, phone=$2, address=$3, items=$4, payment=$5, status=$6, total=$7 WHERE id=$8 RETURNING *`,
      [clientName, phone, address, JSON.stringify(items), payment, status, total, id]
    );

    for (let item of items) {
      if(item.id) await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [item.qty, item.id]);
    }

    await client.query('COMMIT');
    res.json({ message: 'Commande modifiée !', order: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Erreur lors de la modification.' });
  } finally { client.release(); }
});

// 6. SUPPRIMER UNE COMMANDE (Admin)
router.delete('/:id', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const orderRes = await client.query('SELECT items FROM orders WHERE id = $1', [id]);
    if (orderRes.rows.length > 0) {
      const items = typeof orderRes.rows[0].items === 'string' ? JSON.parse(orderRes.rows[0].items) : orderRes.rows[0].items;
      for (let item of items) {
         if(item.id) await client.query('UPDATE products SET stock = stock + $1 WHERE id = $2', [item.qty, item.id]);
      }
    }
    await client.query('DELETE FROM orders WHERE id = $1', [id]);
    await client.query('COMMIT');
    res.json({ message: 'Commande supprimée.' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Erreur serveur.' });
  } finally { client.release(); }
});

// 7. SUIVI DE COMMANDE
router.get('/track/:phone', async (req, res) => {
  const { phone } = req.params;
  try {
    const result = await db.query(
      'SELECT id, clientname AS "clientName", total, status, created_at, items FROM orders WHERE phone LIKE $1 ORDER BY created_at DESC',
      [`%${phone}%`]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ message: 'Erreur serveur.' }); }
});

// 8. GÉNÉRER LA FACTURE PDF
router.get('/:id/pdf', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('SELECT *, clientname AS "clientName" FROM orders WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Commande introuvable.' });
    
    const order = result.rows[0];
    const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Facture_Mangassouba_${order.id}.pdf`);
    doc.pipe(res);

    const logoPath = path.join(__dirname, '../../frontend/images/logo.png');
    try { doc.image(logoPath, (doc.page.width - 120) / 2, 40, { width: 120 }); doc.y = 170; } catch (err) { doc.y = 50; }

    doc.fontSize(22).font('Helvetica-Bold').fillColor('#0A1C3F').text('MANGASSOUBA ET FILS', { align: 'center' });
    doc.fontSize(12).font('Helvetica').fillColor('#1A6A38').text('Quincaillerie, Alimentation & Divers', { align: 'center' });
    doc.text('Sélibaby, Marché centre-ville, Mauritanie', { align: 'center' });
    doc.text('Tél : 00222 46 43 22 53 / 00222 42 43 22 53', { align: 'center' });
    doc.moveDown(1);
    doc.strokeColor('#F4B41A').lineWidth(2).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(1);
    doc.fillColor('#000000').fontSize(16).font('Helvetica-Bold').text(`FACTURE N° ${order.id}`);
    doc.fontSize(10).font('Helvetica').text(`Date : ${new Date(order.created_at).toLocaleDateString('fr-FR')}`);
    doc.text(`Statut : ${order.status.toUpperCase()}`);
    doc.moveDown(1);
    doc.fontSize(14).font('Helvetica-Bold').text('Informations Client :');
    doc.fontSize(10).font('Helvetica').text(`Nom : ${order.clientName}`).text(`Téléphone : ${order.phone}`).text(`Adresse : ${order.address || 'Non renseignée'}`);
    doc.moveDown(2);
    doc.fontSize(12).font('Helvetica-Bold').text('Détails :');
    doc.moveDown(0.5);

    let y = doc.y;
    doc.rect(50, y, 500, 20).fill('#F4F7F6');
    doc.fillColor('#000000').text('Désignation', 60, y + 5).text('Qté', 350, y + 5).text('Prix Unit.', 400, y + 5).text('Total', 480, y + 5);
    y += 25;

    doc.font('Helvetica');
    items.forEach(item => {
      doc.text(item.nom, 60, y).text(item.qty.toString(), 350, y).text(`${new Intl.NumberFormat('fr-FR').format(item.prix)} MRU`, 400, y).text(`${new Intl.NumberFormat('fr-FR').format(item.prix * item.qty)} MRU`, 480, y);
      y += 20;
    });

    doc.moveTo(50, y).lineTo(550, y).stroke(); y += 10;
    doc.font('Helvetica-Bold');
    if (order.discount_amount > 0) { doc.text(`Réduction (${order.promo_code || 'Promo'}) : -${new Intl.NumberFormat('fr-FR').format(order.discount_amount)} MRU`, 350, y, { width: 200, align: 'right' }); y += 15; }
    doc.text(`Frais de livraison : ${new Intl.NumberFormat('fr-FR').format(order.delivery_fee)} MRU`, 350, y, { width: 200, align: 'right' }); y += 20;
    doc.fontSize(14).text(`TOTAL À PAYER : ${new Intl.NumberFormat('fr-FR').format(order.total)} MRU`, 350, y, { width: 200, align: 'right' });
    doc.moveDown(3);
    doc.fontSize(10).font('Helvetica-Oblique').text(`Mode de paiement : ${order.payment}`, { align: 'center' }).text('Merci de votre confiance !', { align: 'center' });
    doc.end();
  } catch (err) { res.status(500).json({ message: 'Erreur PDF.' }); }
});

module.exports = router;