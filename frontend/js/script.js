const API_URL = 'https://mangassouba-site.onrender.com/api';
let monPanier = JSON.parse(localStorage.getItem('panierMangassouba')) || [];
let promoAppliquee = null;
let toutesLesCategories = [];
let tousLesProduits = []; 
let langueActuelle = localStorage.getItem('langueMangassouba') || 'fr';
let produitLightbox = null;
let noteActuelle = 5;
let tokenClient = localStorage.getItem('clientToken') || null;
let clientData = JSON.parse(localStorage.getItem('clientData')) || null;

const traductions = {
    fr: { cart: "Panier", hero_badge: "Votre Commerce de Proximité", hero_title: "Bienvenue chez Mangassouba et Fils", hero_desc: "Quincaillerie, alimentation, électroménager, et bien plus encore. Retrouvez tout ce dont vous avez besoin au quotidien, au cœur de Sélibaby.", hero_btn1: "Découvrir nos produits", hero_btn2: "Nous contacter", rayons_title: "La diversité à portée de main", rayons_desc: "Que vous soyez un professionnel, un bricoleur ou simplement en quête de vos courses quotidiennes, Mangassouba et Fils est votre point de rendez-vous. Un seul magasin pour tous vos besoins.", rayon_quincaillerie: "Quincaillerie", rayon_alimentation: "Alimentation", rayon_divers: "Divers", categories: "Catégories", products: "Nos Produits", latest_products: "Nouveautés", loading: "Chargement...", footer_desc: "Votre commerce général de référence au cœur du marché de Sélibaby.", rights: "Tous droits réservés.", admin_space: "Espace Administrateur", your_cart: "Votre Panier", total: "Total :", order_btn: "Passer la commande", checkout_title: "Finaliser la commande", name: "Nom complet *", phone: "Téléphone *", address: "Adresse / Quartier *", promo: "Code Promo (Optionnel)", apply: "Appliquer", payment: "Mode de paiement *", cash: "Espèces à la livraison", momo: "Mobile Money (Sedad)", subtotal: "Sous-total :", discount: "Réduction :", total_pay: "Total à payer :", confirm_btn: "Confirmer la commande", empty_cart: "Votre panier est vide.", add_to_cart: "Ajouter au panier", no_product: "Aucun produit trouvé.", all: "Tous les produits", nav_contact: "Contact", nav_track: "Suivi", nav_login: "Connexion", password: "Mot de passe *", register_btn: "S'inscrire", logout: "Déconnexion", contact_title: "Contactez-nous", contact_desc: "Nous sommes à votre écoute pour toute question ou commande.", contact_address: "Adresse", contact_phone: "Téléphone", contact_whatsapp: "WhatsApp", contact_hours: "Horaires", contact_hours_val: "Tous les jours (sauf vendredi) : 08h00 - 18h00", track_title: "Suivi de commande", track_desc: "Entrez le numéro de téléphone utilisé lors de votre commande.", track_btn: "Rechercher", track_no_found: "Aucune commande trouvée pour ce numéro.", track_order: "Commande", track_status: "Statut", track_date: "Date", track_total: "Total", status_attente: "En attente", status_confirmee: "Confirmée", status_livree: "Livrée", search_placeholder: "Rechercher un produit...", reviews_title: "Avis Clients", leave_review: "Laisser un avis", your_name: "Votre nom", your_comment: "Votre commentaire (optionnel)", send_review: "Envoyer", wholesale_info: "Tarif de gros dès" },
    en: { cart: "Cart", hero_badge: "Your Local Store", hero_title: "Welcome to Mangassouba et Fils", hero_desc: "Hardware, groceries, home appliances, and much more. Find everything you need for your daily life in the heart of Selibaby.", hero_btn1: "Discover our products", hero_btn2: "Contact us", rayons_title: "Diversity at your fingertips", rayons_desc: "Whether you are a professional, a DIY enthusiast, or simply doing your daily shopping, Mangassouba et Fils is your one-stop shop for all your needs.", rayon_quincaillerie: "Hardware", rayon_alimentation: "Groceries", rayon_divers: "Miscellaneous", categories: "Categories", products: "Our Products", latest_products: "New Arrivals", loading: "Loading...", footer_desc: "Your reference general store in the heart of Selibaby market.", rights: "All rights reserved.", admin_space: "Admin Space", your_cart: "Your Cart", total: "Total:", order_btn: "Place Order", checkout_title: "Finalize order", name: "Full Name *", phone: "Phone *", address: "Address / District *", promo: "Promo Code (Optional)", apply: "Apply", payment: "Payment Method *", cash: "Cash on delivery", momo: "Mobile Money (Sedad)", subtotal: "Subtotal:", discount: "Discount:", total_pay: "Total to pay:", confirm_btn: "Confirm order", empty_cart: "Your cart is empty.", add_to_cart: "Add to cart", no_product: "No products found.", all: "All products", nav_contact: "Contact", nav_track: "Track", nav_login: "Login", password: "Password *", register_btn: "Register", logout: "Logout", contact_title: "Contact Us", contact_desc: "We are here to answer any questions or orders.", contact_address: "Address", contact_phone: "Phone", contact_whatsapp: "WhatsApp", contact_hours: "Opening Hours", contact_hours_val: "Every day (except Friday): 08:00 AM - 06:00 PM", track_title: "Order Tracking", track_desc: "Enter the phone number used for your order.", track_btn: "Search", track_no_found: "No orders found for this number.", track_order: "Order", track_status: "Status", track_date: "Date", track_total: "Total", status_attente: "Pending", status_confirmee: "Confirmed", status_livree: "Delivered", search_placeholder: "Search for a product...", reviews_title: "Customer Reviews", leave_review: "Leave a review", your_name: "Your name", your_comment: "Your comment (optional)", send_review: "Send", wholesale_info: "Wholesale price from" },
    ar: { cart: "السلة", hero_badge: "متجركم المحلي", hero_title: "مرحباً بكم في مانغاسوبا وأولاده", hero_desc: "أدوات، مواد غذائية، أجهزة منزلية، وأكثر من ذلك بكثير. تجدون كل ما تحتاجونه في حياتكم اليومية في قلب سيليبابي.", hero_btn1: "اكتشف منتجاتنا", hero_btn2: "اتصل بنا", rayons_title: "التنوع في متناول يدك", rayons_desc: "سواء كنتم محترفين أو مجرد متسوقين يوميين، مانغاسوبا وأولاده هو متجركم الشامل لجميع احتياجاتكم.", rayon_quincaillerie: "أدوات", rayon_alimentation: "مواد غذائية", rayon_divers: "متنوعات", categories: "الأقسام", products: "منتجاتنا", latest_products: "وصل حديثاً", loading: "جاري التحميل...", footer_desc: "متجركم العام المرجعي في قلب سوق سيليبابي.", rights: "جميع الحقوق محفوظة.", admin_space: "مساحة الإدارة", your_cart: "سلتكم", total: "المجموع:", order_btn: "إتمام الطلب", checkout_title: "إنهاء الطلب", name: "الاسم الكامل *", phone: "رقم الهاتف *", address: "العنوان / الحي *", promo: "رمز الخصم (اختياري)", apply: "تطبيق", payment: "طريقة الدفع *", cash: "الدفع عند الاستلام", momo: "مومو (Sedad)", subtotal: "المجموع الفرعي:", discount: "الخصم:", total_pay: "المجموع الإجمالي:", confirm_btn: "تأكيد الطلب", empty_cart: "سلتكم فارغة.", add_to_cart: "أضف إلى السلة", no_product: "لم يتم العثور على منتجات.", all: "جميع المنتجات", nav_contact: "اتصل بنا", nav_track: "تتبع", nav_login: "تسجيل الدخول", password: "كلمة المرور *", register_btn: "تسجيل", logout: "تسجيل الخروج", contact_title: "اتصل بنا", contact_desc: "نحن هنا للإجابة على أي أسئلة أو طلبات.", contact_address: "العنوان", contact_phone: "الهاتف", contact_whatsapp: "واتساب", contact_hours: "ساعات العمل", contact_hours_val: "كل يوم (ما عدا الجمعة): 08:00 - 18:00", track_title: "تتبع الطلب", track_desc: "أدخل رقم الهاتف المستخدم في طلبك.", track_btn: "بحث", track_no_found: "لم يتم العثور على طلبات لهذا الرقم.", track_order: "طلب", track_status: "الحالة", track_date: "التاريخ", track_total: "المجموع", status_attente: "قيد الانتظار", status_confirmee: "مؤكد", status_livree: "تم التوصيل", search_placeholder: "ابحث عن منتج...", reviews_title: "آراء العملاء", leave_review: "اترك تقييماً", your_name: "اسمك", your_comment: "تعليقك (اختياري)", send_review: "إرسال", wholesale_info: "سعر الجملة من" }
};

