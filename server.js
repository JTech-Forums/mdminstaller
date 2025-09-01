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
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  console.log(`Request: ${req.method} ${req.url}`);
  
  // Handle API endpoints
  if (req.url === '/api/apks') {
    // List APK files in the apk folder
    fs.readdir('./apk', (err, files) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to read apk folder' }));
        return;
      }
      
      const apkFiles = files
        .filter(file => file.toLowerCase().endsWith('.apk'))
        .map(file => {
          const stats = fs.statSync(path.join('./apk', file));
          const baseName = file.replace('.apk', '');
          const commandFile = baseName + '.txt';
          
          // Check if companion .txt file exists
          let postInstallCommands = null;
          if (files.includes(commandFile)) {
            try {
              const commandContent = fs.readFileSync(path.join('./apk', commandFile), 'utf8');
              postInstallCommands = commandContent.trim().split('\n').filter(cmd => cmd.trim());
            } catch (err) {
              console.warn(`Failed to read command file ${commandFile}:`, err.message);
            }
          }
          
          return {
            name: file,
            size: stats.size,
            path: `/apk/${file}`,
            postInstallCommands: postInstallCommands
          };
        });
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(apkFiles));
    });
    return;
  }
  
  let filePath = '.' + req.url;
  if (filePath === './') {
    filePath = './index.html';
  }
  
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
