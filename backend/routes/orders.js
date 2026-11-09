const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyAdmin } = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const path = require('path');

// 1. CRÉER UNE COMMANDE (Public - Client)
router.post('/', async (req, res) => {
  const { clientName, phone, address, items, payment, delivery_zone, delivery_fee, promo_code, discount_amount, total } = req.body;

  // CORRECTION ICI : db.pool.connect()
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const orderResult = await client.query(
      `INSERT INTO orders (clientName, phone, address, items, total, payment, promo_code, discount_amount, delivery_zone, delivery_fee, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'en attente') RETURNING *`,
      [clientName, phone, address, JSON.stringify(items), total, payment, promo_code, discount_amount, delivery_zone, delivery_fee]
    );

    for (let item of items) {
      await client.query(
        'UPDATE products SET stock = stock - $1 WHERE id = $2',
        [item.qty, item.id]
      );
    }

    const pointsGagnes = Math.floor(total / 100);
    if (pointsGagnes > 0) {
      await client.query(
        'UPDATE customers SET points = points + $1 WHERE phone = $2',
        [pointsGagnes, phone]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Commande enregistrée avec succès !', order: orderResult.rows[0] });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ message: 'Erreur lors de la commande.' });
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

  // CORRECTION ICI : db.pool.connect()
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const orderResult = await client.query(
      `INSERT INTO orders (clientName, phone, address, items, total, payment, delivery_zone, delivery_fee, status) 
       VALUES ($1, $2, $3, $4, $5, $6, 'Manuel', 0, $7) RETURNING *`,
      [clientName, phone, address, JSON.stringify(items), total, payment, status]
    );

    for (let item of items) {
      await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [item.qty, item.id]);
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Commande manuelle créée !', order: orderResult.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ message: 'Erreur lors de la création.' });
  } finally { client.release(); }
});

// 4. MODIFIER LE STATUT (Admin - Appelé par le menu déroulant)
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

  // CORRECTION ICI : db.pool.connect()
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Récupérer l'ancienne commande pour remettre le stock
    const oldOrderRes = await client.query('SELECT items FROM orders WHERE id = $1', [id]);
    if (oldOrderRes.rows.length === 0) throw new Error('Commande introuvable');
    
    const oldItems = typeof oldOrderRes.rows[0].items === 'string' ? JSON.parse(oldOrderRes.rows[0].items) : oldOrderRes.rows[0].items;
    
    // 2. Remettre l'ancien stock
    for (let item of oldItems) {
      await client.query('UPDATE products SET stock = stock + $1 WHERE id = $2', [item.qty, item.id]);
    }

    // 3. Mettre à jour la commande
    const result = await client.query(
      `UPDATE orders SET clientName=$1, phone=$2, address=$3, items=$4, payment=$5, status=$6, total=$7 WHERE id=$8 RETURNING *`,
      [clientName, phone, address, JSON.stringify(items), payment, status, total, id]
    );

    // 4. Enlever le nouveau stock
    for (let item of items) {
      await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [item.qty, item.id]);
    }

    await client.query('COMMIT');
    res.json({ message: 'Commande modifiée !', order: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ message: 'Erreur lors de la modification.' });
  } finally { client.release(); }
});

// 6. SUPPRIMER UNE COMMANDE (Admin)
router.delete('/:id', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  // CORRECTION ICI : db.pool.connect()
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Remettre le stock
    const orderRes = await client.query('SELECT items FROM orders WHERE id = $1', [id]);
    if (orderRes.rows.length > 0) {
      const items = typeof orderRes.rows[0].items === 'string' ? JSON.parse(orderRes.rows[0].items) : orderRes.rows[0].items;
      for (let item of items) {
         await client.query('UPDATE products SET stock = stock + $1 WHERE id = $2', [item.qty, item.id]);
      }
    }

    await client.query('DELETE FROM orders WHERE id = $1', [id]);
    await client.query('COMMIT');
    res.json({ message: 'Commande supprimée et stock restauré.' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Erreur serveur.' });
  } finally { client.release(); }
});

// 7. SUIVI DE COMMANDE PAR TÉLÉPHONE (Public)
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

// 8. GÉNÉRER LA FACTURE PDF (Admin)
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
    try {
      doc.image(logoPath, (doc.page.width - 120) / 2, 40, { width: 120 });
      doc.y = 170; 
    } catch (err) { doc.y = 50; }

    doc.fontSize(22).font('Helvetica-Bold').fillColor('#0A1C3F').text('MANGASSOUBA ET FILS', { align: 'center' });
    doc.fontSize(12).font('Helvetica').fillColor('#1A6A38').text('Quincaillerie, Alimentation & Divers', { align: 'center' });
    doc.text('Sélibaby, Marché centre-ville, Mauritanie', { align: 'center' });
    doc.text('Tél : 00222 46 43 22 53 / 00222 42 43 22 53', { align: 'center' });
    doc.moveDown(1);
    doc.strokeColor('#F4B41A').lineWidth(2).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(1);

    doc.fillColor('#000000').fontSize(16).font('Helvetica-Bold').text(`FACTURE N° ${order.id}`);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Date : ${new Date(order.created_at).toLocaleDateString('fr-FR')}`);
    doc.text(`Statut : ${order.status.toUpperCase()}`);
    doc.moveDown(1);

    doc.fontSize(14).font('Helvetica-Bold').text('Informations Client :');
    doc.fontSize(10).font('Helvetica');
    doc.text(`Nom : ${order.clientName}`);
    doc.text(`Téléphone : ${order.phone}`);
    doc.text(`Adresse : ${order.address || 'Non renseignée'}`);
    doc.moveDown(2);

    doc.fontSize(12).font('Helvetica-Bold').text('Détails de la commande :');
    doc.moveDown(0.5);

    let y = doc.y;
    doc.rect(50, y, 500, 20).fill('#F4F7F6');
    doc.fillColor('#000000').text('Désignation', 60, y + 5);
    doc.text('Qté', 350, y + 5);
    doc.text('Prix Unit.', 400, y + 5);
    doc.text('Total', 480, y + 5);
    y += 25;

    doc.font('Helvetica');
    items.forEach(item => {
      doc.text(item.nom, 60, y);
      doc.text(item.qty.toString(), 350, y);
      doc.text(`${new Intl.NumberFormat('fr-FR').format(item.prix)} MRU`, 400, y);
      doc.text(`${new Intl.NumberFormat('fr-FR').format(item.prix * item.qty)} MRU`, 480, y);
      y += 20;
    });

    doc.moveTo(50, y).lineTo(550, y).stroke();
    y += 10;

    doc.font('Helvetica-Bold');
    if (order.discount_amount > 0) {
        doc.text(`Réduction (${order.promo_code || 'Promo'}) : -${new Intl.NumberFormat('fr-FR').format(order.discount_amount)} MRU`, 350, y, { width: 200, align: 'right' });
        y += 15;
    }
    doc.text(`Frais de livraison : ${new Intl.NumberFormat('fr-FR').format(order.delivery_fee)} MRU`, 350, y, { width: 200, align: 'right' });
    y += 20;
    doc.fontSize(14).text(`TOTAL À PAYER : ${new Intl.NumberFormat('fr-FR').format(order.total)} MRU`, 350, y, { width: 200, align: 'right' });

    doc.moveDown(3);
    doc.fontSize(10).font('Helvetica-Oblique').text(`Mode de paiement : ${order.payment}`, { align: 'center' });
    doc.text('Merci de votre confiance !', { align: 'center' });

    doc.end();
  } catch (err) { res.status(500).json({ message: 'Erreur lors de la génération du PDF.' }); }
});

module.exports = router;