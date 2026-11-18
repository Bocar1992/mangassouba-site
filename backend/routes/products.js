const express = require('express');
const router = express.Router();
const multer = require('multer');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const csv = require('csv-parser'); // NOUVEAU
const { Readable } = require('stream'); // NOUVEAU
const cloudinary = require('../cloudinary');
const db = require('../db');
const { verifyAdmin } = require('../middleware/auth');

const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, 
    fileFilter: (req, file, cb) => {
        // On accepte les images, vidéos, et fichiers CSV
        if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/') || file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Seuls les images, vidéos et fichiers CSV sont autorisés.'));
        }
    }
});

const streamUpload = (buffer, resourceType = 'image') => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder: 'mangassouba_produits', resource_type: resourceType }, (error, result) => {
      if (result) resolve(result); else reject(error);
    });
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

// 1. VOIR TOUS LES PRODUITS
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT p.*, c.nom as categorie_nom, c.nom_en as categorie_nom_en, c.nom_ar as categorie_nom_ar 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      ORDER BY p.created_at DESC
    `);
    
    let produits = result.rows;
    let isSuperAdmin = false;
    const authHeader = req.headers['authorization'];
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (decoded.role === 'superadmin') isSuperAdmin = true;
        } catch (e) {}
    }

    if (!isSuperAdmin) {
        produits = produits.map(p => { delete p.prix_achat; return p; });
    }
    res.json(produits);
  } catch (err) { res.status(500).json({ message: 'Erreur serveur.' }); }
});

// 2. EXPORTER LES PRODUITS EN CSV (Admin)
router.get('/export', verifyAdmin, async (req, res) => {
    try {
        const result = await db.query('SELECT id, nom, prix, stock, category_id, description, prix_achat, prix_gros, seuil_gros FROM products ORDER BY id ASC');
        
        // Création de l'en-tête CSV
        let csvContent = "id,nom,prix,stock,category_id,description,prix_achat,prix_gros,seuil_gros\n";
        
        // Ajout des lignes
        result.rows.forEach(p => {
            // On entoure la description de guillemets pour éviter les problèmes de virgules
            const desc = p.description ? `"${p.description.replace(/"/g, '""')}"` : '""';
            const nom = p.nom.replace(/,/g, ' '); // On retire les virgules des noms
            csvContent += `${p.id},${nom},${p.prix},${p.stock},${p.category_id || ''},${desc},${p.prix_achat || 0},${p.prix_gros || 0},${p.seuil_gros || 10}\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="catalogue_mangassouba.csv"');
        res.status(200).send(csvContent);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erreur lors de l'exportation." });
    }
});

// 3. IMPORTER DES PRODUITS DEPUIS UN CSV (Admin)
router.post('/import', verifyAdmin, upload.single('csvFile'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "Aucun fichier CSV fourni." });

    const results = [];
    const errors = [];
    
    // On transforme le buffer du fichier en un flux lisible
    const stream = Readable.from(req.file.buffer.toString());

    stream
        .pipe(csv({ separator: ',' }))
        .on('data', (data) => results.push(data))
        .on('end', async () => {
            let successCount = 0;
            const client = await db.pool.connect();

            try {
                await client.query('BEGIN');

                for (let row of results) {
                    // Vérification des champs obligatoires
                    if (!row.nom || !row.prix || !row.stock) {
                        errors.push(`Ligne ignorée : nom, prix ou stock manquant.`);
                        continue;
                    }

                    const nom = row.nom.trim();
                    const prix = parseFloat(row.prix);
                    const stock = parseInt(row.stock);
                    const category_id = row.category_id ? parseInt(row.category_id) : null;
                    const description = row.description || '';
                    const prix_achat = row.prix_achat ? parseFloat(row.prix_achat) : 0;
                    const prix_gros = row.prix_gros ? parseFloat(row.prix_gros) : 0;
                    const seuil_gros = row.seuil_gros ? parseInt(row.seuil_gros) : 10;

                    if (isNaN(prix) || isNaN(stock)) {
                        errors.push(`Ligne ignorée (${nom}) : Prix ou stock invalide.`);
                        continue;
                    }

                    // Traduction automatique
                    const nom_en = await traduireTexte(nom, 'en');
                    const nom_ar = await traduireTexte(nom, 'ar');
                    const desc_en = await traduireTexte(description, 'en');
                    const desc_ar = await traduireTexte(description, 'ar');

                    await client.query(
                        `INSERT INTO products (nom, nom_en, nom_ar, prix, prix_achat, prix_gros, seuil_gros, description, description_en, description_ar, stock, category_id) 
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
                        [nom, nom_en, nom_ar, prix, prix_achat, prix_gros, seuil_gros, description, desc_en, desc_ar, stock, category_id]
                    );
                    successCount++;
                }

                await client.query('COMMIT');
                res.status(200).json({ 
                    message: `${successCount} produits importés avec succès !`, 
                    errors: errors.length > 0 ? errors : null 
                });

            } catch (err) {
                await client.query('ROLLBACK');
                console.error("Erreur d'import:", err);
                res.status(500).json({ message: "Erreur lors de l'insertion en base de données." });
            } finally {
                client.release();
            }
        });
});

