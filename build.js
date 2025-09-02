const fs = require('fs');
const path = require('path');

const root = __dirname;
const outDir = path.join(root, 'docs');

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

// clean output directory
if (fs.existsSync(outDir)) {
  fs.rmSync(outDir, { recursive: true, force: true });
}
fs.mkdirSync(outDir, { recursive: true });

// files/directories to copy
const items = [
  { src: 'template.html', dest: 'index.html' },
  { src: 'console.html', dest: 'console.html' },
  { src: 'css', dest: 'css' },
  { src: 'js', dest: 'js' },
  { src: 'apk', dest: 'apk' },
  { src: 'CNAME', dest: 'CNAME' }
];

for (const item of items) {
  const srcPath = path.join(root, item.src);
  const destPath = path.join(outDir, item.dest);
  copyRecursive(srcPath, destPath);
}

console.log(`Built static site in ${outDir}`);
