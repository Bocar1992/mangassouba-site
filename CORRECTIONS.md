# Corrections appliquées — Mangassouba et Fils

Toutes les corrections ont été testées : 75 tests automatiques sur l'API (PostgreSQL 16 réel) et 25 tests dans un vrai navigateur (Chromium), dont des attaques XSS volontaires.

## ⚠️ Ordre de mise en ligne (important)

1. **Sauvegardez votre base** (export Render).
2. **Exécutez la migration SQL** une seule fois : `database/migration_001_correctifs.sql`
   (elle ajoute le statut « annulée », les tables/colonnes manquantes, les index, et met le compte n°1 en Super Admin. Elle ne supprime rien et peut être relancée sans risque.)
3. **Variables d'environnement sur Render** (backend) :
   - `NODE_ENV=production`
   - `CORS_ORIGINS=https://votre-site-frontend.com` (adresse(s) de votre frontend, séparées par des virgules)
   - `JWT_SECRET` et `JWT_CLIENT_SECRET` : deux valeurs **différentes**, aléatoires, 64 caractères ou plus.
     Générer : `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
   - Changer ces secrets déconnecte tout le monde : c'est normal.
4. **Déployez backend ET frontend ensemble** (le nouveau frontend ne fonctionne qu'avec le nouveau backend et inversement).
5. **Si le fichier `.env` a déjà été partagé** (envoi par mail, archive, etc.) : régénérez les clés Cloudinary, Gemini et le mot de passe de la base.
6. Si votre frontend n'est **pas** hébergé sur le même domaine que l'API ou si vous changez l'adresse de l'API : mettez à jour la balise `Content-Security-Policy` en haut de `index.html` et `admin.html` (rubrique `connect-src`).

## Failles de sécurité corrigées

| Problème | Correction |
|---|---|
| Les prix et le total d'une commande venaient du navigateur (commande à 1 MRU possible) | Prix, prix de gros, promo et frais de livraison **recalculés côté serveur** ; le navigateur n'envoie plus que `id` + `qty` |
| Quantités négatives (augmentaient le stock) / stock négatif | Validation stricte + retrait de stock protégé en base (`WHERE stock >= qté`) |
| Suivi de commande : `LIKE '%…%'` permettait de lister les commandes de tous les clients (`%`) | Numéro **exact** (8 derniers chiffres), limité à 20 résultats, sans nom du client, avec limitation de débit |
| Failles XSS (avis, noms de clients, produits, bannières, chat IA injectés dans `innerHTML`) → vol du token admin | Échappement systématique (`esc()`), chat en `textContent`, liens `javascript:` refusés (client **et** serveur) |
| `/api/ai/admin/generate-product` ouverte à tous (quota Gemini) | Réservée aux admins + limitation de débit ; sortie de l'IA validée ; clé passée en en-tête |
| Le prix d'achat (votre marge) et le stock exact étaient publics | `/api/products` public sans `prix_achat` ni stock exact (champ `disponible`) ; `/api/products/admin` authentifié |
| Tout admin pouvait créer/modifier/supprimer des admins et se promouvoir | Gestion des admins réservée au Super Admin ; rôles validés ; le compte n°1 est protégé |
| Token admin valable après suppression du compte | Le compte est revérifié en base à chaque requête (effet immédiat) |
| Aucune limite sur les connexions | Limitation de débit : connexions, inscriptions, commandes, avis, promos, suivi, chat IA |
| Points fidélité attribués à n'importe quel numéro de téléphone | Attribués uniquement au client **connecté** |
| Mots de passe sans règle | 8 caractères minimum (72 max), bcrypt cost 12, temps de réponse constant (pas d'énumération d'emails) |
| CORS ouvert à tous, pas d'en-têtes de sécurité | `helmet`, CORS restreint via `CORS_ORIGINS`, corps JSON limité à 100 ko, `x-powered-by` retiré |
| Uploads sans contrôle de type | Images (jpg/png/webp/gif) et vidéos (mp4/webm/mov) uniquement, tailles limitées, images réduites à 1200 px |
| Secrets : validation au démarrage | Le serveur refuse de démarrer si les secrets manquent, sont identiques, ou (en production) trop courts |
| Mot de passe admin par défaut documenté dans le SQL | Supprimé : `npm run create-admin -- email "Nom" "MotDePasse"` |
| Erreur interne renvoyant des détails / pool qui plante | Gestionnaire d'erreurs global, `pool.on('error')`, arrêt propre |
| Défense en profondeur côté navigateur | Content-Security-Policy sur le site et l'admin, `noindex` sur l'admin |

## Bugs corrigés

- **Page « Dépenses » cassée** : l'interface appelait `/accounting/expenses` qui n'existait pas. Routes ajoutées (lister, ajouter, supprimer).
- **Fuite de stock à la modification d'une commande** : l'identifiant produit était perdu à l'édition, le stock se désynchronisait. Corrigé (front + back, dans une transaction).
- **Formulaire « Nouvelle commande » sans produits** tant qu'on n'avait pas ouvert l'onglet Produits : les produits se chargent maintenant au démarrage.
- **Nouveau statut « annulée »** : remet automatiquement le stock (et le retire de nouveau si on réactive).
- **Montants illisibles dans les PDF** (espaces insécables de `Intl`) : corrigé. Ajout des sauts de page pour les longues factures et d'un logo embarqué dans `backend/assets` (fonctionne même si le frontend est hébergé ailleurs).
- **Slugs de catégories** : « Électricité » devenait « lectricit » ; l'arabe créait des doublons. Corrigé.
- **Erreur 401 sur « mauvais ancien mot de passe »** qui aurait déconnecté l'admin : renvoie maintenant 400.
- **Boutons « Ajouter au panier »** : le nom du produit n'est plus injecté dans un `onclick` (cassait avec les apostrophes/antislashs).
- **Produit en rupture** : bouton désactivé + libellé traduit (FR/EN/AR).
- **Schéma SQL obsolète** : `database.sql` est à jour (11 tables, index), sans `DROP TABLE`.
- Traductions auto en parallèle (plus rapides) et uniquement si le texte a changé ; édition produit qui ne dépend plus d'une URL envoyée par le navigateur.
- `package.json` : `main` → `server.js`, scripts `start` / `dev` / `create-admin`.

## Performance / SEO / accessibilité

- Logo : **1,3 Mo → 64 Ko** (identique visuellement) ; images produits en `loading="lazy"`.
- SEO : description, Open Graph, favicon, données structurées `Store` (nom, téléphone, adresse, horaires), `robots.txt`.
- Accessibilité : `aria-label` sur les boutons/champs sans texte, `alt` du logo, `autocomplete` sur les formulaires.
- Année du copyright dynamique ; image de remplacement intégrée (l'ancien `via.placeholder.com` n'est plus fiable).

## Ce qui a été volontairement laissé tel quel

- **Bénéfice estimé = CA − dépenses** : je n'ai pas changé ce calcul car vous avez une catégorie de dépense « Achat de stock » (le changer ferait compter le stock deux fois). J'ai ajouté à côté la **marge brute** (prix de vente − prix d'achat − remises).
- **Zones de livraison** : le serveur sait maintenant calculer les frais depuis la table `delivery_zones`, mais l'écran de commande n'a pas encore de sélecteur de zone (le choix reste « Retrait en boutique »).
- **Numéros de téléphone non vérifiés** : sans SMS/WhatsApp de confirmation, on ne peut pas prouver qu'un client possède son numéro. Le suivi par numéro reste donc possible pour quiconque connaît ce numéro.
- Le token admin reste dans `localStorage` et la CSP garde `'unsafe-inline'` (à cause des `onclick` inline). Ils sont à remplacer à terme par des écouteurs d'événements.
- Les `alert()`/`confirm()` restent en place (remplacement par des messages dans la page = refonte d'interface).
- Les limiteurs de débit sont en mémoire : ils se réinitialisent au redémarrage de Render.
- Pas de modération des avis (aucun écran pour les supprimer).
- Supprimer une commande laisse un trou dans la numérotation des factures : préférez le statut « annulée ».

## Nouveautés pratiques

- `GET /api/health` : pour un service de « ping » (UptimeRobot…) qui évite l'endormissement de Render.
- `backend/.env.example` : modèle de configuration (ne commitez jamais le vrai `.env`).
- `npm run create-admin -- email "Nom" "MotDePasse"` : crée ou réinitialise un Super Admin.
