const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('../cloudinary');
const db = require('../db');
const { verifyAdmin } = require('../middleware/auth');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const streamUpload = (buffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder: 'mangassouba_banners' }, (error, result) => {
      if (result) resolve(result); else reject(error);
    });
    stream.end(buffer);
  });
};

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
  const { title, description, link_url } = req.body;
  let imageUrl = null;

  try {
    if (req.file) {
      const result = await streamUpload(req.file.buffer);
      imageUrl = result.secure_url;
    }
    const result = await db.query(
      'INSERT INTO banners (title, description, image_url, link_url) VALUES ($1, $2, $3, $4) RETURNING *',
      [title, description, imageUrl, link_url]
    );
    res.status(201).json({ message: 'Annonce créée !', banner: result.rows[0] });
  } catch (err) { res.status(500).json({ message: 'Erreur.' }); }
});

// 4. SUPPRIMER UNE ANNONCE
router.delete('/:id', verifyAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM banners WHERE id = $1', [req.params.id]);
    res.json({ message: 'Annonce supprimée.' });
  } catch (err) { res.status(500).json({ message: 'Erreur.' }); }
});

module.exports = router;