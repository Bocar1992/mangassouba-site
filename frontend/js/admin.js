const API_URL = window.MANGASSOUBA_API_URL
    || (['localhost', '127.0.0.1'].includes(location.hostname) ? 'http://localhost:3000/api' : 'https://mangassouba-site.onrender.com/api');

// ---- Sécurité XSS : à utiliser sur toute donnée dynamique insérée via innerHTML ----
function esc(valeur) {
    return String(valeur ?? '').replace(/[&<>"'`]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }[c]));
}
function safeUrl(url) {
    const u = String(url || '').trim();
    return /^https?:\/\//i.test(u) ? u : '';
}
const IMG_VIDE = 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50"><rect width="100%" height="100%" fill="#eef1f4"/><text x="50%" y="50%" fill="#8899a6" font-family="sans-serif" font-size="18" text-anchor="middle" dominant-baseline="middle">?</text></svg>`);

// Si le serveur répond 401 (session expirée, compte supprimé), on renvoie à l'écran de connexion
const _fetchOrigine = window.fetch.bind(window);
window.fetch = async (...args) => {
    const reponse = await _fetchOrigine(...args);
    if (reponse.status === 401 && String(args[0]).startsWith(API_URL) && !String(args[0]).includes('/auth/login')) seDeconnecter();
    return reponse;
};
let tokenAdmin = localStorage.getItem('adminToken');
let adminData = JSON.parse(localStorage.getItem('adminData')) || null;
let toutesLesCategories = [];
let tousLesProduits = [];
let tousLesAdmins = [];
let commandesGlobales = [];
let lignesProforma = [];
let commandeLignes = [];

document.addEventListener('DOMContentLoaded', () => {
    if (tokenAdmin && adminData) afficherDashboard();
    else {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('dashboard-screen').style.display = 'none';
    }
});

async function seConnecter(event) {
    event.preventDefault();
    const email = document.getElementById('admin-email').value;
    const password = document.getElementById('admin-password').value;
    const errorDiv = document.getElementById('login-error');
    if(errorDiv) errorDiv.style.display = 'none';
    try {
        const reponse = await fetch(`${API_URL}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
        const data = await reponse.json();
        if (reponse.ok) {
            tokenAdmin = data.token; adminData = data.admin; 
            localStorage.setItem('adminToken', tokenAdmin);
            localStorage.setItem('adminData', JSON.stringify(adminData));
            afficherDashboard();
        } else {
            if(errorDiv) { errorDiv.style.display = 'block'; errorDiv.innerText = data.message || "Erreur de connexion."; }
        }
    } catch (err) { alert("Erreur serveur. Le serveur Render met parfois 50s à se réveiller."); }
}

function seDeconnecter() { localStorage.removeItem('adminToken'); localStorage.removeItem('adminData'); window.location.href = 'index.html'; }

function afficherDashboard() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('dashboard-screen').style.display = 'block';
    chargerStats(); chargerCategoriesAdmin(); chargerProduitsAdmin();
    const estSuper = adminData && (adminData.role === 'superadmin' || adminData.id === 1);
    document.querySelectorAll('.sidebar-menu li').forEach(li => {
        if ((li.getAttribute('onclick') || '').includes("'admins'")) li.style.display = estSuper ? '' : 'none';
    });
}

function changerOnglet(nomOnglet, elementMenu) {
    document.querySelectorAll('.page-section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.sidebar-menu li').forEach(li => li.classList.remove('active'));
    document.getElementById(`section-${nomOnglet}`).classList.add('active');
    elementMenu.classList.add('active');

    if (nomOnglet === 'banners') chargerBannersAdmin();
    if (nomOnglet === 'produits') chargerProduitsAdmin();
    if (nomOnglet === 'commandes') chargerCommandesAdmin();
    if (nomOnglet === 'comptabilite') { chargerFinances(); chargerDepensesAdmin(); chargerProformasAdmin(); }
    if (nomOnglet === 'clients') chargerClientsAdmin();
    if (nomOnglet === 'admins') chargerAdminsAdmin();
}

async function chargerStats() {
    try {
        const reponse = await fetch(`${API_URL}/stats`, { headers: { 'Authorization': `Bearer ${tokenAdmin}` } });
        if(reponse.status === 403 || reponse.status === 401) return seDeconnecter();
        const data = await reponse.json();
        document.getElementById('stat-ca').innerText = new Intl.NumberFormat('fr-FR').format(data.chiffreAffaires) + ' MRU';
        document.getElementById('stat-attente').innerText = data.commandesEnAttente;
        document.getElementById('stat-stock').innerText = data.alertesStock;
        document.getElementById('stat-produits').innerText = data.totalProduits;
    } catch (err) { console.error(err); }
}

function ouvrirMonCompte() {
    if (!adminData) { alert("Veuillez vous reconnecter."); return; }
    document.getElementById('modal-mon-compte').classList.add('show');
    document.getElementById('compte-nom').innerText = `${adminData.nom} (${adminData.email})`;
    document.getElementById('compte-old-password').value = ''; document.getElementById('compte-new-password').value = '';
}
function fermerMonCompte() { document.getElementById('modal-mon-compte').classList.remove('show'); }

async function changerMonMotDePasse() {
    const oldPassword = document.getElementById('compte-old-password').value; const newPassword = document.getElementById('compte-new-password').value;
    if (!oldPassword || !newPassword) return alert("Veuillez remplir les deux champs.");
    const btn = document.querySelector('#modal-mon-compte .btn-save'); btn.innerText = "..."; btn.disabled = true;
    try {
        const reponse = await fetch(`${API_URL}/auth/change-password`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenAdmin}` }, body: JSON.stringify({ oldPassword, newPassword }) });
        const data = await reponse.json();
        if (reponse.ok) { alert("✅ " + data.message); fermerMonCompte(); } else { alert("❌ " + data.message); }
    } catch (err) { alert("Erreur."); } finally { btn.innerText = "Mettre à jour"; btn.disabled = false; }
}