document.addEventListener('DOMContentLoaded', () => {
    appliquerLangue(langueActuelle);
    mettreAJourPanierUI();
    verifierSessionClient();
    chargerCarrousel();
});

function changerLangue(langue) {
    langueActuelle = langue;
    localStorage.setItem('langueMangassouba', langue);
    appliquerLangue(langue);
}

function appliquerLangue(langue) {
    document.documentElement.lang = langue;
    document.body.dir = langue === 'ar' ? 'rtl' : 'ltr';
    document.querySelectorAll('.lang-selector button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`btn-${langue}`).classList.add('active');
    
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const cle = el.getAttribute('data-i18n');
        if (traductions[langue][cle]) {
            if (el.tagName === 'INPUT' || el.tagName === 'OPTION') { 
                if(el.type !== 'submit' && el.tagName !== 'OPTION') el.placeholder = traductions[langue][cle]; 
                if(el.tagName === 'OPTION') el.textContent = traductions[langue][cle];
            }
            else { el.innerText = traductions[langue][cle]; }
        }
    });
    
    const searchInput = document.getElementById('search-input');
    if(searchInput) searchInput.placeholder = traductions[langue].search_placeholder;

    const activeCatSpan = document.querySelector('.category-header.active span');
    if (activeCatSpan && activeCatSpan.innerText === traductions[langue].all) {
        const titreEl = document.getElementById('titre-section-produits');
        if(titreEl) titreEl.innerText = traductions[langue].latest_products;
    }

    if (clientData) {
        document.getElementById('client-nom-affiche').innerText = clientData.name.split(' ')[0];
    } else {
        document.getElementById('client-nom-affiche').innerText = traductions[langue].nav_login;
    }

    chargerCategories(); 
    mettreAJourPanierUI();
}

