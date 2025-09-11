// Simple reviews provider with localStorage fallback and optional Supabase REST

const LOCAL_KEY = 'mdm_reviews_v1';

function backendEnabled() {
  try {
    const cfg = window.REVIEWS_CONFIG || {};
    if (cfg.disableBackend === true) return false;
    const allowed = cfg.enableBackend === true || cfg.allowDirectSupabase === true;
    if (!allowed) return false;
    const supa = (cfg && cfg.supabase) || window.REVIEWS_SUPABASE;
    return !!(supa && supa.url && supa.apiKey);
  } catch {
    return false;
  }
}

function getSupabaseConfig() {
  const cfg = window.REVIEWS_CONFIG || {};
  return (cfg && cfg.supabase) || window.REVIEWS_SUPABASE;
}

function loadLocal() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}'); } catch { return {}; }
}

function saveLocal(map) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn('Unable to persist reviews to localStorage:', e && e.message);
  }
}

async function loadFromSupabase(vendor) {
  if (!backendEnabled()) return null;
  const cfg = getSupabaseConfig();
  if (!cfg || !cfg.url || !cfg.apiKey) return null;
  const url = `${cfg.url}?vendor=eq.${encodeURIComponent(vendor)}&order=created_at.desc`;
  const res = await fetch(url, {
    headers: {
      apikey: cfg.apiKey,
      Authorization: `Bearer ${cfg.apiKey}`,
    },
  });
  if (!res.ok) throw new Error('Failed to load reviews');
  const rows = await res.json();
  return rows.map(r => ({
    name: r.name || 'Anonymous',
    rating: Number(r.rating) || 0,
    text: r.text || '',
    createdAt: r.created_at || new Date().toISOString(),
  }));
}

async function submitToSupabase(vendor, review) {
  if (!backendEnabled()) return false;
  const cfg = getSupabaseConfig();
  if (!cfg || !cfg.url || !cfg.apiKey) return false;
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: cfg.apiKey,
      Authorization: `Bearer ${cfg.apiKey}`,
      Prefer: 'return=representation',
    },
    mode: 'cors',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    cache: 'no-store',
    body: JSON.stringify({
      vendor,
      name: review.name || 'Anonymous',
      rating: review.rating || 0,
      text: review.text || '',
    }),
  });
  if (!res.ok) {
    let body = '';
    try { body = await res.text(); } catch {}
    console.warn('Supabase insert failed', res.status, body?.slice(0, 200));
    return false;
  }
  return true;
}

export async function loadReviews(vendor) {
  // Try Supabase if configured, otherwise local
  try {
    const supa = await loadFromSupabase(vendor);
    if (supa) return supa;
  } catch (e) {
    console.warn('Supabase load failed, falling back to localStorage:', e.message);
  }
  const map = loadLocal();
  return map[vendor] || [];
}

// Load all reviews for all vendors in one request (if Supabase configured)
export async function loadAllReviews() {
  // Fallback to local map when no backend
  if (!backendEnabled()) return loadLocal();

  try {
    const cfg = getSupabaseConfig();
    if (!cfg || !cfg.url || !cfg.apiKey) return loadLocal();
    const url = `${cfg.url}?select=vendor,name,rating,text,created_at&order=created_at.desc`;
    const res = await fetch(url, {
      headers: { apikey: cfg.apiKey, Authorization: `Bearer ${cfg.apiKey}` },
    });
    if (!res.ok) throw new Error(`Failed to load all reviews: ${res.status}`);
    const rows = await res.json();
    const map = {};
    for (const r of rows) {
      const v = r.vendor || 'unknown';
      if (!map[v]) map[v] = [];
      map[v].push({
        name: r.name || 'Anonymous',
        rating: Number(r.rating) || 0,
        text: r.text || '',
        createdAt: r.created_at || new Date().toISOString(),
      });
    }
    return map;
  } catch (e) {
    console.warn('loadAllReviews failed, falling back to localStorage:', e.message);
    return loadLocal();
  }
}

export async function submitReview(vendor, review, opts = {}) {
  const cfg = window.REVIEWS_CONFIG || {};
  // Always attempt direct Supabase submission for pure client flow
  try { await submitToSupabase(vendor, review); } catch {}
  // Optimistically store locally
  const map = loadLocal();
  const list = map[vendor] || [];
  const entry = {
    name: (review.name || 'Anonymous').slice(0, 40),
    rating: Math.max(1, Math.min(5, Number(review.rating) || 5)),
    text: (review.text || '').slice(0, 2000),
    createdAt: new Date().toISOString(),
  };
  list.unshift(entry);
  map[vendor] = list.slice(0, 1000); // cap per vendor
  saveLocal(map);
  return map[vendor];
}

export function computeAverage(reviews) {
  if (!reviews || reviews.length === 0) return 0;
  const sum = reviews.reduce((s, r) => s + (Number(r.rating) || 0), 0);
  return Math.round((sum / reviews.length) * 10) / 10; // one decimal
}
