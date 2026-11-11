const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('../cloudinary');
const db = require('../db');
const { verifyAdmin } = require('../middleware/auth');
const { HttpError, cleanStr, toId, toInt, toMoney } = require('../utils/validate');
const { traduireEnAr } = require('../utils/translate');

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const MAX_IMAGE = 8 * 1024 * 1024;   // 8 Mo
const MAX_VIDEO = 50 * 1024 * 1024;  // 50 Mo

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO, files: 2 },
  fileFilter: (req, file, cb) => {
    const ok = file.fieldname === 'image' ? IMAGE_TYPES.includes(file.mimetype)
             : file.fieldname === 'video' ? VIDEO_TYPES.includes(file.mimetype)
             : false;
    cb(ok ? null : new HttpError(400, 'Format de fichier non accepté (images : jpg, png, webp, gif — vidéos : mp4, webm, mov).'), ok);
  },
});
const uploadFields = upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]);

const streamUpload = (buffer, resourceType = 'image') => new Promise((resolve, reject) => {
  const options = { folder: 'mangassouba_produits', resource_type: resourceType };
  // Images : réduites à 1200 px max et compressées automatiquement => site plus rapide
  if (resourceType === 'image') options.transformation = [{ width: 1200, crop: 'limit', quality: 'auto' }];
  const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
    if (result) resolve(result); else reject(error);
  });
  stream.end(buffer);
});

// Lit et valide les champs du formulaire produit
function parseProductBody(body) {
  const nom = cleanStr(body.nom, 200);
  const description = cleanStr(body.description, 5000);
  const prix = toMoney(body.prix);
  const prix_achat = toMoney(body.prix_achat || 0);
  const prix_gros = toMoney(body.prix_gros || 0);
  const seuil_gros = toInt(body.seuil_gros || 10, 1, 100000);
  const stock = toInt(body.stock, 0, 10000000);
  const category_id = body.category_id ? toId(body.category_id) : null;

  if (!nom) throw new HttpError(400, 'Le nom du produit est obligatoire.');
  if (prix === null) throw new HttpError(400, 'Prix invalide.');
  if (prix_achat === null || prix_gros === null) throw new HttpError(400, 'Prix d\'achat ou de gros invalide.');
  if (seuil_gros === null) throw new HttpError(400, 'Seuil de gros invalide.');
  if (stock === null) throw new HttpError(400, 'Stock invalide (entier positif).');
  if (body.category_id && !category_id) throw new HttpError(400, 'Catégorie invalide.');
  return { nom, description, prix, prix_achat, prix_gros, seuil_gros, stock, category_id };
}

async function uploadMedia(files) {
  const out = {};
  if (files && files['image']) {
    if (files['image'][0].size > MAX_IMAGE) throw new HttpError(400, 'Image trop lourde (8 Mo maximum).');
    out.media = (await streamUpload(files['image'][0].buffer, 'image')).secure_url;
  }
  if (files && files['video']) {
    out.video = (await streamUpload(files['video'][0].buffer, 'video')).secure_url;
  }
  return out;
}

// ---------------------------------------------------------------------------
// LISTE PUBLIQUE : sans prix d'achat. Le stock exact n'est pas publié, seulement "disponible".
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT p.id, p.category_id, p.nom, p.nom_en, p.nom_ar, p.prix, p.prix_gros, p.seuil_gros,
             p.description, p.description_en, p.description_ar, p.media, p.video, p.created_at,
             (p.stock > 0) AS disponible,
             c.nom AS categorie_nom, c.nom_en AS categorie_nom_en, c.nom_ar AS categorie_nom_ar
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ORDER BY p.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Erreur serveur.' }); }
});

// LISTE ADMIN : toutes les colonnes (prix d'achat, stock exact...)
router.get('/admin', verifyAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT p.*, c.nom AS categorie_nom, c.nom_en AS categorie_nom_en, c.nom_ar AS categorie_nom_ar
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ORDER BY p.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Erreur serveur.' }); }
});

router.post('/', verifyAdmin, uploadFields, async (req, res) => {
  const data = parseProductBody(req.body);

  try {
    const [tr_nom, tr_desc, media] = await Promise.all([
      traduireEnAr(data.nom),
      traduireEnAr(data.description),
      uploadMedia(req.files),
    ]);

    const result = await db.query(
      `INSERT INTO products (nom, nom_en, nom_ar, prix, prix_achat, prix_gros, seuil_gros, description, description_en, description_ar, stock, category_id, media, video)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
      [data.nom, tr_nom.en, tr_nom.ar, data.prix, data.prix_achat, data.prix_gros, data.seuil_gros,
       data.description, tr_desc.en, tr_desc.ar, data.stock, data.category_id, media.media || null, media.video || null]
    );
    res.status(201).json({ message: 'Produit ajouté !', product: result.rows[0] });
  } catch (err) {
    if (err instanceof HttpError) throw err;
    console.error(err);
    res.status(500).json({ message: 'Erreur lors de l\'ajout.' });
  }
});

router.put('/:id', verifyAdmin, uploadFields, async (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Identifiant invalide.' });
  const data = parseProductBody(req.body);

  try {
    const cur = await db.query(
      'SELECT nom, nom_en, nom_ar, description, description_en, description_ar, media, video FROM products WHERE id = $1', [id]
    );
    if (cur.rowCount === 0) return res.status(404).json({ message: 'Produit introuvable.' });
    const old = cur.rows[0];

    // On ne retraduit que si le texte a changé (et si la traduction précédente existait)
    const nomChange = data.nom !== old.nom || !old.nom_en || !old.nom_ar;
    const descChange = data.description !== (old.description || '') || (data.description && (!old.description_en || !old.description_ar));
    const [tr_nom, tr_desc, media] = await Promise.all([
      nomChange ? traduireEnAr(data.nom) : { en: old.nom_en, ar: old.nom_ar },
      descChange ? traduireEnAr(data.description) : { en: old.description_en, ar: old.description_ar },
      uploadMedia(req.files),
    ]);

    // Sans nouveau fichier on garde ce qui est déjà en base (l'URL envoyée par le navigateur est ignorée)
    const result = await db.query(
      `UPDATE products
       SET nom=$1, nom_en=$2, nom_ar=$3, prix=$4, prix_achat=$5, prix_gros=$6, seuil_gros=$7, description=$8, description_en=$9, description_ar=$10, stock=$11, category_id=$12, media=$13, video=$14
       WHERE id=$15 RETURNING *`,
      [data.nom, tr_nom.en, tr_nom.ar, data.prix, data.prix_achat, data.prix_gros, data.seuil_gros,
       data.description, tr_desc.en, tr_desc.ar, data.stock, data.category_id,
       media.media || old.media, media.video || old.video, id]
    );
    res.json({ message: 'Produit modifié !', product: result.rows[0] });
  } catch (err) {
    if (err instanceof HttpError) throw err;
    console.error(err);
    res.status(500).json({ message: 'Erreur lors de la modification.' });
  }
});

router.delete('/:id', verifyAdmin, async (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Identifiant invalide.' });
  try {
    await db.query('DELETE FROM products WHERE id = $1', [id]);
    res.json({ message: 'Produit supprimé.' });
  } catch (err) { res.status(500).json({ message: 'Erreur serveur.' }); }
});

module.exports = router;