function getNomCat(cat) { if (langueActuelle === 'en' && cat.nom_en) return cat.nom_en; if (langueActuelle === 'ar' && cat.nom_ar) return cat.nom_ar; return cat.nom; }
function getNomProduit(prod) { if (langueActuelle === 'en' && prod.nom_en) return prod.nom_en; if (langueActuelle === 'ar' && prod.nom_ar) return prod.nom_ar; return prod.nom; }
function getDescProduit(prod) { if (langueActuelle === 'en' && prod.description_en) return prod.description_en; if (langueActuelle === 'ar' && prod.description_ar) return prod.description_ar; return prod.description; }

async function chargerCarrousel() {
    try {
        const rep = await fetch(`${API_URL}/banners`);
        const banners = await rep.json();
        const conteneur = document.getElementById('carrousel-container');
        conteneur.innerHTML = '';

        if (banners.length === 0) { conteneur.style.display = 'none'; return; }

        banners.forEach(b => {
            const div = document.createElement('div');
            div.className = 'carrousel-item';
            div.onclick = () => { if (b.link_url) window.location.href = b.link_url; else window.location.href = '#produits'; };
            div.innerHTML = `
                <img src="${b.image_url}" alt="${b.title}">
                <div class="carrousel-content"><h3>${b.title}</h3><p>${b.description || ''}</p></div>`;
            conteneur.appendChild(div);
        });

        let index = 0;
        setInterval(() => {
            if(banners.length > 1) {
                index = (index + 1) % banners.length;
                const itemWidth = conteneur.children[0].offsetWidth + 20;
                conteneur.scrollTo({ left: index * itemWidth, behavior: 'smooth' });
            }
        }, 4000);
    } catch (e) { console.error("Erreur carrousel:", e); }
}

async function chargerCategories() {
    try {
        const reponse = await fetch(`${API_URL}/categories`);
        toutesLesCategories = await reponse.json();
        const liste = document.getElementById('liste-categories-sidebar');
        let html = `<div class="category-item"><div class="category-header active" onclick="filtrerCategorie('', this)"><span>${traductions[langueActuelle].all}</span></div></div>`;

        let parents = toutesLesCategories.filter(c => !c.parent_id);
        parents.forEach(parent => {
            let enfants = toutesLesCategories.filter(c => c.parent_id === parent.id);
            let hasChildren = enfants.length > 0;
            html += `<div class="category-item"><div class="category-header" onclick="toggleCategory(this, ${parent.id})"><span>${getNomCat(parent)}</span>${hasChildren ? '<span class="category-arrow">▼</span>' : ''}</div>`;
            if (hasChildren) {
                html += `<div class="subcategory-list" id="subcat-${parent.id}"><div class="subcategory-list-inner">`;
                enfants.forEach(enfant => { html += `<div class="sub-cat-link" onclick="filtrerCategorie(${enfant.id}, this)">${getNomCat(enfant)}</div>`; });
                html += `</div></div>`;
            }
            html += `</div>`;
        });
        liste.innerHTML = html;
        
        const repProd = await fetch(`${API_URL}/products`);
        tousLesProduits = await repProd.json();
        tousLesProduits.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        afficherProduits(tousLesProduits.slice(0, 12));
    } catch (erreur) { console.error("Erreur catégories:", erreur); }
}

