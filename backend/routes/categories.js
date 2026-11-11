const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyAdmin } = require('../middleware/auth');
const { cleanStr, toId } = require('../utils/validate');
const { traduireEnAr } = require('../utils/translate');

// "Électricité" -> "electricite" ; texte arabe ou vide -> "cat-xxxx"
function makeSlug(nom) {
  const s = nom.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  return s || 'cat-' + Date.now().toString(36);
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

// Insère / met à jour en gérant les collisions de slug (deux noms différents, même slug)
async function saveWithSlugRetry(sqlFn, nom) {
  let slug = makeSlug(nom);
  try {
    return await sqlFn(slug);
  } catch (err) {
    if (err.code === '23505' && /slug/.test(err.constraint || '')) {
      slug = `${slug}-${Date.now().toString(36)}`;
      return await sqlFn(slug);
    }
    throw err;
  }
}

// 2. AJOUTER UNE CATÉGORIE
router.post('/', verifyAdmin, async (req, res) => {
  const nom = cleanStr(req.body.nom, 100);
  if (!nom) return res.status(400).json({ message: 'Le nom est obligatoire.' });
  const parentId = req.body.parent_id ? toId(req.body.parent_id) : null;
  if (req.body.parent_id && !parentId) return res.status(400).json({ message: 'Catégorie parente invalide.' });

  const { en: nom_en, ar: nom_ar } = await traduireEnAr(nom);

  try {
    const result = await saveWithSlugRetry((slug) => db.query(
      'INSERT INTO categories (nom, nom_en, nom_ar, slug, parent_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [nom, nom_en, nom_ar, slug, parentId]
    ), nom);
    res.status(201).json({ message: 'Catégorie ajoutée et traduite !', category: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ message: 'Cette catégorie existe déjà.' });
    if (err.code === '23503') return res.status(400).json({ message: 'Catégorie parente introuvable.' });
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// 3. MODIFIER UNE CATÉGORIE
router.put('/:id', verifyAdmin, async (req, res) => {
  const id = toId(req.params.id);
  const nom = cleanStr(req.body.nom, 100);
  if (!id) return res.status(400).json({ message: 'Identifiant invalide.' });
  if (!nom) return res.status(400).json({ message: 'Le nom est obligatoire.' });
  // Une catégorie ne peut pas être sa propre parente
  const parentId = req.body.parent_id ? toId(req.body.parent_id) : null;
  const parentIdFinal = parentId && parentId !== id ? parentId : null;

  const { en: nom_en, ar: nom_ar } = await traduireEnAr(nom);

  try {
    const result = await saveWithSlugRetry((slug) => db.query(
      'UPDATE categories SET nom = $1, nom_en = $2, nom_ar = $3, slug = $4, parent_id = $5 WHERE id = $6 RETURNING *',
      [nom, nom_en, nom_ar, slug, parentIdFinal, id]
    ), nom);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Catégorie introuvable.' });
    res.json({ message: 'Catégorie modifiée et traduite !', category: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ message: 'Cette catégorie existe déjà.' });
    if (err.code === '23503') return res.status(400).json({ message: 'Catégorie parente introuvable.' });
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// 4. SUPPRIMER UNE CATÉGORIE
router.delete('/:id', verifyAdmin, async (req, res) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Identifiant invalide.' });
  try {
    await db.query('DELETE FROM categories WHERE id = $1', [id]);
    res.json({ message: 'Catégorie supprimée.' });
  } catch (err) { res.status(500).json({ message: 'Erreur serveur.' }); }
});

module.exports = router;