// 4. AJOUTER UN PRODUIT (Admin)
router.post('/', verifyAdmin, upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]), async (req, res) => {
  const { nom, description, prix, prix_achat, prix_gros, seuil_gros, stock, category_id } = req.body;
  
  if (parseFloat(prix) < 0 || parseInt(stock) < 0) {
      return res.status(400).json({ message: "Le prix et le stock ne peuvent pas être négatifs." });
  }

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

    const finalPrixAchat = req.admin.role === 'superadmin' ? (prix_achat || 0) : 0;

    const result = await db.query(
      `INSERT INTO products (nom, nom_en, nom_ar, prix, prix_achat, prix_gros, seuil_gros, description, description_en, description_ar, stock, category_id, media, video) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
      [nom, nom_en, nom_ar, prix, finalPrixAchat, prix_gros || 0, seuil_gros || 10, description, description_en, description_ar, stock, category_id, mediaUrl, videoUrl]
    );

    res.status(201).json({ message: 'Produit ajouté !', product: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur lors de l\'ajout.' });
  }
});

// 5. MODIFIER UN PRODUIT (Admin)
router.put('/:id', verifyAdmin, upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]), async (req, res) => {
  const { id } = req.params;
  const { nom, description, prix, prix_achat, prix_gros, seuil_gros, stock, category_id, existing_media, existing_video } = req.body;
  
  if (parseFloat(prix) < 0 || parseInt(stock) < 0) {
      return res.status(400).json({ message: "Le prix et le stock ne peuvent pas être négatifs." });
  }

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

    let finalPrixAchat = prix_achat || 0;
    if (req.admin.role !== 'superadmin') {
        const oldProd = await db.query('SELECT prix_achat FROM products WHERE id = $1', [id]);
        finalPrixAchat = oldProd.rows[0] ? oldProd.rows[0].prix_achat : 0;
    }

    const result = await db.query(
      `UPDATE products 
       SET nom=$1, nom_en=$2, nom_ar=$3, prix=$4, prix_achat=$5, prix_gros=$6, seuil_gros=$7, description=$8, description_en=$9, description_ar=$10, stock=$11, category_id=$12, media=$13, video=$14 
       WHERE id=$15 RETURNING *`,
      [nom, nom_en, nom_ar, prix, finalPrixAchat, prix_gros || 0, seuil_gros || 10, description, description_en, description_ar, stock, category_id, mediaUrl, videoUrl, id]
    );

    res.json({ message: 'Produit modifié !', product: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur lors de la modification.' });
  }
});

// 6. SUPPRIMER UN PRODUIT (Admin)
router.delete('/:id', verifyAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM products WHERE id = $1', [req.params.id]);
    res.json({ message: 'Produit supprimé.' });
  } catch (err) { res.status(500).json({ message: 'Erreur serveur.' }); }
});

module.exports = router;