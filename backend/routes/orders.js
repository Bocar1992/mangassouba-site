const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyAdmin, optionalClient } = require('../middleware/auth');
const { orderLimiter, trackLimiter } = require('../middleware/security');
const {
  HttpError, cleanStr, toId, toInt, toMoney,
  normalizePhone, phoneKey, phoneKeySql, parseJsonItems,
} = require('../utils/validate');
const { drawHeader, drawItemsTable, ensureSpace, fmtMoney } = require('../utils/pdf');
const PDFDocument = require('pdfkit');

const STATUSES = ['en attente', 'confirmée', 'livrée', 'annulée'];
const PUBLIC_PAYMENTS = ['Espèces à la livraison', 'Mobile Money (Sedad)'];
const MAX_LINES = 50;

// ---------------------------------------------------------------------------
// Outils
// ---------------------------------------------------------------------------

// Lignes envoyées par le CLIENT : on ne garde que id + quantité, le reste vient de la base.
function parsePublicLines(raw) {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_LINES) {
    throw new HttpError(400, 'Panier invalide.');
  }
  const merged = new Map();
  for (const l of raw) {
    const id = toId(l && l.id);
    const qty = toInt(l && l.qty, 1, 10000);
    if (!id || !qty) throw new HttpError(400, 'Panier invalide (produit ou quantité incorrecte).');
    merged.set(id, (merged.get(id) || 0) + qty);
  }
  return [...merged.entries()].map(([id, qty]) => ({ id, qty }));
}

// Lignes envoyées par un ADMIN : il peut fixer librement le prix et utiliser des articles hors catalogue (id = null).
function parseAdminLines(raw) {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_LINES) {
    throw new HttpError(400, 'Ajoutez au moins un article (50 maximum).');
  }
  return raw.map((l) => {
    const qty = toInt(l && l.qty, 1, 100000);
    const prix = toMoney(l && l.prix, 0, 1e9);
    const nom = cleanStr(l && l.nom, 200);
    const id = l && l.id !== null && l.id !== undefined && l.id !== '' ? toId(l.id) : null;
    if (!qty || prix === null || !nom) throw new HttpError(400, 'Ligne de commande invalide (nom, quantité ou prix).');
    if (l && l.id && !id) throw new HttpError(400, 'Produit invalide.');
    return { id, nom, prix, qty };
  });
}

// Retire (sign = -1) ou remet (sign = +1) du stock. Le retrait est refusé si le stock est insuffisant.
async function adjustStock(client, lines, sign) {
  const sorted = lines.filter((l) => l.id).sort((a, b) => a.id - b.id); // ordre fixe = pas de blocage croisé
  for (const l of sorted) {
    const qty = Number(l.qty) || 0;
    if (qty <= 0) continue;
    if (sign < 0) {
      const r = await client.query(
        'UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $1 RETURNING nom',
        [qty, l.id]
      );
      if (r.rowCount === 0) {
        const p = await client.query('SELECT nom, stock FROM products WHERE id = $1', [l.id]);
        if (p.rowCount === 0) throw new HttpError(400, 'Un des produits n\'existe plus.');
        throw new HttpError(409, `Stock insuffisant pour « ${p.rows[0].nom} » (disponible : ${p.rows[0].stock}).`);
      }
    } else {
      await client.query('UPDATE products SET stock = stock + $1 WHERE id = $2', [qty, l.id]);
    }
  }
}

