// Cloudflare Worker: Review submission proxy with Turnstile verification
//
// Deploy steps (summary):
// - In Cloudflare dashboard, create a Worker and paste this file.
// - Set environment variables (Bindings):
//     TURNSTILE_SECRET:   Cloudflare Turnstile secret key
//     SUPABASE_REST_URL:  e.g. https://<project>.supabase.co/rest/v1/reviews
//     SUPABASE_SERVICE_ROLE: Supabase service role key (keep secret)
//     ALLOW_ORIGIN:       https://installer.jtechforums.org (production origin)
// - Add a Route: https://installer.jtechforums.org/api/reviews*
//   (Ensure your domain is orange‑cloud proxied by Cloudflare.)
// - In the site, set window.REVIEWS_CONFIG.proxy.url = '/api/reviews'
//   and load Turnstile on this domain (see template.html snippet).

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const allow = env.ALLOW_ORIGIN || '*';
    const corsHeaders = {
      'Access-Control-Allow-Origin': allow === '*' ? '*' : (origin === allow ? allow : 'null'),
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '600',
      'Vary': 'Origin',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    try {
      const payload = await request.json();
      const vendor = (payload.vendor || '').toString().slice(0, 80);
      const name = (payload.name || 'Anonymous').toString().slice(0, 40);
      const rating = Math.max(1, Math.min(5, Number(payload.rating) || 5));
      const text = (payload.text || '').toString().slice(0, 2000);
      const cfToken = (payload.cfToken || '').toString();
      if (!vendor || !text || !cfToken) {
        return new Response(JSON.stringify({ error: 'Missing fields' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Verify Turnstile token
      const form = new URLSearchParams();
      form.set('secret', env.TURNSTILE_SECRET);
      form.set('response', cfToken);
      const ip = request.headers.get('CF-Connecting-IP');
      if (ip) form.set('remoteip', ip);
      const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: form,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      const verifyJson = await verify.json();
      if (!verifyJson || !verifyJson.success) {
        return new Response(JSON.stringify({ error: 'Turnstile verification failed' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Insert to Supabase (service role)
      const supaRes = await fetch(env.SUPABASE_REST_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': env.SUPABASE_SERVICE_ROLE,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE}`,
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({ vendor, name, rating, text }),
      });
      const body = await supaRes.text();
      if (!supaRes.ok) {
        return new Response(JSON.stringify({ error: 'Supabase insert failed' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      return new Response(body || '{}', { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  }
};

