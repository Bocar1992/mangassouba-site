const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyAdmin } = require('../middleware/auth');

// FONCTION MAGIQUE DE TRADUCTION AUTOMATIQUE
async function traduireTexte(texte, langueCible) {
  if (!texte) return null;
  try {
    // Utilisation de l'API gratuite de Google Translate
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=fr&tl=${langueCible}&dt=t&q=${encodeURIComponent(texte)}`;
    const reponse = await fetch(url);
    const data = await reponse.json();
    return data[0][0][0]; // On récupère uniquement le texte traduit
  } catch (err) {
    console.error("Erreur de traduction :", err);
    return null; // En cas d'erreur, on laisse vide
  }
}

// 1. VOIR TOUTES LES CATÉGORIES
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT c.*, p.nom as parent_nom, p.nom_en as parent_nom_en, p.nom_ar as parent_nom_ar 
      FROM categories c 
      LEFT JOIN categories p ON c.parent_id = p.id 
      ORDER BY c.parent_id NULLS FIRST, c.nom ASC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ message: 'Erreur serveur.' }); }
});

// 2. AJOUTER UNE CATÉGORIE
router.post('/', verifyAdmin, async (req, res) => {
  const { nom, parent_id } = req.body;
  if (!nom) return res.status(400).json({ message: 'Le nom est obligatoire.' });

  // On traduit automatiquement vers l'anglais et l'arabe
  const nom_en = await traduireTexte(nom, 'en');
  const nom_ar = await traduireTexte(nom, 'ar');

  const slug = nom.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  const parentIdFinal = parent_id ? parseInt(parent_id) : null;

  try {
    const result = await db.query(
      'INSERT INTO categories (nom, nom_en, nom_ar, slug, parent_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [nom, nom_en, nom_ar, slug, parentIdFinal]
    );
    res.status(201).json({ message: 'Catégorie ajoutée et traduite !', category: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ message: 'Cette catégorie existe déjà.' });
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// 3. MODIFIER UNE CATÉGORIE
router.put('/:id', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { nom, parent_id } = req.body;
  
  // On retraduit si le nom a changé
  const nom_en = await traduireTexte(nom, 'en');
  const nom_ar = await traduireTexte(nom, 'ar');
  
  const slug = nom.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  const parentIdFinal = (parent_id && parent_id !== id) ? parseInt(parent_id) : null;

  try {
    const result = await db.query(
      'UPDATE categories SET nom = $1, nom_en = $2, nom_ar = $3, slug = $4, parent_id = $5 WHERE id = $6 RETURNING *',
      [nom, nom_en, nom_ar, slug, parentIdFinal, id]
    );
    res.json({ message: 'Catégorie modifiée et traduite !', category: result.rows[0] });
  } catch (err) { res.status(500).json({ message: 'Erreur serveur.' }); }
});

// 4. SUPPRIMER UNE CATÉGORIE
router.delete('/:id', verifyAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM categories WHERE id = $1', [req.params.id]);
    res.json({ message: 'Catégorie supprimée.' });
  } catch (err) { res.status(500).json({ message: 'Erreur serveur.' }); }
});

module.exports = router;