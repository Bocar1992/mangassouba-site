const express = require('express');
const router = express.Router();
const db = require('../db');
require('dotenv').config();

async function appelerGemini(prompt) {
    try {
        // ⚠️ NOUVEAU MODÈLE : gemini-2.5-flash (compatible avec les nouvelles clés AQ.)
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
        
        const reponse = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                contents: [{ parts: [{ text: prompt }] }] 
            })
        });
        
        const data = await reponse.json();
        
        // Si Google répond avec une erreur, on l'affiche dans les logs Render
        if (data.error) {
            console.error("Erreur renvoyée par Google :", data.error);
            throw new Error(data.error.message);
        }

        if (data.candidates && data.candidates.length > 0) {
            return data.candidates[0].content.parts[0].text;
        } else {
            throw new Error("L'API Gemini a renvoyé une réponse vide.");
        }
    } catch (err) {
        console.error("❌ Erreur de connexion à Gemini :", err.message);
        throw err;
    }
}

// 1. CHAT POUR LES CLIENTS
router.post('/chat', async (req, res) => {
    const { message } = req.body;
    try {
        const produitsRes = await db.query('SELECT nom, prix, stock FROM products LIMIT 50');
        const listeProduits = produitsRes.rows.map(p => `${p.nom} (${p.prix} MRU, stock: ${p.stock})`).join(', ');

        const prompt = `
        Tu es l'assistant virtuel de la boutique "Mangassouba et Fils" située à Sélibaby, Mauritanie.
        Numéros de téléphone : 00222 46 43 22 53 / 00222 42 43 22 53.
        Horaires : Tous les jours (sauf vendredi) : 08h00 - 18h00.
        Produits en stock : ${listeProduits || 'Aucun pour le moment'}.
        Question du client : "${message}"
        Réponds brièvement et poliment.
        `;
        
        const reponseIA = await appelerGemini(prompt);
        res.json({ response: reponseIA });
    } catch (err) {
        res.status(500).json({ response: "Désolé, je ne peux pas répondre pour le moment (Erreur technique). Veuillez nous contacter au 00222 46 43 22 53." });
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
        - "prix" (number)
        - "description" (string, courte)
        - "stock" (number)
        - "prix_achat" (number, estime-le si non fourni, sinon 0)
        
        Ne renvoie QUE le JSON, sans texte avant ou après, sans balises markdown.
        `;
        
        let reponseIA = await appelerGemini(prompt);
        
        // Nettoyage de sécurité au cas où l'IA ajoute des balises ```
        reponseIA = reponseIA.replace(/```json/g, '').replace(/```/g, '').trim();
        
        try {
            const produitJSON = JSON.parse(reponseIA);
            res.json(produitJSON);
        } catch (parseError) {
            console.error("L'IA n'a pas renvoyé du JSON valide. Texte reçu :", reponseIA);
            res.status(500).json({ message: "L'IA a répondu, mais pas dans le bon format." });
        }
    } catch (err) {
        res.status(500).json({ message: "Erreur de communication avec l'IA." });
    }
});

module.exports = router;