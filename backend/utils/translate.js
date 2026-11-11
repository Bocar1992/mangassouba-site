// backend/utils/translate.js
// Traduction automatique FR -> EN / AR (endpoint public Google, non officiel).
// Ne bloque jamais l'enregistrement : en cas d'échec on renvoie null.

async function traduireTexte(texte, langueCible) {
  if (!texte || typeof texte !== 'string') return null;
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=fr&tl=${langueCible}&dt=t&q=${encodeURIComponent(texte.slice(0, 2000))}`;
    const reponse = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!reponse.ok) return null;
    const data = await reponse.json();
    // data[0] = liste de segments [texteTraduit, texteOriginal, ...]
    const segments = Array.isArray(data[0]) ? data[0] : [];
    const out = segments.map((s) => (Array.isArray(s) ? s[0] : '')).join('').trim();
    return out || null;
  } catch (err) {
    return null;
  }
}

// EN + AR en parallèle
async function traduireEnAr(texte) {
  const [en, ar] = await Promise.all([traduireTexte(texte, 'en'), traduireTexte(texte, 'ar')]);
  return { en, ar };
}

module.exports = { traduireTexte, traduireEnAr };