async function chargerCommandesAdmin() {
    try {
        const reponse = await fetch(`${API_URL}/orders`, { headers: { 'Authorization': `Bearer ${tokenAdmin}` } });
        commandesGlobales = await reponse.json(); 
        const tbody = document.getElementById('liste-commandes-admin'); tbody.innerHTML = '';
        if(commandesGlobales.length === 0) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Aucune commande.</td></tr>'; return; }
        
        commandesGlobales.forEach(cmd => {
            const date = new Date(cmd.created_at).toLocaleDateString('fr-FR');
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>#${cmd.id}</td>
                <td><strong>${esc(cmd.clientName)}</strong><br><small>${esc(cmd.phone)}</small></td>
                <td>${new Intl.NumberFormat('fr-FR').format(cmd.total)} MRU</td>
                <td>${date}</td>
                <td>
                    <select onchange="changerStatutCommande(${cmd.id}, this.value)" style="padding: 5px; border-radius: 5px; border: 1px solid #ccc; font-family: inherit; font-weight: bold;">
                        <option value="en attente" ${cmd.status === 'en attente' ? 'selected' : ''}>En attente</option>
                        <option value="confirmée" ${cmd.status === 'confirmée' ? 'selected' : ''}>Confirmée</option>
                        <option value="livrée" ${cmd.status === 'livrée' ? 'selected' : ''}>Livrée</option>
                        <option value="annulée" ${cmd.status === 'annulée' ? 'selected' : ''}>Annulée</option>
                    </select>
                </td>
                <td><button class="btn-action btn-edit" onclick="telechargerFacture(${cmd.id})">📄 PDF</button></td>
                <td>
                    <button class="btn-action btn-edit" style="background:#004085; color:white;" onclick="ouvrirModaleCommande(${cmd.id})">Modifier</button>
                    <button class="btn-action btn-delete" onclick="supprimerCommande(${cmd.id})">Supprimer</button>
                </td>`;
            tbody.appendChild(tr);
        });
    } catch (err) { console.error(err); }
}

async function changerStatutCommande(id, nouveauStatut) {
    try { const reponse = await fetch(`${API_URL}/orders/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenAdmin}` }, body: JSON.stringify({ status: nouveauStatut }) }); if (reponse.ok) chargerStats(); else { const d = await reponse.json(); alert(d.message || 'Erreur.'); chargerCommandesAdmin(); } } catch (err) { alert("Erreur."); }
}

async function telechargerFacture(id) {
    try {
        const reponse = await fetch(`${API_URL}/orders/${id}/pdf`, { headers: { 'Authorization': `Bearer ${tokenAdmin}` } });
        if (!reponse.ok) throw new Error("Erreur PDF"); const blob = await reponse.blob(); const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `Facture_${id}.pdf`; document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
    } catch (err) { alert("Impossible."); }
}

function ouvrirModaleCommande(id = null) {
    document.getElementById('modal-commande').classList.add('show');
    if (id) {
        const cmd = commandesGlobales.find(c => c.id === id);
        document.getElementById('modal-cmd-titre').innerText = "Modifier la commande";
        document.getElementById('cmd-id').value = cmd.id;
        document.getElementById('cmd-client').value = cmd.clientName;
        document.getElementById('cmd-phone').value = cmd.phone || '';
        document.getElementById('cmd-address').value = cmd.address || '';
        document.getElementById('cmd-payment').value = cmd.payment;
        document.getElementById('cmd-status').value = cmd.status;
        const lignes = typeof cmd.items === 'string' ? JSON.parse(cmd.items) : cmd.items;
        // IMPORTANT : on conserve l'identifiant produit (produitId), sinon le stock n'est plus géré à l'enregistrement
        commandeLignes = lignes.map(l => ({ ...l, produitId: l.id || null }));
    } else {
        document.getElementById('modal-cmd-titre').innerText = "Nouvelle Commande";
        document.getElementById('cmd-id').value = ''; document.getElementById('cmd-client').value = ''; document.getElementById('cmd-phone').value = ''; document.getElementById('cmd-address').value = '';
        document.getElementById('cmd-payment').value = 'Espèces'; document.getElementById('cmd-status').value = 'confirmée';
        commandeLignes = [];
    }
    afficherLignesCommande();
}
function fermerModaleCommande() { document.getElementById('modal-commande').classList.remove('show'); }
function ajouterLigneCommande() { commandeLignes.push({ nom: '', prix: 0, qty: 1 }); afficherLignesCommande(); }

function afficherLignesCommande() {
    const conteneur = document.getElementById('commande-lignes'); conteneur.innerHTML = '';
    if(commandeLignes.length === 0) { conteneur.innerHTML = '<p style="font-size:13px; color:#777; text-align:center;">Aucun article.</p>'; document.getElementById('cmd-total').innerText = 0; return; }
    
    let optionsProduits = '<option value="">-- Article personnalisé --</option>';
    tousLesProduits.forEach(p => { optionsProduits += `<option value="${Number(p.id)}">${esc(p.nom)} (${Number(p.prix)} MRU)</option>`; });
    
    let total = 0;
    commandeLignes.forEach((ligne, index) => {
        total += (ligne.prix * ligne.qty);
        const div = document.createElement('div'); div.style.cssText = "display: flex; gap: 10px; margin-bottom: 10px; align-items: center;";
        div.innerHTML = `
            <select onchange="changerProduitCommande(${index}, this.value)" style="flex: 2; padding: 8px; border-radius: 5px; border: 1px solid #ccc;">${optionsProduits}</select>
            <input type="text" placeholder="Nom libre" value="${esc(ligne.nom)}" oninput="modifierNomLigneCmd(${index}, this.value)" style="flex: 2; padding: 8px; border-radius: 5px; border: 1px solid #ccc; ${ligne.produitId ? 'display:none;' : ''}">
            <input type="number" placeholder="Qté" value="${ligne.qty}" min="1" oninput="modifierQteLigneCmd(${index}, this.value)" style="width: 60px; padding: 8px; border-radius: 5px; border: 1px solid #ccc;">
            <input type="number" placeholder="Prix" value="${ligne.prix}" min="0" oninput="modifierPrixLigneCmd(${index}, this.value)" style="width: 90px; padding: 8px; border-radius: 5px; border: 1px solid #ccc;">
            <button onclick="supprimerLigneCommande(${index})" style="background: red; color: white; border: none; padding: 8px; border-radius: 5px; cursor: pointer;">X</button>`;
        const select = div.querySelector('select'); if(ligne.produitId) select.value = ligne.produitId;
        conteneur.appendChild(div);
    });
    document.getElementById('cmd-total').innerText = new Intl.NumberFormat('fr-FR').format(total);
}

function changerProduitCommande(index, produitId) {
    if(!produitId) { commandeLignes[index].produitId = null; commandeLignes[index].nom = ''; commandeLignes[index].prix = 0; }
    else { const prod = tousLesProduits.find(p => p.id == produitId); commandeLignes[index].produitId = prod.id; commandeLignes[index].nom = prod.nom; commandeLignes[index].prix = parseFloat(prod.prix); }
    afficherLignesCommande();
}
function modifierNomLigneCmd(index, val) { commandeLignes[index].nom = val; }
function modifierQteLigneCmd(index, val) { commandeLignes[index].qty = parseInt(val) || 1; afficherLignesCommande(); }
function modifierPrixLigneCmd(index, val) { commandeLignes[index].prix = parseFloat(val) || 0; afficherLignesCommande(); }
function supprimerLigneCommande(index) { commandeLignes.splice(index, 1); afficherLignesCommande(); }

async function sauvegarderCommande() {
    const id = document.getElementById('cmd-id').value;
    const clientName = document.getElementById('cmd-client').value;
    const phone = document.getElementById('cmd-phone').value;
    const address = document.getElementById('cmd-address').value;
    const payment = document.getElementById('cmd-payment').value;
    const status = document.getElementById('cmd-status').value;

    if(!clientName) return alert("Le nom du client est obligatoire.");
    if(commandeLignes.length === 0) return alert("Ajoutez au moins un article.");

    const itemsToSend = commandeLignes.map(l => ({ id: l.produitId || null, nom: l.nom, prix: l.prix, qty: l.qty }));
    const total = itemsToSend.reduce((acc, l) => acc + (l.prix * l.qty), 0);

    const url = id ? `${API_URL}/orders/admin/${id}` : `${API_URL}/orders/admin`;
    const method = id ? 'PUT' : 'POST';
    const btn = document.querySelector('#modal-commande .btn-save'); btn.innerText = "Traitement..."; btn.disabled = true;

    try {
        const reponse = await fetch(url, { method: method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenAdmin}` }, body: JSON.stringify({ clientName, phone, address, payment, status, items: itemsToSend, total }) });
        if (reponse.ok) { fermerModaleCommande(); chargerCommandesAdmin(); chargerStats(); } else { const d = await reponse.json(); alert(d.message); }
    } catch (err) { alert("Erreur serveur."); } finally { btn.innerText = "Enregistrer"; btn.disabled = false; }
}

