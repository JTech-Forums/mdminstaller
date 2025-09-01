const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8000;

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

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
