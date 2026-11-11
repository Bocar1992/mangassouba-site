const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('../cloudinary');
const db = require('../db');
const { verifyAdmin } = require('../middleware/auth');
const { HttpError, cleanStr, toId, safeLink } = require('../utils/validate');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype);
    cb(ok ? null : new HttpError(400, 'Seules les images (jpg, png, webp, gif) sont acceptées.'), ok);
  },
});

const streamUpload = (buffer) => new Promise((resolve, reject) => {
  const stream = cloudinary.uploader.upload_stream(
    { folder: 'mangassouba_banners', transformation: [{ width: 1600, crop: 'limit', quality: 'auto' }] },
    (error, result) => { if (result) resolve(result); else reject(error); }
  );
  stream.end(buffer);
});

// 1. VOIR TOUTES LES ANNONCES (Public)
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM banners WHERE is_active = true ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ message: 'Erreur serveur.' }); }
});

// 2. VOIR TOUTES LES ANNONCES POUR L'ADMIN (Même inactives)
router.get('/admin', verifyAdmin, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM banners ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ message: 'Erreur serveur.' }); }
});

// 3. AJOUTER UNE ANNONCE
router.post('/', verifyAdmin, upload.single('image'), async (req, res) => {
  const title = cleanStr(req.body.title, 150);
  const description = cleanStr(req.body.description, 500);
  const rawLink = cleanStr(req.body.link_url, 500);
  if (!title) return res.status(400).json({ message: 'Le titre est obligatoire.' });
  // Lien http(s) uniquement : "javascript:..." serait une faille XSS
  const link_url = rawLink ? safeLink(rawLink) : null;
  if (rawLink && !link_url) return res.status(400).json({ message: 'Lien invalide (il doit commencer par http:// ou https://).' });

  try {
    let imageUrl = null;
    if (req.file) imageUrl = (await streamUpload(req.file.buffer)).secure_url;
    const result = await db.query(
      'INSERT INTO banners (title, description, image_url, link_url) VALUES ($1, $2, $3, $4) RETURNING *',
      [title, description, imageUrl, link_url]
    );
    res.status(201).json({ message: 'Annonce créée !', banner: result.rows[0] });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Erreur.' }); }
});

// 4. SUPPRIMER UNE ANNONCE
router.delete('/:id', verifyAdmin, async (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Identifiant invalide.' });
  try {
    await db.query('DELETE FROM banners WHERE id = $1', [id]);
    res.json({ message: 'Annonce supprimée.' });
  } catch (err) { res.status(500).json({ message: 'Erreur.' }); }
});

module.exports = router;
