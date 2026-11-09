const express = require('express');
const router = express.Router();
const db = require('../db');
require('dotenv').config();

// Fonction pour appeler l'API Gemini
async function appelerGemini(prompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const reponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
        })
    });
    const data = await reponse.json();
    if (data.candidates && data.candidates.length > 0) {
        return data.candidates[0].content.parts[0].text;
    }
    return "Désolé, je n'ai pas pu générer de réponse.";
}

// 1. CHAT POUR LES CLIENTS
router.post('/chat', async (req, res) => {
    const { message } = req.body;
    try {
        // On récupère les produits pour donner du contexte à l'IA
        const produitsRes = await db.query('SELECT nom, prix, stock FROM products LIMIT 50');
        const listeProduits = produitsRes.rows.map(p => `${p.nom} (${p.prix} MRU, stock: ${p.stock})`).join(', ');

        const prompt = `
        Tu es l'assistant virtuel de la boutique "Mangassouba et Fils" située à Sélibaby, Mauritanie (marché centre-ville).
        Numéros de téléphone : 00222 46 43 22 53 / 00222 42 43 22 53.
        Horaires : Tous les jours (sauf vendredi) : 08h00 - 18h00.
        Ton rôle est de répondre poliment aux clients, de les aider à trouver des produits et de les conseiller.
        Voici la liste des produits actuellement en stock : ${listeProduits || 'Aucun produit pour le moment'}.
        
        Question du client : "${message}"
        Réponds de manière brève, chaleureuse et utile.
        `;

        const reponseIA = await appelerGemini(prompt);
        res.json({ response: reponseIA });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erreur de l\'IA.' });
    }
});

// 2. GÉNÉRATION DE PRODUIT POUR L'ADMIN
router.post('/admin/generate-product', async (req, res) => {
    const { texte } = req.body;
    try {
        const prompt = `
        Tu es un assistant pour le gérant de la boutique.
        Voici un texte brut fourni par le gérant : "${texte}"
        Tu dois extraire les informations et générer un objet JSON STRICTEMENT valide avec les clés suivantes :
        - "nom" (string)
        - "prix" (number, en MRU)
        - "description" (string, courte)
        - "stock" (number)
        - "prix_achat" (number, estime-le si non fourni, sinon 0)
        
        Ne renvoie QUE le JSON, sans texte avant ou après, sans balises markdown.
        `;

        let reponseIA = await appelerGemini(prompt);
        // Nettoyer la réponse au cas où l'IA ajoute des balises markdown
        reponseIA = reponseIA.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const produitJSON = JSON.parse(reponseIA);
        res.json(produitJSON);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erreur lors de la génération.' });
    }
});

module.exports = router;