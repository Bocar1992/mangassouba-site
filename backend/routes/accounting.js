const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyAdmin } = require('../middleware/auth');
const { HttpError, cleanStr, toId, toInt, toMoney } = require('../utils/validate');
const { drawHeader, drawItemsTable, ensureSpace, fmtMoney } = require('../utils/pdf');
const PDFDocument = require('pdfkit');

const EXPENSE_CATEGORIES = ['Loyer', 'Électricité/Eau', 'Salaires', 'Transport', 'Achat de stock', 'Autre'];
const isoDate = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v)) ? v : null);

// ===================== DÉPENSES =====================
// (Ces routes étaient appelées par l'interface admin mais n'existaient pas : la page "Dépenses" était cassée.)

// Liste des dépenses
router.get('/expenses', verifyAdmin, async (req, res) => {
  try {
    const result = await db.query('SELECT id, description, amount, category, date FROM expenses ORDER BY date DESC, id DESC');
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Erreur serveur.' }); }
});

// Ajouter une dépense
router.post('/expenses', verifyAdmin, async (req, res) => {
  const description = cleanStr(req.body.description, 200);
  const amount = toMoney(req.body.amount, 0.01, 1e10);
  const category = EXPENSE_CATEGORIES.includes(req.body.category) ? req.body.category : 'Autre';
  const date = isoDate(req.body.date);

  if (!description) return res.status(400).json({ message: 'La description est obligatoire.' });
  if (amount === null) return res.status(400).json({ message: 'Montant invalide.' });
  if (!date) return res.status(400).json({ message: 'Date invalide.' });

  try {
    const result = await db.query(
      'INSERT INTO expenses (description, amount, category, date) VALUES ($1, $2, $3, $4) RETURNING id, description, amount, category, date',
      [description, amount, category, date]
    );
    res.status(201).json({ message: 'Dépense enregistrée.', expense: result.rows[0] });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Erreur serveur.' }); }
});

// Supprimer une dépense
router.delete('/expenses/:id', verifyAdmin, async (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Identifiant invalide.' });
  try {
    await db.query('DELETE FROM expenses WHERE id = $1', [id]);
    res.json({ message: 'Dépense supprimée.' });
  } catch (err) { res.status(500).json({ message: 'Erreur serveur.' }); }
});

// ===================== PROFORMAS =====================

// 1. VOIR TOUTES LES PROFORMAS (Admin)
router.get('/proformas', verifyAdmin, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM proformas ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ message: 'Erreur serveur.' }); }
});

// 2. CRÉER UNE PROFORMA ET GÉNÉRER LE PDF (Admin)
router.post('/proformas', verifyAdmin, async (req, res) => {
  const client_name = cleanStr(req.body.client_name, 150);
  const phone = cleanStr(req.body.phone, 30);
  const address = cleanStr(req.body.address, 300);
  const valid_until = req.body.valid_until ? isoDate(req.body.valid_until) : null;

  if (!client_name) return res.status(400).json({ message: 'Le nom du client est obligatoire.' });
  if (req.body.valid_until && !valid_until) return res.status(400).json({ message: 'Date de validité invalide.' });
  if (!Array.isArray(req.body.items) || req.body.items.length === 0 || req.body.items.length > 50) {
    return res.status(400).json({ message: 'Ajoutez au moins un article (50 maximum).' });
  }

  // Lignes nettoyées + total recalculé côté serveur
  const items = req.body.items.map((l) => {
    const qty = toInt(l && l.qty, 1, 100000);
    const prix = toMoney(l && l.prix, 0, 1e9);
    const nom = cleanStr(l && l.nom, 200);
    if (!qty || prix === null || !nom) throw new HttpError(400, 'Ligne invalide (nom, quantité ou prix).');
    return { id: toId(l.produitId || l.id), nom, prix, qty };
  });
  const total = items.reduce((s, l) => s + l.prix * l.qty, 0);

  let proforma;
  try {
    const result = await db.query(
      `INSERT INTO proformas (client_name, phone, address, items, total, valid_until)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [client_name, phone, address, JSON.stringify(items), total, valid_until]
    );
    proforma = result.rows[0];
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Erreur lors de la génération de la proforma.' });
  }

  try {
    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Proforma_Mangassouba_${proforma.id}.pdf`);
    doc.pipe(res);

    drawHeader(doc);

    doc.fillColor('#d9534f').fontSize(20).font('Helvetica-Bold').text('FACTURE PROFORMA', { align: 'center' });
    doc.fillColor('#000000').fontSize(10).font('Helvetica-Oblique').text('(Ce document est un devis, il ne constitue pas une facture définitive)', { align: 'center' });
    doc.moveDown(1);

    doc.fontSize(10).font('Helvetica');
    doc.text(`Proforma N° : PRO-${proforma.id}`);
    doc.text(`Date : ${new Date(proforma.created_at).toLocaleDateString('fr-FR')}`);
    if (proforma.valid_until) doc.text(`Valable jusqu'au : ${new Date(proforma.valid_until).toLocaleDateString('fr-FR')}`);
    doc.moveDown(1);

    doc.fontSize(14).font('Helvetica-Bold').text('Informations Client :');
    doc.fontSize(10).font('Helvetica');
    doc.text(`Nom : ${proforma.client_name}`);
    doc.text(`Téléphone : ${proforma.phone || 'Non renseigné'}`);
    doc.text(`Adresse : ${proforma.address || 'Non renseignée'}`);
    doc.moveDown(2);

    doc.fontSize(12).font('Helvetica-Bold').text('Détails :');
    doc.moveDown(0.5);

    let y = drawItemsTable(doc, items);
    y = ensureSpace(doc, y, 120);

    doc.fontSize(16).font('Helvetica-Bold').fillColor('#000000')
       .text(`TOTAL PROFORMA : ${fmtMoney(proforma.total)} MRU`, 300, y, { width: 250, align: 'right' });
    doc.fontSize(10).font('Helvetica').text('Signature & Cachet de l\'entreprise', 50, y + 60, { align: 'left' });

    doc.end();
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ message: 'Erreur lors de la génération de la proforma.' });
    else res.end();
  }
});

// 3. SUPPRIMER UNE PROFORMA (Admin)
router.delete('/proformas/:id', verifyAdmin, async (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Identifiant invalide.' });
  try {
    await db.query('DELETE FROM proformas WHERE id = $1', [id]);
    res.json({ message: 'Proforma supprimée.' });
  } catch (err) { res.status(500).json({ message: 'Erreur serveur.' }); }
});

module.exports = router;