async function supprimerCommande(id) {
    if (!confirm("Voulez-vous vraiment supprimer cette commande ? Le stock des produits sera remis à jour.")) return;
    try {
        const reponse = await fetch(`${API_URL}/orders/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${tokenAdmin}` } });
        if (reponse.ok) { chargerCommandesAdmin(); chargerStats(); }
    } catch (err) { alert("Erreur serveur."); }
}

async function chargerBannersAdmin() {
    try {
        const reponse = await fetch(`${API_URL}/banners/admin`, { headers: { 'Authorization': `Bearer ${tokenAdmin}` } });
        const banners = await reponse.json();
        const tbody = document.getElementById('liste-banners-admin'); tbody.innerHTML = '';
        if(banners.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Aucune annonce.</td></tr>'; return; }
        banners.forEach(b => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td><img src="${esc(safeUrl(b.image_url) || IMG_VIDE)}" alt="" style="width: 80px; height: 40px; object-fit: cover; border-radius: 5px;"></td><td><strong>${esc(b.title)}</strong></td><td>${esc(b.link_url || '-')}</td><td>${b.is_active ? '<span style="color:green; font-weight:bold;">Actif</span>' : '<span style="color:red;">Inactif</span>'}</td><td><button class="btn-action btn-delete" onclick="supprimerBanner(${b.id})">Supprimer</button></td>`;
            tbody.appendChild(tr);
        });
    } catch (err) { console.error(err); }
}
function ouvrirModaleBanner() { document.getElementById('modal-banner').classList.add('show'); document.getElementById('banner-title').value = ''; document.getElementById('banner-desc').value = ''; document.getElementById('banner-link').value = ''; document.getElementById('banner-image').value = ''; }
function fermerModaleBanner() { document.getElementById('modal-banner').classList.remove('show'); }
async function sauvegarderBanner() {
    const title = document.getElementById('banner-title').value; const description = document.getElementById('banner-desc').value; const link_url = document.getElementById('banner-link').value; const imageFile = document.getElementById('banner-image').files[0];
    if(!title || !imageFile) return alert("Titre et image obligatoires.");
    const formData = new FormData(); formData.append('title', title); formData.append('description', description); formData.append('link_url', link_url); formData.append('image', imageFile);
    const btn = document.querySelector('#modal-banner .btn-save'); btn.innerText = "Traitement..."; btn.disabled = true;
    try { const reponse = await fetch(`${API_URL}/banners`, { method: 'POST', headers: { 'Authorization': `Bearer ${tokenAdmin}` }, body: formData }); if(reponse.ok) { fermerModaleBanner(); chargerBannersAdmin(); } else { const d = await reponse.json(); alert(d.message || 'Erreur.'); } } catch(e) { alert("Erreur serveur."); } finally { btn.innerText = "Enregistrer"; btn.disabled = false; }
}
async function supprimerBanner(id) { if(!confirm("Supprimer ?")) return; try { const rep = await fetch(`${API_URL}/banners/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${tokenAdmin}` } }); if(rep.ok) chargerBannersAdmin(); } catch(e) { alert("Erreur."); } }

async function chargerProduitsAdmin() {
    try {
        const reponse = await fetch(`${API_URL}/products/admin`, { headers: { 'Authorization': `Bearer ${tokenAdmin}` } }); tousLesProduits = await reponse.json();
        if (!Array.isArray(tousLesProduits)) { tousLesProduits = []; return; }
        const tbody = document.getElementById('liste-produits-admin'); tbody.innerHTML = '';
        tousLesProduits.forEach(prod => {
            const imageUrl = safeUrl(prod.media) || IMG_VIDE;
            const prixGrosTxt = prod.prix_gros > 0 ? `${new Intl.NumberFormat('fr-FR').format(prod.prix_gros)} MRU <br><small>(dès ${prod.seuil_gros})</small>` : '-';
            const tr = document.createElement('tr');
            tr.innerHTML = `<td><img src="${esc(imageUrl)}" alt="" style="width: 50px; height: 50px; object-fit: cover; border-radius: 5px;"></td><td><strong>${esc(prod.nom)}</strong> ${prod.video ? '🎥' : ''}</td><td>${new Intl.NumberFormat('fr-FR').format(prod.prix)} MRU</td><td style="color: #004085;">${prixGrosTxt}</td><td style="color: ${prod.stock < 5 ? 'red' : 'inherit'}; font-weight: ${prod.stock < 5 ? 'bold' : 'normal'};">${prod.stock}</td><td><button class="btn-action btn-edit" onclick="ouvrirModaleProduit(${prod.id})">Modifier</button><button class="btn-action btn-delete" onclick="supprimerProduit(${prod.id})">Supprimer</button></td>`;
            tbody.appendChild(tr);
        });
    } catch (err) { console.error(err); }
}
function ouvrirModaleProduit(id = null) {
    document.getElementById('modal-produit').classList.add('show');
    document.getElementById('ai-prod-prompt').value = '';
    const selectCat = document.getElementById('prod-category'); selectCat.innerHTML = '<option value="">-- Choisir --</option>';
    toutesLesCategories.forEach(cat => { const nomAffichage = cat.parent_nom ? `↳ ${cat.parent_nom} > ${cat.nom}` : cat.nom; selectCat.innerHTML += `<option value="${Number(cat.id)}">${esc(nomAffichage)}</option>`; });
    if (id) {
        const prod = tousLesProduits.find(p => p.id === id);
        document.getElementById('modal-prod-titre').innerText = "Modifier le produit"; document.getElementById('prod-id').value = prod.id;
        document.getElementById('prod-existing-media').value = prod.media || ''; document.getElementById('prod-existing-video').value = prod.video || '';
        document.getElementById('prod-nom').value = prod.nom; document.getElementById('prod-prix').value = prod.prix;
        document.getElementById('prod-prix-gros').value = prod.prix_gros || 0; document.getElementById('prod-seuil-gros').value = prod.seuil_gros || 10;
        document.getElementById('prod-prix-achat').value = prod.prix_achat || 0; document.getElementById('prod-stock').value = prod.stock;
        document.getElementById('prod-desc').value = prod.description || ''; document.getElementById('prod-category').value = prod.category_id || '';
        document.getElementById('prod-image').value = ''; document.getElementById('prod-video').value = ''; 
    } else {
        document.getElementById('modal-prod-titre').innerText = "Nouveau Produit"; document.getElementById('prod-id').value = ''; 
        document.getElementById('prod-existing-media').value = ''; document.getElementById('prod-existing-video').value = '';
        document.getElementById('prod-nom').value = ''; document.getElementById('prod-prix').value = ''; document.getElementById('prod-prix-gros').value = ''; 
        document.getElementById('prod-seuil-gros').value = '10'; document.getElementById('prod-prix-achat').value = ''; document.getElementById('prod-stock').value = '';
        document.getElementById('prod-desc').value = ''; document.getElementById('prod-category').value = ''; document.getElementById('prod-image').value = ''; document.getElementById('prod-video').value = '';
    }
}
function fermerModaleProduit() { document.getElementById('modal-produit').classList.remove('show'); }
async function sauvegarderProduit() {
    const id = document.getElementById('prod-id').value; const nom = document.getElementById('prod-nom').value; const prix = document.getElementById('prod-prix').value; const prix_gros = document.getElementById('prod-prix-gros').value;
    const seuil_gros = document.getElementById('prod-seuil-gros').value; const prix_achat = document.getElementById('prod-prix-achat').value; const stock = document.getElementById('prod-stock').value;
    const category_id = document.getElementById('prod-category').value; const description = document.getElementById('prod-desc').value; const existing_media = document.getElementById('prod-existing-media').value;
    const existing_video = document.getElementById('prod-existing-video').value; const imageFile = document.getElementById('prod-image').files[0]; const videoFile = document.getElementById('prod-video').files[0];
    if (!nom || !prix || !stock || !category_id) return alert("Veuillez remplir les champs obligatoires (*).");
    const formData = new FormData();
    formData.append('nom', nom); formData.append('prix', prix); formData.append('prix_achat', prix_achat || 0);
    formData.append('prix_gros', prix_gros || 0); formData.append('seuil_gros', seuil_gros || 10);
    formData.append('stock', stock); formData.append('category_id', category_id); formData.append('description', description);
    formData.append('existing_media', existing_media); formData.append('existing_video', existing_video);
    if (imageFile) formData.append('image', imageFile); if (videoFile) formData.append('video', videoFile);
    const url = id ? `${API_URL}/products/${id}` : `${API_URL}/products`; const method = id ? 'PUT' : 'POST';
    const btn = document.querySelector('#modal-produit .btn-save'); btn.innerText = "Traitement..."; btn.disabled = true;
    try { const reponse = await fetch(url, { method, headers: { 'Authorization': `Bearer ${tokenAdmin}` }, body: formData }); if (reponse.ok) { fermerModaleProduit(); chargerProduitsAdmin(); chargerStats(); } else { const d = await reponse.json(); alert(d.message); } } catch (err) { alert("Erreur serveur."); } finally { btn.innerText = "Enregistrer"; btn.disabled = false; }
}
async function supprimerProduit(id) { if (!confirm("Supprimer ce produit ?")) return; try { const reponse = await fetch(`${API_URL}/products/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${tokenAdmin}` } }); if (reponse.ok) { chargerProduitsAdmin(); chargerStats(); } } catch (err) { alert("Erreur serveur."); } }

async function chargerFinances() {
    try {
        const reponse = await fetch(`${API_URL}/stats`, { headers: { 'Authorization': `Bearer ${tokenAdmin}` } }); const data = await reponse.json();
        document.getElementById('fin-ca').innerText = new Intl.NumberFormat('fr-FR').format(data.chiffreAffaires) + ' MRU';
        document.getElementById('fin-depenses').innerText = new Intl.NumberFormat('fr-FR').format(data.totalDepenses) + ' MRU';
        document.getElementById('fin-stock').innerText = new Intl.NumberFormat('fr-FR').format(data.valeurStock) + ' MRU';
        const beneficeEl = document.getElementById('fin-benefice'); beneficeEl.innerText = new Intl.NumberFormat('fr-FR').format(data.benefice) + ' MRU'; beneficeEl.style.color = data.benefice >= 0 ? 'var(--vert)' : 'red';
        const margeEl = document.getElementById('fin-marge'); if (margeEl) margeEl.innerText = new Intl.NumberFormat('fr-FR').format(data.margeBrute || 0) + ' MRU';
    } catch (err) { console.error(err); }
}
async function chargerDepensesAdmin() {
    try {
        const reponse = await fetch(`${API_URL}/accounting/expenses`, { headers: { 'Authorization': `Bearer ${tokenAdmin}` } }); const depenses = await reponse.json();
        const tbody = document.getElementById('liste-depenses-admin'); tbody.innerHTML = '';
        if(depenses.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Aucune dépense.</td></tr>'; return; }
        depenses.forEach(d => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${new Date(d.date).toLocaleDateString('fr-FR')}</td><td><strong>${esc(d.description)}</strong></td><td><span style="background:#eee; padding:2px 6px; border-radius:4px; font-size:12px;">${esc(d.category)}</span></td><td style="color:red; font-weight:bold;">-${new Intl.NumberFormat('fr-FR').format(d.amount)} MRU</td><td><button class="btn-action btn-delete" onclick="supprimerDepense(${d.id})">X</button></td>`;
            tbody.appendChild(tr);
        });
    } catch (err) { console.error(err); }
}
function ouvrirModaleDepense() { document.getElementById('modal-depense').classList.add('show'); document.getElementById('dep-desc').value = ''; document.getElementById('dep-montant').value = ''; document.getElementById('dep-date').value = new Date().toISOString().split('T')[0]; }
function fermerModaleDepense() { document.getElementById('modal-depense').classList.remove('show'); }
async function sauvegarderDepense() {
    const description = document.getElementById('dep-desc').value; const amount = document.getElementById('dep-montant').value; const category = document.getElementById('dep-cat').value; const date = document.getElementById('dep-date').value;
    if(!description || !amount || !date) return alert("Veuillez remplir les champs.");
    try { const rep = await fetch(`${API_URL}/accounting/expenses`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenAdmin}` }, body: JSON.stringify({ description, amount, category, date }) }); if(rep.ok) { fermerModaleDepense(); chargerDepensesAdmin(); chargerFinances(); } } catch(e) { alert("Erreur serveur."); }
}
async function supprimerDepense(id) { if(!confirm("Supprimer cette dépense ?")) return; try { const rep = await fetch(`${API_URL}/accounting/expenses/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${tokenAdmin}` } }); if(rep.ok) { chargerDepensesAdmin(); chargerFinances(); } } catch(e) { alert("Erreur serveur."); } }

async function chargerProformasAdmin() {
    try {
        const reponse = await fetch(`${API_URL}/accounting/proformas`, { headers: { 'Authorization': `Bearer ${tokenAdmin}` } }); const proformas = await reponse.json();
        const tbody = document.getElementById('liste-proformas-admin'); tbody.innerHTML = '';
        if(proformas.length === 0) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Aucune proforma.</td></tr>'; return; }
        proformas.forEach(p => {
            const tr = document.createElement('tr'); tr.innerHTML = `<td>PRO-${p.id}</td><td><strong>${esc(p.client_name)}</strong></td><td>${new Intl.NumberFormat('fr-FR').format(p.total)} MRU</td><td><button class="btn-action btn-delete" onclick="supprimerProforma(${p.id})">X</button></td>`; tbody.appendChild(tr);
        });
    } catch (err) { console.error(err); }
}
function ouvrirModaleProforma() { document.getElementById('modal-proforma').classList.add('show'); document.getElementById('prof-client').value = ''; document.getElementById('prof-phone').value = ''; document.getElementById('prof-address').value = ''; document.getElementById('prof-validity').value = ''; lignesProforma = []; afficherLignesProforma(); }
function fermerModaleProforma() { document.getElementById('modal-proforma').classList.remove('show'); }
function ajouterLigneProforma() { lignesProforma.push({ nom: '', prix: 0, qty: 1 }); afficherLignesProforma(); }
function afficherLignesProforma() {
    const conteneur = document.getElementById('proforma-lignes'); conteneur.innerHTML = '';
    if(lignesProforma.length === 0) { conteneur.innerHTML = '<p style="font-size:13px; color:#777; text-align:center;">Aucun article.</p>'; document.getElementById('prof-total').innerText = 0; return; }
    let optionsProduits = '<option value="">-- Article personnalisé --</option>'; tousLesProduits.forEach(p => { optionsProduits += `<option value="${Number(p.id)}">${esc(p.nom)} (${Number(p.prix)} MRU)</option>`; });
    let total = 0;
    lignesProforma.forEach((ligne, index) => {
        total += (ligne.prix * ligne.qty);
        const div = document.createElement('div'); div.style.cssText = "display: flex; gap: 10px; margin-bottom: 10px; align-items: center;";
        div.innerHTML = `<select onchange="changerProduitProforma(${index}, this.value)" style="flex: 2; padding: 8px; border-radius: 5px; border: 1px solid #ccc;">${optionsProduits}</select><input type="text" placeholder="Nom libre" value="${esc(ligne.nom)}" oninput="modifierNomLigne(${index}, this.value)" style="flex: 2; padding: 8px; border-radius: 5px; border: 1px solid #ccc; ${ligne.produitId ? 'display:none;' : ''}"><input type="number" placeholder="Qté" value="${ligne.qty}" min="1" oninput="modifierQteLigne(${index}, this.value)" style="width: 60px; padding: 8px; border-radius: 5px; border: 1px solid #ccc;"><input type="number" placeholder="Prix" value="${ligne.prix}" min="0" oninput="modifierPrixLigne(${index}, this.value)" style="width: 90px; padding: 8px; border-radius: 5px; border: 1px solid #ccc;"><button onclick="supprimerLigneProforma(${index})" style="background: red; color: white; border: none; padding: 8px; border-radius: 5px; cursor: pointer;">X</button>`;
        const select = div.querySelector('select'); if(ligne.produitId) select.value = ligne.produitId;
        conteneur.appendChild(div);
    });
    document.getElementById('prof-total').innerText = new Intl.NumberFormat('fr-FR').format(total);
}
function changerProduitProforma(index, produitId) { if(!produitId) { lignesProforma[index].produitId = null; lignesProforma[index].nom = ''; lignesProforma[index].prix = 0; } else { const prod = tousLesProduits.find(p => p.id == produitId); lignesProforma[index].produitId = prod.id; lignesProforma[index].nom = prod.nom; lignesProforma[index].prix = parseFloat(prod.prix); } afficherLignesProforma(); }
function modifierNomLigne(index, val) { lignesProforma[index].nom = val; }
function modifierQteLigne(index, val) { lignesProforma[index].qty = parseInt(val) || 1; afficherLignesProforma(); }
function modifierPrixLigne(index, val) { lignesProforma[index].prix = parseFloat(val) || 0; afficherLignesProforma(); }
function supprimerLigneProforma(index) { lignesProforma.splice(index, 1); afficherLignesProforma(); }
async function genererProforma() {
    const client = document.getElementById('prof-client').value; const phone = document.getElementById('prof-phone').value; const address = document.getElementById('prof-address').value; const validite = document.getElementById('prof-validity').value;
    if(!client) return alert("Nom du client obligatoire."); if(lignesProforma.length === 0) return alert("Ajoutez un article.");
    const total = lignesProforma.reduce((acc, l) => acc + (l.prix * l.qty), 0);
    const btn = document.querySelector('#modal-proforma .btn-save'); btn.innerText = "Génération..."; btn.disabled = true;
    try {
        const reponse = await fetch(`${API_URL}/accounting/proformas`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenAdmin}` }, body: JSON.stringify({ client_name: client, phone, address, items: lignesProforma, total, valid_until: validite || null }) });
        if (!reponse.ok) throw new Error("Erreur");
        const blob = await reponse.blob(); const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `Proforma.pdf`; document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
        fermerModaleProforma(); chargerProformasAdmin();
    } catch (err) { alert("Erreur génération PDF."); } finally { btn.innerText = "Télécharger le PDF"; btn.disabled = false; }
}
async function supprimerProforma(id) { if (!confirm("Supprimer ?")) return; try { const reponse = await fetch(`${API_URL}/accounting/proformas/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${tokenAdmin}` } }); if (reponse.ok) chargerProformasAdmin(); } catch (err) { alert("Erreur."); } }

