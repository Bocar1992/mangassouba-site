// backend/utils/pdf.js
// Éléments communs aux factures et proformas (en-tête, tableau avec sauts de page).
const path = require('path');
const fs = require('fs');
const { fmtMoney } = require('./validate');

// Le logo est cherché d'abord dans le backend (déploiement séparé du frontend), puis dans le frontend.
const LOGO_CANDIDATES = [
  path.join(__dirname, '../assets/logo.png'),
  path.join(__dirname, '../../frontend/images/logo.png'),
];
const LOGO_PATH = LOGO_CANDIDATES.find((p) => fs.existsSync(p)) || null;

const PAGE_BOTTOM = 740;

function drawHeader(doc) {
  if (LOGO_PATH) {
    try {
      doc.image(LOGO_PATH, (doc.page.width - 120) / 2, 40, { width: 120 });
      doc.y = 170;
    } catch (err) { doc.y = 50; }
  } else {
    doc.y = 50;
  }

  doc.fontSize(22).font('Helvetica-Bold').fillColor('#0A1C3F').text('MANGASSOUBA ET FILS', { align: 'center' });
  doc.fontSize(12).font('Helvetica').fillColor('#1A6A38').text('Quincaillerie, Alimentation & Divers', { align: 'center' });
  doc.text('Sélibaby, Marché centre-ville, Mauritanie', { align: 'center' });
  doc.text('Tél : 00222 46 43 22 53 / 00222 42 43 22 53', { align: 'center' });
  doc.moveDown(1);
  doc.strokeColor('#F4B41A').lineWidth(2).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown(1);
}

// Dessine le tableau des articles, passe à la page suivante si besoin. Retourne la position y finale.
function drawItemsTable(doc, items) {
  const head = (y) => {
    doc.rect(50, y, 500, 20).fill('#F4F7F6');
    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(10);
    doc.text('Désignation', 60, y + 5);
    doc.text('Qté', 350, y + 5);
    doc.text('Prix Unit.', 400, y + 5);
    doc.text('Total', 480, y + 5);
    doc.font('Helvetica');
    return y + 25;
  };

  let y = head(doc.y);
  for (const item of items) {
    if (y > PAGE_BOTTOM) {
      doc.addPage();
      y = head(50);
    }
    const qty = Number(item.qty) || 0;
    const prix = Number(item.prix) || 0;
    doc.fillColor('#000000').fontSize(10);
    doc.text(String(item.nom || '').slice(0, 80), 60, y, { width: 280, height: 14, ellipsis: true });
    doc.text(String(qty), 350, y, { width: 45, lineBreak: false });
    doc.text(`${fmtMoney(prix)} MRU`, 400, y, { width: 75, lineBreak: false });
    doc.text(`${fmtMoney(prix * qty)} MRU`, 480, y, { width: 70, lineBreak: false });
    y += 20;
  }
  doc.moveTo(50, y).lineTo(550, y).stroke();
  return y + 10;
}

// Saute à une nouvelle page si on approche du bas
function ensureSpace(doc, y, needed = 80) {
  if (y > PAGE_BOTTOM - needed) {
    doc.addPage();
    return 50;
  }
  return y;
}

module.exports = { drawHeader, drawItemsTable, ensureSpace, fmtMoney };