async function withTransaction(fn) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (e) { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// 1. CRÉER UNE COMMANDE (Public - Client)
//    Les prix, la remise et les frais sont TOUJOURS recalculés ici : rien de ce
//    que le navigateur envoie comme montant n'est utilisé.
// ---------------------------------------------------------------------------
router.post('/', orderLimiter, optionalClient, async (req, res) => {
  const clientName = cleanStr(req.body.clientName, 150);
  const phone = normalizePhone(req.body.phone);
  const address = cleanStr(req.body.address, 300);
  const payment = cleanStr(req.body.payment, 60);
  const promoCode = cleanStr(req.body.promo_code, 50);
  const zoneName = cleanStr(req.body.delivery_zone, 100);

  if (!clientName) return res.status(400).json({ message: 'Le nom est obligatoire.' });
  if (!phone) return res.status(400).json({ message: 'Numéro de téléphone invalide (8 à 15 chiffres).' });
  if (!address) return res.status(400).json({ message: 'L\'adresse est obligatoire.' });
  if (!PUBLIC_PAYMENTS.includes(payment)) return res.status(400).json({ message: 'Mode de paiement invalide.' });

  const lines = parsePublicLines(req.body.items);

  const order = await withTransaction(async (client) => {
    // 1. Prix officiels depuis la base
    const prod = await client.query(
      'SELECT id, nom, prix, prix_gros, seuil_gros FROM products WHERE id = ANY($1::int[])',
      [lines.map((l) => l.id)]
    );
    const byId = new Map(prod.rows.map((p) => [p.id, p]));

    let subtotal = 0;
    const items = lines.map((l) => {
      const p = byId.get(l.id);
      if (!p) throw new HttpError(400, 'Un des produits de votre panier n\'existe plus.');
      const gros = Number(p.prix_gros) > 0 && l.qty >= (Number(p.seuil_gros) || 10);
      const unit = Number(gros ? p.prix_gros : p.prix);
      subtotal += unit * l.qty;
      return { id: p.id, nom: p.nom, prix: unit, qty: l.qty };
    });

    // 2. Code promo vérifié en base
    let discount = 0;
    let appliedCode = null;
    if (promoCode) {
      const promo = await client.query(
        'SELECT code, discount_percent FROM promo_codes WHERE UPPER(code) = UPPER($1) AND is_active = true',
        [promoCode]
      );
      if (promo.rowCount === 0) throw new HttpError(400, 'Code promo invalide ou expiré.');
      appliedCode = promo.rows[0].code;
      discount = Math.round((subtotal * promo.rows[0].discount_percent) / 100);
    }

    // 3. Frais de livraison depuis la table des zones (sinon retrait en boutique = 0)
    let fee = 0;
    let zone = 'Retrait en boutique';
    if (zoneName && zoneName !== 'Retrait en boutique') {
      const z = await client.query('SELECT name, price FROM delivery_zones WHERE name = $1', [zoneName]);
      if (z.rowCount === 0) throw new HttpError(400, 'Zone de livraison invalide.');
      zone = z.rows[0].name;
      fee = Number(z.rows[0].price);
    }

    const total = Math.max(0, subtotal - discount + fee);

    // 4. Stock : retrait protégé (impossible de passer sous 0)
    await adjustStock(client, items, -1);

    const ins = await client.query(
      `INSERT INTO orders (clientName, phone, address, items, total, payment, promo_code, discount_amount, delivery_zone, delivery_fee, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'en attente')
       RETURNING id, total, status, created_at, discount_amount, delivery_fee`,
      [clientName, phone, address, JSON.stringify(items), total, payment, appliedCode, discount, zone, fee]
    );

    // 5. Points fidélité : uniquement pour le client réellement connecté
    const points = Math.floor(total / 100);
    if (points > 0 && req.customer) {
      await client.query('UPDATE customers SET points = points + $1 WHERE id = $2', [points, req.customer.id]);
    }

    return ins.rows[0];
  });

  res.status(201).json({ message: 'Commande enregistrée avec succès !', order });
});

// ---------------------------------------------------------------------------
// 2. VOIR TOUTES LES COMMANDES (Admin)
// ---------------------------------------------------------------------------
router.get('/', verifyAdmin, async (req, res) => {
  try {
    const result = await db.query('SELECT *, clientname AS "clientName" FROM orders ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ message: 'Erreur serveur.' }); }
});

// ---------------------------------------------------------------------------
// 3. CRÉER UNE COMMANDE MANUELLE (Admin)
// ---------------------------------------------------------------------------
router.post('/admin', verifyAdmin, async (req, res) => {
  const clientName = cleanStr(req.body.clientName, 150);
  const phone = cleanStr(req.body.phone, 30);
  const address = cleanStr(req.body.address, 300);
  const payment = cleanStr(req.body.payment, 60) || 'Espèces';
  const status = req.body.status || 'confirmée';

  if (!clientName) return res.status(400).json({ message: 'Le nom du client est obligatoire.' });
  if (!STATUSES.includes(status)) return res.status(400).json({ message: 'Statut invalide.' });
  const items = parseAdminLines(req.body.items);
  const total = items.reduce((s, l) => s + l.prix * l.qty, 0);

  const order = await withTransaction(async (client) => {
    if (status !== 'annulée') await adjustStock(client, items, -1);
    const r = await client.query(
      `INSERT INTO orders (clientName, phone, address, items, total, payment, delivery_zone, delivery_fee, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'Manuel', 0, $7) RETURNING *`,
      [clientName, phone, address, JSON.stringify(items), total, payment, status]
    );
    return r.rows[0];
  });

  res.status(201).json({ message: 'Commande manuelle créée !', order });
});

// ---------------------------------------------------------------------------
// 4. MODIFIER LE STATUT (Admin)
//    Passer à "annulée" remet le stock ; en sortir le retire à nouveau.
// ---------------------------------------------------------------------------
router.put('/:id', verifyAdmin, async (req, res) => {
  const id = toId(req.params.id);
  const { status } = req.body;
  if (!id) return res.status(400).json({ message: 'Identifiant invalide.' });
  if (!STATUSES.includes(status)) return res.status(400).json({ message: 'Statut invalide.' });

  const order = await withTransaction(async (client) => {
    const cur = await client.query('SELECT status, items FROM orders WHERE id = $1 FOR UPDATE', [id]);
    if (cur.rowCount === 0) throw new HttpError(404, 'Commande introuvable.');
    const items = parseJsonItems(cur.rows[0].items);
    const wasCancelled = cur.rows[0].status === 'annulée';
    const willCancel = status === 'annulée';

    if (!wasCancelled && willCancel) await adjustStock(client, items, +1);
    if (wasCancelled && !willCancel) await adjustStock(client, items, -1);

    const r = await client.query('UPDATE orders SET status = $1 WHERE id = $2 RETURNING *', [status, id]);
    return r.rows[0];
  });

  res.json({ message: 'Statut mis à jour.', order });
});

// ---------------------------------------------------------------------------
// 5. MODIFIER UNE COMMANDE COMPLÈTE (Admin)
// ---------------------------------------------------------------------------
router.put('/admin/:id', verifyAdmin, async (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Identifiant invalide.' });

  const clientName = cleanStr(req.body.clientName, 150);
  const phone = cleanStr(req.body.phone, 30);
  const address = cleanStr(req.body.address, 300);
  const payment = cleanStr(req.body.payment, 60) || 'Espèces';
  const status = req.body.status || 'confirmée';

  if (!clientName) return res.status(400).json({ message: 'Le nom du client est obligatoire.' });
  if (!STATUSES.includes(status)) return res.status(400).json({ message: 'Statut invalide.' });
  const items = parseAdminLines(req.body.items);

  const order = await withTransaction(async (client) => {
    const old = await client.query(
      'SELECT items, status, discount_amount, delivery_fee FROM orders WHERE id = $1 FOR UPDATE', [id]
    );
    if (old.rowCount === 0) throw new HttpError(404, 'Commande introuvable.');

    // On remet l'ancien stock (sauf si la commande était annulée), puis on retire le nouveau
    if (old.rows[0].status !== 'annulée') await adjustStock(client, parseJsonItems(old.rows[0].items), +1);
    if (status !== 'annulée') await adjustStock(client, items, -1);

    // On conserve la remise et les frais de livraison d'origine
    const sum = items.reduce((s, l) => s + l.prix * l.qty, 0);
    const total = Math.max(0, sum - Number(old.rows[0].discount_amount || 0) + Number(old.rows[0].delivery_fee || 0));

    const r = await client.query(
      `UPDATE orders SET clientName=$1, phone=$2, address=$3, items=$4, payment=$5, status=$6, total=$7 WHERE id=$8 RETURNING *`,
      [clientName, phone, address, JSON.stringify(items), payment, status, total, id]
    );
    return r.rows[0];
  });

  res.json({ message: 'Commande modifiée !', order });
});

// ---------------------------------------------------------------------------
// 6. SUPPRIMER UNE COMMANDE (Admin)
// ---------------------------------------------------------------------------
router.delete('/:id', verifyAdmin, async (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Identifiant invalide.' });

  await withTransaction(async (client) => {
    const cur = await client.query('SELECT items, status FROM orders WHERE id = $1 FOR UPDATE', [id]);
    if (cur.rowCount === 0) throw new HttpError(404, 'Commande introuvable.');
    if (cur.rows[0].status !== 'annulée') await adjustStock(client, parseJsonItems(cur.rows[0].items), +1);
    await client.query('DELETE FROM orders WHERE id = $1', [id]);
  });

  res.json({ message: 'Commande supprimée et stock restauré.' });
});

// ---------------------------------------------------------------------------
// 7. SUIVI DE COMMANDE PAR TÉLÉPHONE (Public)
//    Correspondance EXACTE sur le numéro (plus de LIKE '%...%' qui permettait de
//    lister les commandes de tout le monde), nombre limité, sans nom du client.
// ---------------------------------------------------------------------------
router.get('/track/:phone', trackLimiter, async (req, res) => {
  const key = phoneKey(req.params.phone);
  if (!key) return res.status(400).json({ message: 'Numéro invalide (8 chiffres minimum).' });

  try {
    const result = await db.query(
      `SELECT id, total, status, created_at, items FROM orders
       WHERE ${phoneKeySql('phone')} = $1 ORDER BY created_at DESC LIMIT 20`,
      [key]
    );
    // On ne renvoie que ce qui est utile à l'affichage (pas d'id produit)
    res.json(result.rows.map((o) => ({
      id: o.id, total: o.total, status: o.status, created_at: o.created_at,
      items: parseJsonItems(o.items).map((i) => ({ nom: i.nom, qty: i.qty })),
    })));
  } catch (err) { res.status(500).json({ message: 'Erreur serveur.' }); }
});

// ---------------------------------------------------------------------------
// 8. GÉNÉRER LA FACTURE PDF (Admin)
// ---------------------------------------------------------------------------
router.get('/:id/pdf', verifyAdmin, async (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Identifiant invalide.' });

  let order;
  try {
    const result = await db.query('SELECT *, clientname AS "clientName" FROM orders WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Commande introuvable.' });
    order = result.rows[0];
  } catch (err) { return res.status(500).json({ message: 'Erreur lors de la génération du PDF.' }); }

  try {
    const items = parseJsonItems(order.items);
    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Facture_Mangassouba_${order.id}.pdf`);
    doc.pipe(res);

    drawHeader(doc);

    doc.fillColor('#000000').fontSize(16).font('Helvetica-Bold').text(`FACTURE N° ${order.id}`);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Date : ${new Date(order.created_at).toLocaleDateString('fr-FR')}`);
    doc.text(`Statut : ${String(order.status || '').toUpperCase()}`);
    doc.moveDown(1);

    doc.fontSize(14).font('Helvetica-Bold').text('Informations Client :');
    doc.fontSize(10).font('Helvetica');
    doc.text(`Nom : ${order.clientName}`);
    doc.text(`Téléphone : ${order.phone}`);
    doc.text(`Adresse : ${order.address || 'Non renseignée'}`);
    doc.moveDown(2);

    doc.fontSize(12).font('Helvetica-Bold').text('Détails de la commande :');
    doc.moveDown(0.5);

    let y = drawItemsTable(doc, items);
    y = ensureSpace(doc, y, 110);

    doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000');
    if (Number(order.discount_amount) > 0) {
      doc.text(`Réduction (${order.promo_code || 'Promo'}) : -${fmtMoney(order.discount_amount)} MRU`, 350, y, { width: 200, align: 'right' });
      y += 15;
    }
    doc.text(`Frais de livraison : ${fmtMoney(order.delivery_fee)} MRU`, 350, y, { width: 200, align: 'right' });
    y += 20;
    doc.fontSize(14).text(`TOTAL À PAYER : ${fmtMoney(order.total)} MRU`, 300, y, { width: 250, align: 'right' });

    doc.fontSize(10).font('Helvetica-Oblique');
    doc.text(`Mode de paiement : ${order.payment}`, 50, y + 50, { width: 500, align: 'center' });
    doc.text('Merci de votre confiance !', 50, doc.y, { width: 500, align: 'center' });

    doc.end();
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ message: 'Erreur lors de la génération du PDF.' });
    else res.end();
  }
});

module.exports = router;