async function chargerCategoriesAdmin() {
    try {
        const reponse = await fetch(`${API_URL}/categories`); toutesLesCategories = await reponse.json();
        const tbody = document.getElementById('liste-categories-admin'); tbody.innerHTML = '';
        toutesLesCategories.forEach(cat => {
            const parentName = cat.parent_nom ? esc(cat.parent_nom) : '<span style="color:#999;">Aucune</span>';
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>#${cat.id}</td><td><strong>${esc(cat.nom)}</strong></td><td><span style="font-size:12px; color:#555;">EN: ${esc(cat.nom_en || '-')}<br>AR: ${esc(cat.nom_ar || '-')}</span></td><td>${parentName}</td><td><button class="btn-action btn-edit" onclick="ouvrirModaleCategorie(${cat.id})">Modifier</button><button class="btn-action btn-delete" onclick="supprimerCategorie(${cat.id})">Supprimer</button></td>`;
            tbody.appendChild(tr);
        });
    } catch (err) { console.error(err); }
}
function ouvrirModaleCategorie(id = null) {
    document.getElementById('modal-categorie').classList.add('show');
    const selectParent = document.getElementById('cat-parent'); selectParent.innerHTML = '<option value="">-- Aucune --</option>';
    toutesLesCategories.filter(c => c.parent_id === null).forEach(c => { selectParent.innerHTML += `<option value="${Number(c.id)}">${esc(c.nom)}</option>`; });
    if (id) { const cat = toutesLesCategories.find(c => c.id === id); document.getElementById('modal-cat-titre').innerText = "Modifier"; document.getElementById('cat-id').value = cat.id; document.getElementById('cat-nom').value = cat.nom; selectParent.value = cat.parent_id || ""; } 
    else { document.getElementById('modal-cat-titre').innerText = "Nouvelle Catégorie"; document.getElementById('cat-id').value = ''; document.getElementById('cat-nom').value = ''; selectParent.value = ""; }
}
function fermerModaleCategorie() { document.getElementById('modal-categorie').classList.remove('show'); }
async function sauvegarderCategorie() {
    const id = document.getElementById('cat-id').value; const nom = document.getElementById('cat-nom').value; const parent_id = document.getElementById('cat-parent').value;
    if (!nom) return alert("Nom obligatoire.");
    const url = id ? `${API_URL}/categories/${id}` : `${API_URL}/categories`; const method = id ? 'PUT' : 'POST';
    try { const reponse = await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenAdmin}` }, body: JSON.stringify({ nom, parent_id }) }); if (reponse.ok) { fermerModaleCategorie(); chargerCategoriesAdmin(); chargerStats(); } } catch (err) { alert("Erreur."); }
}
async function supprimerCategorie(id) { if (!confirm("Supprimer ?")) return; try { const reponse = await fetch(`${API_URL}/categories/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${tokenAdmin}` } }); if (reponse.ok) { chargerCategoriesAdmin(); chargerStats(); } } catch (err) { alert("Erreur."); } }

async function chargerClientsAdmin() {
    try {
        const reponse = await fetch(`${API_URL}/customers`, { headers: { 'Authorization': `Bearer ${tokenAdmin}` } }); const clients = await reponse.json();
        const tbody = document.getElementById('liste-clients-admin'); tbody.innerHTML = '';
        if(clients.length === 0) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Aucun client.</td></tr>'; return; }
        clients.forEach(c => {
            const date = new Date(c.created_at).toLocaleDateString('fr-FR');
            const tr = document.createElement('tr'); tr.innerHTML = `<td>#${c.id}</td><td><strong>${esc(c.name)}</strong></td><td>${esc(c.phone)}</td><td>🌟 ${c.points}</td><td>${date}</td><td><button class="btn-action btn-delete" onclick="supprimerClient(${c.id})">Supprimer</button></td>`; tbody.appendChild(tr);
        });
    } catch (err) { console.error(err); }
}
async function supprimerClient(id) { if (!confirm("Supprimer ?")) return; try { const reponse = await fetch(`${API_URL}/customers/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${tokenAdmin}` } }); if (reponse.ok) chargerClientsAdmin(); } catch (err) { alert("Erreur."); } }

