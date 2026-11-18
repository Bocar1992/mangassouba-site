const express = require('express');
const router = express.Router();
const db = require('../db');
require('dotenv').config();

async function appelerOpenRouter(prompt) {
    // Vérification que la clé API est bien présente
    if (!process.env.OPENROUTER_API_KEY) {
        console.error("❌ ERREUR : La variable OPENROUTER_API_KEY n'est pas définie sur Render.");
        throw new Error("Clé API manquante.");
    }

    try {
        const url = 'https://openrouter.ai/api/v1/chat/completions';
        const reponse = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://mangassouba-frontend.onrender.com', 
                'X-Title': 'Mangassouba et Fils'
            },
            body: JSON.stringify({
                // NOUVEAU MODÈLE GRATUIT ET ACTIF
                model: 'inclusionai/ling-3.0-flash:free', 
                messages: [{ role: 'user', content: prompt }]
            })
        });
        
        const data = await reponse.json();
        
        // Gestion des erreurs renvoyées par OpenRouter
        if (data.error) {
            console.error("❌ Erreur OpenRouter :", data.error);
            throw new Error(data.error.message);
        }

        // Vérification que la réponse contient bien un choix
        if (data.choices && data.choices.length > 0 && data.choices[0].message && data.choices[0].message.content) {
            return data.choices[0].message.content;
        } else {
            console.error("❌ Réponse vide ou invalide reçue :", JSON.stringify(data));
            throw new Error("L'API n'a renvoyé aucune réponse valide.");
        }
    } catch (err) {
        console.error("❌ Erreur de connexion à OpenRouter :", err.message);
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
        
        const reponseIA = await appelerOpenRouter(prompt);
        res.json({ response: reponseIA });
    } catch (err) {
        res.status(500).json({ response: "Désolé, je ne peux pas répondre pour le moment. Veuillez nous contacter au 00222 46 43 22 53." });
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
        
        let reponseIA = await appelerOpenRouter(prompt);
        
        // Nettoyage de sécurité
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