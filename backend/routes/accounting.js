const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifySuperAdmin } = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const path = require('path');

// ==================== PROFORMAS ====================
router.get('/proformas', verifySuperAdmin, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM proformas ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ message: 'Erreur serveur.' }); }
});

router.post('/proformas', verifySuperAdmin, async (req, res) => {
  const { client_name, phone, address, items, total, valid_until } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO proformas (client_name, phone, address, items, total, valid_until) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [client_name, phone, address, JSON.stringify(items), total, valid_until]
    );
    const proforma = result.rows[0];
    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Proforma_${proforma.id}.pdf`);
    doc.pipe(res);

    const logoPath = path.join(__dirname, '../../frontend/images/logo.png');
    try { doc.image(logoPath, (doc.page.width - 120) / 2, 40, { width: 120 }); doc.y = 170; } catch (err) { doc.y = 50; }

    doc.fontSize(22).font('Helvetica-Bold').fillColor('#0A1C3F').text('MANGASSOUBA ET FILS', { align: 'center' });
    doc.fontSize(12).font('Helvetica').fillColor('#1A6A38').text('Sélibaby, Marché centre-ville, Mauritanie', { align: 'center' });
    doc.text('Tél : 00222 46 43 22 53', { align: 'center' });
    doc.moveDown(1);
    doc.strokeColor('#F4B41A').lineWidth(2).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(1);

    doc.fillColor('#d9534f').fontSize(20).font('Helvetica-Bold').text('FACTURE PROFORMA', { align: 'center' });
    doc.fillColor('#000000').fontSize(10).font('Helvetica-Oblique').text('(Ce document est un devis)', { align: 'center' });
    doc.moveDown(1);

    doc.fontSize(10).font('Helvetica');
    doc.text(`Proforma N° : PRO-${proforma.id}`);
    doc.text(`Date : ${new Date(proforma.created_at).toLocaleDateString('fr-FR')}`);
    if(proforma.valid_until) doc.text(`Valable jusqu'au : ${new Date(proforma.valid_until).toLocaleDateString('fr-FR')}`);
    doc.moveDown(1);

    doc.fontSize(14).font('Helvetica-Bold').text('Client :');
    doc.fontSize(10).font('Helvetica').text(`${proforma.client_name} | ${proforma.phone || '-'} | ${proforma.address || '-'}`);
    doc.moveDown(2);

    let y = doc.y;
    doc.rect(50, y, 500, 20).fill('#F4F7F6');
    doc.fillColor('#000000').text('Désignation', 60, y + 5).text('Qté', 350, y + 5).text('Prix Unit.', 400, y + 5).text('Total', 480, y + 5);
    y += 25;

    doc.font('Helvetica');
    const parsedItems = typeof proforma.items === 'string' ? JSON.parse(proforma.items) : proforma.items;
    parsedItems.forEach(item => {
      doc.text(item.nom, 60, y).text(item.qty.toString(), 350, y).text(`${new Intl.NumberFormat('fr-FR').format(item.prix)} MRU`, 400, y).text(`${new Intl.NumberFormat('fr-FR').format(item.prix * item.qty)} MRU`, 480, y);
      y += 20;
    });

    doc.moveTo(50, y).lineTo(550, y).stroke(); y += 10;
    doc.fontSize(16).font('Helvetica-Bold').text(`TOTAL : ${new Intl.NumberFormat('fr-FR').format(proforma.total)} MRU`, 300, y, { width: 250, align: 'right' });
    doc.end();
  } catch (err) { 
    console.error("Erreur PDF Proforma:", err);
    res.status(500).json({ message: 'Erreur.' }); 
  }
});

router.delete('/proformas/:id', verifySuperAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM proformas WHERE id = $1', [req.params.id]);
    res.json({ message: 'Proforma supprimée.' });
  } catch (err) { res.status(500).json({ message: 'Erreur serveur.' }); }
});

// ==================== DÉPENSES ====================
router.get('/expenses', verifySuperAdmin, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM expenses ORDER BY date DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ message: 'Erreur serveur.' }); }
});

router.post('/expenses', verifySuperAdmin, async (req, res) => {
  const { description, amount, category, date } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO expenses (description, amount, category, date) VALUES ($1, $2, $3, $4) RETURNING *',
      [description, amount, category, date]
    );
    res.status(201).json({ message: 'Dépense ajoutée.', expense: result.rows[0] });
  } catch (err) { res.status(500).json({ message: 'Erreur serveur.' }); }
});

router.delete('/expenses/:id', verifySuperAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM expenses WHERE id = $1', [req.params.id]);
    res.json({ message: 'Dépense supprimée.' });
  } catch (err) { res.status(500).json({ message: 'Erreur serveur.' }); }
});

module.exports = router;