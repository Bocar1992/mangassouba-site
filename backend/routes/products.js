const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('../cloudinary');
const db = require('../db');
const { verifyAdmin } = require('../middleware/auth');

const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // Limite à 50 Mo pour les vidéos
});

// Fonction générique pour uploader image ou vidéo
const streamUpload = (buffer, resourceType = 'image') => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'mangassouba_produits', resource_type: resourceType },
      (error, result) => {
        if (result) resolve(result); else reject(error);
      }
    );
    stream.end(buffer);
  });
};

async function traduireTexte(texte, langueCible) {
  if (!texte) return null;
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=fr&tl=${langueCible}&dt=t&q=${encodeURIComponent(texte)}`;
    const reponse = await fetch(url);
    const data = await reponse.json();
    return data[0][0][0];
  } catch (err) { return null; }
}

router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT p.*, c.nom as categorie_nom, c.nom_en as categorie_nom_en, c.nom_ar as categorie_nom_ar 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      ORDER BY p.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ message: 'Erreur serveur.' }); }
});

router.post('/', verifyAdmin, upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]), async (req, res) => {
  const { nom, description, prix, prix_achat, prix_gros, seuil_gros, stock, category_id } = req.body;
  let mediaUrl = null;
  let videoUrl = null;

  try {
    const nom_en = await traduireTexte(nom, 'en');
    const nom_ar = await traduireTexte(nom, 'ar');
    const description_en = await traduireTexte(description, 'en');
    const description_ar = await traduireTexte(description, 'ar');

    if (req.files && req.files['image']) {
      const result = await streamUpload(req.files['image'][0].buffer, 'image');
      mediaUrl = result.secure_url; 
    }
    if (req.files && req.files['video']) {
      const result = await streamUpload(req.files['video'][0].buffer, 'video');
      videoUrl = result.secure_url;
    }

    const result = await db.query(
      `INSERT INTO products (nom, nom_en, nom_ar, prix, prix_achat, prix_gros, seuil_gros, description, description_en, description_ar, stock, category_id, media, video) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
      [nom, nom_en, nom_ar, prix, prix_achat || 0, prix_gros || 0, seuil_gros || 10, description, description_en, description_ar, stock, category_id, mediaUrl, videoUrl]
    );

    res.status(201).json({ message: 'Produit ajouté !', product: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur lors de l\'ajout.' });
  }
});

router.put('/:id', verifyAdmin, upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]), async (req, res) => {
  const { id } = req.params;
  const { nom, description, prix, prix_achat, prix_gros, seuil_gros, stock, category_id, existing_media, existing_video } = req.body;
  let mediaUrl = existing_media;
  let videoUrl = existing_video;

  try {
    const nom_en = await traduireTexte(nom, 'en');
    const nom_ar = await traduireTexte(nom, 'ar');
    const description_en = await traduireTexte(description, 'en');
    const description_ar = await traduireTexte(description, 'ar');

    if (req.files && req.files['image']) {
      const result = await streamUpload(req.files['image'][0].buffer, 'image');
      mediaUrl = result.secure_url; 
    }
    if (req.files && req.files['video']) {
      const result = await streamUpload(req.files['video'][0].buffer, 'video');
      videoUrl = result.secure_url;
    }

    const result = await db.query(
      `UPDATE products 
       SET nom=$1, nom_en=$2, nom_ar=$3, prix=$4, prix_achat=$5, prix_gros=$6, seuil_gros=$7, description=$8, description_en=$9, description_ar=$10, stock=$11, category_id=$12, media=$13, video=$14 
       WHERE id=$15 RETURNING *`,
      [nom, nom_en, nom_ar, prix, prix_achat || 0, prix_gros || 0, seuil_gros || 10, description, description_en, description_ar, stock, category_id, mediaUrl, videoUrl, id]
    );

    res.json({ message: 'Produit modifié !', product: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur lors de la modification.' });
  }
});

router.delete('/:id', verifyAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM products WHERE id = $1', [req.params.id]);
    res.json({ message: 'Produit supprimé.' });
  } catch (err) { res.status(500).json({ message: 'Erreur serveur.' }); }
});

module.exports = router;