function toggleCategory(element, id) {
    const subList = document.getElementById(`subcat-${id}`);
    if (subList) {
        if (subList.classList.contains('open')) { subList.classList.remove('open'); element.classList.remove('open'); }
        else {
            document.querySelectorAll('.subcategory-list').forEach(el => el.classList.remove('open'));
            document.querySelectorAll('.category-header').forEach(el => el.classList.remove('open'));
            subList.classList.add('open'); element.classList.add('open');
        }
    }
    filtrerCategorie(id, element);
}

function filtrerCategorie(id, element) {
    document.querySelectorAll('.category-header').forEach(l => l.classList.remove('active'));
    document.querySelectorAll('.sub-cat-link').forEach(l => l.classList.remove('active'));
    document.getElementById('search-input').value = ''; 
    const titreEl = document.getElementById('titre-section-produits');

    if (id === '') {
        element.classList.add('active');
        if(titreEl) titreEl.innerText = traductions[langueActuelle].latest_products;
        afficherProduits(tousLesProduits.slice(0, 12)); 
    } else if (element.classList.contains('category-header')) {
        element.classList.add('active');
        if(titreEl) titreEl.innerText = element.querySelector('span').innerText;
        const idsSousCategories = toutesLesCategories.filter(c => c.parent_id == id).map(c => c.id);
        afficherProduits(tousLesProduits.filter(p => p.category_id == id || idsSousCategories.includes(p.category_id)));
    } else {
        element.classList.add('active');
        const parentItem = element.closest('.category-item').querySelector('.category-header');
        if (parentItem) { parentItem.classList.add('active', 'open'); const subList = parentItem.nextElementSibling; if(subList) subList.classList.add('open'); }
        if(titreEl) titreEl.innerText = element.innerText;
        afficherProduits(tousLesProduits.filter(p => p.category_id == id));
    }
}

function rechercherProduits() {
    const texte = document.getElementById('search-input').value.toLowerCase();
    const titreEl = document.getElementById('titre-section-produits');

    if (texte === '') { 
        if(titreEl) titreEl.innerText = traductions[langueActuelle].latest_products;
        afficherProduits(tousLesProduits.slice(0, 12)); 
        return; 
    }
    if(titreEl) titreEl.innerText = traductions[langueActuelle].products;

    const produitsFiltres = tousLesProduits.filter(p => {
        const nomFR = (p.nom || '').toLowerCase(); const nomEN = (p.nom_en || '').toLowerCase();
        const nomAR = (p.nom_ar || '').toLowerCase(); const descFR = (p.description || '').toLowerCase();
        return nomFR.includes(texte) || nomEN.includes(texte) || nomAR.includes(texte) || descFR.includes(texte);
    });
    afficherProduits(produitsFiltres);
}