async function chargerAdminsAdmin() {
    try {
        const reponse = await fetch(`${API_URL}/admins`, { headers: { 'Authorization': `Bearer ${tokenAdmin}` } }); tousLesAdmins = await reponse.json();
        const tbody = document.getElementById('liste-admins-admin'); tbody.innerHTML = '';
        tousLesAdmins.forEach(a => {
            const roleBadge = a.role === 'superadmin' ? '<span style="background:var(--or); color:var(--bleu-nuit); padding:2px 8px; border-radius:10px; font-size:11px; font-weight:bold;">Super Admin</span>' : 'Admin';
            const tr = document.createElement('tr'); tr.innerHTML = `<td>#${a.id}</td><td><strong>${esc(a.nom)}</strong></td><td>${esc(a.email)}</td><td>${roleBadge}</td><td><button class="btn-action btn-edit" onclick="ouvrirModaleAdmin(${a.id})">Modifier</button>${a.id !== 1 ? `<button class="btn-action btn-delete" onclick="supprimerAdmin(${a.id})">Supprimer</button>` : ''}</td>`; tbody.appendChild(tr);
        });
    } catch (err) { console.error(err); }
}
function ouvrirModaleAdmin(id = null) {
    document.getElementById('modal-admin').classList.add('show');
    if (id) {
        const a = tousLesAdmins.find(x => x.id === id); document.getElementById('modal-admin-titre').innerText = "Modifier"; document.getElementById('admin-id').value = a.id;
        document.getElementById('admin-nom').value = a.nom; document.getElementById('admin-new-email').value = a.email; document.getElementById('admin-new-password').value = ''; document.getElementById('admin-role').value = a.role;
    } else {
        document.getElementById('modal-admin-titre').innerText = "Nouvel Admin"; document.getElementById('admin-id').value = ''; document.getElementById('admin-nom').value = ''; document.getElementById('admin-new-email').value = ''; document.getElementById('admin-new-password').value = ''; document.getElementById('admin-role').value = 'admin';
    }
}
function fermerModaleAdmin() { document.getElementById('modal-admin').classList.remove('show'); }
async function sauvegarderAdmin() {
    const id = document.getElementById('admin-id').value; const nom = document.getElementById('admin-nom').value; const email = document.getElementById('admin-new-email').value; const password = document.getElementById('admin-new-password').value; const role = document.getElementById('admin-role').value;
    if (!nom || !email) return alert("Nom et email obligatoires.");
    const url = id ? `${API_URL}/admins/${id}` : `${API_URL}/admins`; const method = id ? 'PUT' : 'POST';
    try { const reponse = await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenAdmin}` }, body: JSON.stringify({ nom, email, password, role }) }); if (reponse.ok) { fermerModaleAdmin(); chargerAdminsAdmin(); } else { const d = await reponse.json(); alert(d.message); } } catch (err) { alert("Erreur serveur."); } }
async function supprimerAdmin(id) { if (!confirm("Supprimer ?")) return; try { const reponse = await fetch(`${API_URL}/admins/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${tokenAdmin}` } }); if (reponse.ok) chargerAdminsAdmin(); } catch (err) { alert("Erreur."); } }

// ==================== ASSISTANT IA ADMIN ====================
async function genererProduitIA() {
    const texte = document.getElementById('ai-prod-prompt').value;
    if (!texte) return alert("Veuillez décrire le produit à ajouter.");
    
    const btn = document.getElementById('btn-ai-generate');
    btn.innerText = "🪄 L'IA réfléchit..."; btn.disabled = true;

    try {
        const rep = await fetch(`${API_URL}/ai/admin/generate-product`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenAdmin}` },
            body: JSON.stringify({ texte })
        });
        const data = await rep.json();
        if (!rep.ok) { alert(data.message || "L'IA n'a pas pu comprendre la demande."); return; }
        
        if (data.nom) document.getElementById('prod-nom').value = data.nom;
        if (data.prix) document.getElementById('prod-prix').value = data.prix;
        if (data.description) document.getElementById('prod-desc').value = data.description;
        if (data.stock) document.getElementById('prod-stock').value = data.stock;
        if (data.prix_achat) document.getElementById('prod-prix-achat').value = data.prix_achat;
        
        document.getElementById('ai-prod-prompt').value = '';
        
    } catch (e) { alert("L'IA n'a pas pu comprendre la demande."); } 
    finally { btn.innerText = "✨ Remplir le formulaire automatiquement"; btn.disabled = false; }
}