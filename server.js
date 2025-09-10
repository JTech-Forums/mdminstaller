const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Prefer env var, default to 8000
let PORT = Number(process.env.PORT) || 8000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Load HTML template once at startup
const INDEX_HTML = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8');

const server = http.createServer((req, res) => {
  console.log(`Request: ${req.method} ${req.url}`);
  
  // Handle API endpoints
  if (req.method === 'POST' && req.url === '/api/reviews') {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 1e6) req.destroy(); });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body || '{}');
        const { vendor, name, rating, text, cfToken } = data || {};
        if (!vendor || !text || !rating || !cfToken) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Missing fields' }));
        }

        // Verify Turnstile
        const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET || '0x4AAAAAAB0euZX6xBIjkB87qVjhPzyxjm8';
        const verifyResp = await new Promise((resolve, reject) => {
          const postData = new URLSearchParams({ secret: TURNSTILE_SECRET, response: cfToken }).toString();
          const reqOpts = {
            method: 'POST',
            hostname: 'challenges.cloudflare.com',
            path: '/turnstile/v0/siteverify',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) }
          };
          const vreq = https.request(reqOpts, vres => {
            let resp = '';
            vres.on('data', d => resp += d);
            vres.on('end', () => {
              try { resolve(JSON.parse(resp)); } catch (e) { reject(e); }
            });
          });
          vreq.on('error', reject);
          vreq.write(postData);
          vreq.end();
        });

        if (!verifyResp || !verifyResp.success) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Turnstile verification failed' }));
        }

        // Insert into Supabase
        const SUPABASE_URL = process.env.SUPABASE_REST_URL || 'https://hspzbenmhijqowsltijs.supabase.co/rest/v1/reviews';
        const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzcHpiZW5taGlqcW93c2x0aWpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1MjQyMDYsImV4cCI6MjA3MzEwMDIwNn0.3IZkSFy44cruJDFPdwOwbhj9x2afcBEun3UVAm7oh9k';

        const supaResp = await new Promise((resolve, reject) => {
          const payload = JSON.stringify({ vendor, name: name || 'Anonymous', rating: Math.max(1, Math.min(5, Number(rating) || 5)), text });
          const url = new URL(SUPABASE_URL);
          const opts = {
            method: 'POST',
            hostname: url.hostname,
            path: url.pathname + (url.search || ''),
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload),
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Prefer': 'return=representation'
            }
          };
          const sreq = https.request(opts, sres => {
            let resp = '';
            sres.on('data', d => resp += d);
            sres.on('end', () => resolve({ status: sres.statusCode, body: resp }));
          });
          sreq.on('error', reject);
          sreq.write(payload);
          sreq.end();
        });

        if (!supaResp || supaResp.status < 200 || supaResp.status >= 300) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Supabase insert failed' }));
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(supaResp.body || '{}');
      } catch (e) {
        console.error('Review submit error:', e);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Server error' }));
      }
    });
    return;
  }
  if (req.url === '/api/apks') {
    // List application folders in the apk directory
    fs.readdir('./apk', { withFileTypes: true }, (err, entries) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to read apk folder' }));
        return;
      }

      const apps = entries
        .filter(entry => entry.isDirectory() && entry.name !== 'blog')
        .map(dir => {
          const dirPath = path.join('./apk', dir.name);

          // Load post-install commands if available
          let postInstallCommands = null;
          const commandPath = path.join(dirPath, 'command.txt');
          if (fs.existsSync(commandPath)) {
            try {
              const commandContent = fs.readFileSync(commandPath, 'utf8');
              postInstallCommands = commandContent.trim().split('\n').filter(cmd => cmd.trim());
            } catch (err) {
              console.warn(`Failed to read command file for ${dir.name}:`, err.message);
            }
          }

          // Find icon file (png/jpg/jpeg/svg) with common names
          let imageFile = null;
          const iconCandidates = [
            'icon.png', 'icon.jpg', 'icon.jpeg', 'icon.svg',
            'image.png', 'image.jpg', 'image.jpeg', 'image.svg'
          ];
          for (const img of iconCandidates) {
            const imgPath = path.join(dirPath, img);
            if (fs.existsSync(imgPath)) {
              imageFile = `/apk/${dir.name}/${img}`;
              break;
            }
          }

          const apkUrl = `https://pub-587c8a0ce03148689a821b1655d304f5.r2.dev/${dir.name}.apk`;

          return {
            name: dir.name,
            image: imageFile,
            url: apkUrl,
            postInstallCommands
          };
        });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(apps));
    });
    return;
  }
  
  // Serve main interface
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(INDEX_HTML, 'utf-8');
    return;
  }

  // Serve favicon
  if (req.url === '/favicon.ico') {
    const iconPath = path.join(__dirname, 'icon.png');
    fs.readFile(iconPath, (err, content) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
      } else {
        res.writeHead(200, { 'Content-Type': 'image/png' });
        res.end(content, 'utf-8');
      }
    });
    return;
  }

  let filePath = '.' + req.url;
  
  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';
  
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // File not found
        fs.readFile('./404.html', (err, content404) => {
          res.writeHead(404, { 'Content-Type': 'text/html' });
          res.end(content404 || '404 Not Found', 'utf-8');
        });
      } else {
        // Server error
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`);
      }
    } else {
      // Success
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// Log once listening (works for retries too)
server.on('listening', () => {
  const addr = server.address();
  const port = typeof addr === 'string' ? addr : addr.port;
  console.log(`Server running at http://localhost:${port}/`);
});

// If port is already in use, try next ports automatically
server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    const nextPort = PORT + 1;
    console.warn(`Port ${PORT} in use. Trying ${nextPort}...`);
    PORT = nextPort;
    setTimeout(() => server.listen(PORT), 150);
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});

server.listen(PORT);