function afficherProduits(produits) {
    const conteneur = document.getElementById('liste-produits');
    conteneur.innerHTML = ''; 
    if (produits.length === 0) { conteneur.innerHTML = `<p class="chargement">${traductions[langueActuelle].no_product}</p>`; return; }

    produits.forEach(produit => {
        const carte = document.createElement('div'); 
        carte.className = 'carte-produit';
        carte.onclick = (e) => { if(e.target.tagName !== 'BUTTON') ouvrirLightbox(produit.id); };
        const imageUrl = produit.media ? produit.media : 'https://via.placeholder.com/250x200?text=Pas+d\'image';
        const prixFormatte = new Intl.NumberFormat(langueActuelle === 'ar' ? 'ar-MR' : (langueActuelle === 'en' ? 'en-US' : 'fr-FR')).format(produit.prix);
        const nomAffiche = getNomProduit(produit);
        let nomCategorie = produit.categorie_nom || 'Divers';
        if (langueActuelle === 'en' && produit.categorie_nom_en) nomCategorie = produit.categorie_nom_en;
        if (langueActuelle === 'ar' && produit.categorie_nom_ar) nomCategorie = produit.categorie_nom_ar;

        let badgeGros = '';
        if (produit.prix_gros > 0) {
            const pGros = new Intl.NumberFormat('fr-FR').format(produit.prix_gros);
            badgeGros = `<div style="background:#e8f5e9; color:var(--vert); padding:4px 8px; border-radius:4px; font-size:12px; margin-bottom:8px; font-weight:bold;">${traductions[langueActuelle].wholesale_info} ${produit.seuil_gros} : ${pGros} MRU</div>`;
        }

        carte.innerHTML = `
            <img src="${imageUrl}" alt="${nomAffiche}">
            <div class="info-produit">
                <p class="categorie">${nomCategorie}</p>
                <h3>${nomAffiche}</h3>
                ${badgeGros}
                <p class="prix">${prixFormatte} MRU</p>
                <button class="btn-ajouter" onclick="ajouterAuPanier(${produit.id}, '${nomAffiche.replace(/'/g, "\\'")}', ${produit.prix}, '${imageUrl}', ${produit.prix_gros || 0}, ${produit.seuil_gros || 10})">${traductions[langueActuelle].add_to_cart}</button>
            </div>`;
        conteneur.appendChild(carte);
    });
}
// ... (Les autres fonctions de panier et client n'ont pas changé)
function ouvrirClient() { if (tokenClient) ouvrirProfil(); else document.getElementById('client-modal').classList.add('show'); }
function fermerClient() { document.getElementById('client-modal').classList.remove('show'); }
function ouvrirProfil() { document.getElementById('profil-modal').classList.add('show'); chargerProfilClient(); }
function fermerProfil() { document.getElementById('profil-modal').classList.remove('show'); }
function changerOngletClient(onglet) {
    if(onglet === 'login') {
        document.getElementById('form-client-login').style.display = 'block'; document.getElementById('form-client-register').style.display = 'none';
        document.getElementById('tab-login-btn').style.background = 'var(--bleu-nuit)'; document.getElementById('tab-login-btn').style.color = 'white';
        document.getElementById('tab-register-btn').style.background = '#eee'; document.getElementById('tab-register-btn').style.color = '#333';
    } else {
        document.getElementById('form-client-login').style.display = 'none'; document.getElementById('form-client-register').style.display = 'block';
        document.getElementById('tab-register-btn').style.background = 'var(--bleu-nuit)'; document.getElementById('tab-register-btn').style.color = 'white';
        document.getElementById('tab-login-btn').style.background = '#eee'; document.getElementById('tab-login-btn').style.color = '#333';
    }
}
async function connecterClient(event) {
    event.preventDefault();
    const phone = document.getElementById('login-phone').value; const password = document.getElementById('login-password').value;
    try {
        const rep = await fetch(`${API_URL}/client-auth/login`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ phone, password }) });
        const data = await rep.json();
        if(rep.ok) {
            tokenClient = data.token; clientData = data.customer;
            localStorage.setItem('clientToken', tokenClient); localStorage.setItem('clientData', JSON.stringify(clientData));
            fermerClient(); verifierSessionClient(); alert(`Bienvenue ${clientData.name} !`);
        } else alert(data.message);
    } catch (e) { alert("Erreur serveur."); }
}
async function inscrireClient(event) {
    event.preventDefault();
    const name = document.getElementById('register-name').value; const phone = document.getElementById('register-phone').value; const password = document.getElementById('register-password').value;
    try {
        const rep = await fetch(`${API_URL}/client-auth/register`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ name, phone, password }) });
        const data = await rep.json();
        if(rep.ok) {
            tokenClient = data.token; clientData = data.customer;
            localStorage.setItem('clientToken', tokenClient); localStorage.setItem('clientData', JSON.stringify(clientData));
            fermerClient(); verifierSessionClient(); alert("Inscription réussie !");
        } else alert(data.message);
    } catch (e) { alert("Erreur serveur."); }
}
function verifierSessionClient() {
    if (tokenClient && clientData) {
        document.getElementById('client-nom-affiche').innerText = clientData.name.split(' ')[0];
        if(document.getElementById('clientName')) document.getElementById('clientName').value = clientData.name;
        if(document.getElementById('phone')) document.getElementById('phone').value = clientData.phone;
    } else { document.getElementById('client-nom-affiche').innerText = traductions[langueActuelle].nav_login; }
}
function deconnecterClient() {
    localStorage.removeItem('clientToken'); localStorage.removeItem('clientData');
    tokenClient = null; clientData = null; fermerProfil(); verifierSessionClient(); window.location.reload();
}
async function chargerProfilClient() {
    try {
        const rep = await fetch(`${API_URL}/client-auth/profile`, { headers: { 'Authorization': `Bearer ${tokenClient}` } });
        if(!rep.ok) return deconnecterClient();
        const data = await rep.json();
        document.getElementById('profil-nom').innerText = data.customer.name;
        document.getElementById('profil-phone').innerText = data.customer.phone;
        document.getElementById('profil-points').innerText = data.customer.points;
        const conteneur = document.getElementById('profil-commandes'); conteneur.innerHTML = '';
        if(data.orders.length === 0) { conteneur.innerHTML = '<p style="font-size:13px; color:#777;">Aucune commande pour le moment.</p>'; return; }
        data.orders.forEach(o => {
            const date = new Date(o.created_at).toLocaleDateString('fr-FR');
            let statusColor = o.status === 'livrée' ? 'var(--vert)' : (o.status === 'confirmée' ? '#004085' : '#856404');
            let statusBg = o.status === 'livrée' ? '#d4edda' : (o.status === 'confirmée' ? '#cce5ff' : '#fff3cd');
            let statusTxt = traductions[langueActuelle]['status_'+o.status.replace('é','e')] || o.status;
            const div = document.createElement('div'); div.className = 'commande-profil-item';
            div.innerHTML = `<div><h4>Commande #${o.id}</h4><p>${date} - ${new Intl.NumberFormat('fr-FR').format(o.total)} MRU</p></div><span class="status-badge" style="color:${statusColor}; background:${statusBg};">${statusTxt}</span>`;
            conteneur.appendChild(div);
        });
    } catch (e) { console.error(e); }
}
async function ouvrirLightbox(id) {
    produitLightbox = tousLesProduits.find(p => p.id === id);
    if(!produitLightbox) return;
    document.getElementById('lb-image').src = produitLightbox.media || 'https://via.placeholder.com/400x400';
    document.getElementById('lb-image').style.display = 'block';
    const videoEl = document.getElementById('lb-video'); const btnPlay = document.getElementById('btn-play-video');
    if (produitLightbox.video) { videoEl.src = produitLightbox.video; btnPlay.style.display = 'block'; videoEl.style.display = 'none'; } 
    else { btnPlay.style.display = 'none'; videoEl.style.display = 'none'; videoEl.src = ''; }
    document.getElementById('lb-nom').innerText = getNomProduit(produitLightbox);
    document.getElementById('lb-desc').innerText = getDescProduit(produitLightbox) || 'Aucune description.';
    document.getElementById('lb-prix').innerText = new Intl.NumberFormat('fr-FR').format(produitLightbox.prix) + ' MRU';
    let nomCategorie = produitLightbox.categorie_nom || 'Divers';
    if (langueActuelle === 'en' && produitLightbox.categorie_nom_en) nomCategorie = produitLightbox.categorie_nom_en;
    if (langueActuelle === 'ar' && produitLightbox.categorie_nom_ar) nomCategorie = produitLightbox.categorie_nom_ar;
    document.getElementById('lb-categorie').innerText = nomCategorie;
    document.getElementById('lb-btn-ajouter').innerText = traductions[langueActuelle].add_to_cart;
    noteActuelle = 5;
    document.querySelectorAll('#etoiles-input span').forEach((s, i) => { if(i < 5) s.classList.add('active'); });
    document.getElementById('form-avis').reset();
    document.getElementById('lightbox-modal').classList.add('show');
    chargerAvis(id);
}
function jouerVideoLightbox() {
    document.getElementById('btn-play-video').style.display = 'none';
    document.getElementById('lb-image').style.display = 'none';
    document.getElementById('lb-video').style.display = 'block';
    document.getElementById('lb-video').play();
}
function fermerLightbox() { document.getElementById('lightbox-modal').classList.remove('show'); const videoEl = document.getElementById('lb-video'); videoEl.pause(); videoEl.currentTime = 0; }
function ajouterDepuisLightbox() { if (produitLightbox) ajouterAuPanier(produitLightbox.id, getNomProduit(produitLightbox), produitLightbox.prix, produitLightbox.media, produitLightbox.prix_gros, produitLightbox.seuil_gros); }
async function chargerAvis(productId) {
    const conteneur = document.getElementById('lb-avis-liste'); conteneur.innerHTML = `<p style="font-size:12px; color:#777;">...</p>`;
    try {
        const reponse = await fetch(`${API_URL}/reviews/${productId}`); const avis = await reponse.json(); conteneur.innerHTML = '';
        if (avis.length === 0) { conteneur.innerHTML = `<p style="font-size:13px; color:#777;">Aucun avis.</p>`; return; }
        avis.forEach(a => {
            const div = document.createElement('div'); div.className = 'avis-item';
            const etoiles = '★'.repeat(a.rating) + '☆'.repeat(5 - a.rating);
            div.innerHTML = `<div class="avis-header"><strong>${a.client_name}</strong> <span class="avis-etoiles">${etoiles}</span></div><p class="avis-comment">${a.comment || ''}</p>`;
            conteneur.appendChild(div);
        });
    } catch (err) { conteneur.innerHTML = 'Erreur.'; }
}
function noter(note) { noteActuelle = note; document.querySelectorAll('#etoiles-input span').forEach((s, i) => { if(i < note) s.classList.add('active'); else s.classList.remove('active'); }); }
async function soumettreAvis(event) {
    event.preventDefault();
    const nom = document.getElementById('avis-nom').value; const comment = document.getElementById('avis-comment').value;
    const btn = event.target.querySelector('button[type="submit"]'); btn.disabled = true; btn.innerText = "...";
    try {
        const reponse = await fetch(`${API_URL}/reviews`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: produitLightbox.id, client_name: nom, rating: noteActuelle, comment }) });
        if (reponse.ok) { document.getElementById('form-avis').reset(); chargerAvis(produitLightbox.id); }
    } catch (err) { alert("Erreur serveur."); } finally { btn.disabled = false; btn.innerText = traductions[langueActuelle].send_review; }
}
function ouvrirSuivi() { document.getElementById('suivi-modal').classList.add('show'); document.getElementById('suivi-resultats').innerHTML = ''; }
function fermerSuivi() { document.getElementById('suivi-modal').classList.remove('show'); }
async function rechercherCommande() {
    const phone = document.getElementById('track-phone').value; const conteneur = document.getElementById('suivi-resultats');
    if (!phone) return alert("Veuillez entrer un numéro.");
    conteneur.innerHTML = `<p style="text-align:center;">...</p>`;
    try {
        const reponse = await fetch(`${API_URL}/orders/track/${phone}`); const commandes = await reponse.json(); conteneur.innerHTML = '';
        if (commandes.length === 0) { conteneur.innerHTML = `<p style="color:red; text-align:center;">${traductions[langueActuelle].track_no_found}</p>`; return; }
        commandes.forEach(cmd => {
            const date = new Date(cmd.created_at).toLocaleDateString('fr-FR');
            let statusClass = cmd.status === 'livrée' ? 'status-livree' : (cmd.status === 'confirmée' ? 'status-confirmee' : 'status-attente');
            let statusText = traductions[langueActuelle]['status_'+cmd.status.replace('é','e')] || cmd.status;
            let itemsHtml = '<ul>'; const itemsArray = typeof cmd.items === 'string' ? JSON.parse(cmd.items) : cmd.items;
            itemsArray.forEach(item => { itemsHtml += `<li>${item.qty}x ${item.nom}</li>`; }); itemsHtml += '</ul>';
            const div = document.createElement('div'); div.className = 'suivi-card';
            div.innerHTML = `<div class="suivi-header"><h4>Commande #${cmd.id}</h4><span class="suivi-status ${statusClass}">${statusText}</span></div><div class="suivi-details"><p><strong>Date :</strong> ${date}</p><p><strong>Total :</strong> ${new Intl.NumberFormat('fr-FR').format(cmd.total)} MRU</p><div style="margin-top: 10px;">${itemsHtml}</div></div>`;
            conteneur.appendChild(div);
        });
    } catch (err) { conteneur.innerHTML = `<p style="color:red; text-align:center;">Erreur serveur.</p>`; }
}
function ajouterAuPanier(id, nom, prix, image, prix_gros, seuil_gros) { 
    const itemExistant = monPanier.find(item => item.id === id); 
    if (itemExistant) itemExistant.qty += 1; else monPanier.push({ id, nom, prix, image, prix_gros, seuil_gros, qty: 1 }); 
    sauvegarderPanier(); ouvrirPanier(); 
}
function modifierQuantite(id, changement) { const item = monPanier.find(item => item.id === id); if (item) { item.qty += changement; if (item.qty <= 0) monPanier = monPanier.filter(i => i.id !== id); sauvegarderPanier(); } }
function supprimerDuPanier(id) { monPanier = monPanier.filter(item => item.id !== id); sauvegarderPanier(); }
function sauvegarderPanier() { localStorage.setItem('panierMangassouba', JSON.stringify(monPanier)); mettreAJourPanierUI(); }
function mettreAJourPanierUI() {
    const conteneur = document.getElementById('panier-items'); const count = document.getElementById('panier-count'); let total = 0; let totalArticles = 0;
    conteneur.innerHTML = '';
    if (monPanier.length === 0) conteneur.innerHTML = `<p style="text-align:center; color:#777; margin-top:20px;">${traductions[langueActuelle].empty_cart}</p>`;
    else {
        monPanier.forEach(item => {
            let prixUnitaire = item.prix; let isGros = false;
            if (item.prix_gros > 0 && item.qty >= item.seuil_gros) { prixUnitaire = item.prix_gros; isGros = true; }
            total += prixUnitaire * item.qty; totalArticles += item.qty;
            const div = document.createElement('div'); div.className = 'item-panier';
            const prixFormatte = new Intl.NumberFormat(langueActuelle === 'ar' ? 'ar-MR' : (langueActuelle === 'en' ? 'en-US' : 'fr-FR')).format(prixUnitaire);
            const badgeGros = isGros ? `<span style="font-size:10px; background:var(--vert); color:white; padding:2px 5px; border-radius:4px; margin-left:5px;">Prix de gros</span>` : '';
            div.innerHTML = `<img src="${item.image}"><div class="item-details"><h4>${item.nom} ${badgeGros}</h4><p class="prix-item">${prixFormatte} MRU</p><div class="item-actions"><button onclick="modifierQuantite(${item.id}, -1)">-</button><span>${item.qty}</span><button onclick="modifierQuantite(${item.id}, 1)">+</button><button class="btn-supprimer" onclick="supprimerDuPanier(${item.id})">X</button></div></div>`;
            conteneur.appendChild(div);
        });
    }
    count.innerText = totalArticles;
    const totalFormatte = new Intl.NumberFormat(langueActuelle === 'ar' ? 'ar-MR' : (langueActuelle === 'en' ? 'en-US' : 'fr-FR')).format(total);
    document.getElementById('panier-total').innerText = totalFormatte + ' MRU'; calculerTotal();
}
function ouvrirPanier() { document.getElementById('panier-sidebar').classList.add('open'); document.getElementById('panier-overlay').classList.add('show'); }
function fermerPanier() { document.getElementById('panier-sidebar').classList.remove('open'); document.getElementById('panier-overlay').classList.remove('show'); }
function ouvrirCheckout() { if (monPanier.length === 0) return alert(traductions[langueActuelle].empty_cart); fermerPanier(); document.getElementById('checkout-modal').classList.add('show'); calculerTotal(); }
function fermerCheckout() { document.getElementById('checkout-modal').classList.remove('show'); }
function calculerTotal() {
    let sousTotal = monPanier.reduce((acc, item) => {
        let prixUnitaire = item.prix;
        if (item.prix_gros > 0 && item.qty >= item.seuil_gros) prixUnitaire = item.prix_gros;
        return acc + (prixUnitaire * item.qty);
    }, 0);
    let reduction = promoAppliquee ? (sousTotal * promoAppliquee.discount_percent) / 100 : 0;
    const formatter = new Intl.NumberFormat(langueActuelle === 'ar' ? 'ar-MR' : (langueActuelle === 'en' ? 'en-US' : 'fr-FR'));
    document.getElementById('checkout-sous-total').innerText = formatter.format(sousTotal);
    document.getElementById('checkout-total').innerText = formatter.format(sousTotal - reduction);
    if (reduction > 0) { document.getElementById('ligne-reduction').style.display = 'flex'; document.getElementById('checkout-reduction').innerText = formatter.format(reduction); }
    else document.getElementById('ligne-reduction').style.display = 'none';
}
async function verifierPromo() {
    const code = document.getElementById('promoCode').value; if (!code) return;
    try {
        const reponse = await fetch(`${API_URL}/utils/promo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
        const data = await reponse.json();
        if (reponse.ok) { promoAppliquee = data; alert(`Code promo appliqué : -${data.discount_percent}% !`); calculerTotal(); }
        else { alert(data.message); promoAppliquee = null; calculerTotal(); }
    } catch (erreur) { console.error(erreur); }
}
async function envoyerCommande(event) {
    event.preventDefault();
    const btn = event.target.querySelector('button[type="submit"]'); btn.innerText = "..."; btn.disabled = true;
    let sousTotal = 0;
    const itemsToOrder = monPanier.map(item => {
        let appliedPrice = item.prix;
        if (item.prix_gros > 0 && item.qty >= item.seuil_gros) appliedPrice = item.prix_gros;
        sousTotal += appliedPrice * item.qty;
        return { id: item.id, nom: item.nom, prix: appliedPrice, qty: item.qty };
    });
    const reduction = promoAppliquee ? (sousTotal * promoAppliquee.discount_percent) / 100 : 0;
    const commandeData = { 
        clientName: document.getElementById('clientName').value, 
        phone: document.getElementById('phone').value, 
        address: document.getElementById('address').value, 
        items: itemsToOrder, 
        payment: document.getElementById('payment').value, 
        delivery_zone: "Retrait en boutique", delivery_fee: 0, 
        promo_code: promoAppliquee ? promoAppliquee.code : null, 
        discount_amount: reduction, total: sousTotal - reduction 
    };
    try {
        const reponse = await fetch(`${API_URL}/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(commandeData) });
        const data = await reponse.json();
        if (reponse.ok) { alert(`✅ Commande confirmée ! Numéro : #${data.order.id}`); monPanier = []; promoAppliquee = null; sauvegarderPanier(); fermerCheckout(); if(tokenClient) verifierSessionClient(); }
        else alert("Erreur : " + data.message);
    } catch (erreur) { alert("Erreur de connexion."); } finally { btn.innerText = traductions[langueActuelle].confirm_btn; btn.disabled = false; }
}