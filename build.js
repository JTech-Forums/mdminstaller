const fs = require('fs');
const path = require('path');
const KITS = require('./js/data/kits.js').default;

const root = __dirname;
const outDir = path.join(root, 'docs');

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      if (entry === 'url.txt') continue; // skip helper metadata files
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
  { src: 'privacy.txt', dest: 'privacy.txt' },
  { src: 'css', dest: 'css' },
  { src: 'js', dest: 'js' },
  { src: 'CNAME', dest: 'CNAME' },
  { src: 'apk', dest: 'apk' }
];

for (const item of items) {
  const srcPath = path.join(root, item.src);
  const destPath = path.join(outDir, item.dest);
  copyRecursive(srcPath, destPath);
}

// generate APK metadata for static builds
function generateApkMetadata() {
  const apkDir = path.join(root, 'apk');
  const entries = fs.readdirSync(apkDir, { withFileTypes: true });

  const apps = entries
    .filter((e) => e.isDirectory() && e.name !== 'blog')
    .map((dir) => {
      const dirPath = path.join(apkDir, dir.name);

      let postInstallCommands = null;
      const commandPath = path.join(dirPath, 'command.txt');
      if (fs.existsSync(commandPath)) {
        const content = fs.readFileSync(commandPath, 'utf8');
        postInstallCommands = content
          .trim()
          .split('\n')
          .filter((c) => c.trim());
      }

      let imageUrl = null;
      for (const file of fs.readdirSync(dirPath)) {
        if (/\.(png|jpe?g|svg)$/i.test(file)) {
          imageUrl = `apk/${dir.name}/${file}`;
          break;
        }
      }

      // Allow per-app override of APK URL via optional url.txt
      let apkUrl = `https://pub-587c8a0ce03148689a821b1655d304f5.r2.dev/${dir.name}.apk`;
      const urlPath = path.join(dirPath, 'url.txt');
      if (fs.existsSync(urlPath)) {
        apkUrl = fs.readFileSync(urlPath, 'utf8').trim();
      }

      return {
        name: dir.name,
        image: imageUrl,
        url: apkUrl,
        postInstallCommands
      };
    });

  const enrichedApps = apps.map((app) => {
    const kit = KITS.find((k) => k.key === app.name);
    if (kit) {
      if (kit.pricing) app.pricing = kit.pricing;
      if (kit.badge) app.badge = kit.badge;
    }
    return app;
  });

  fs.writeFileSync(
    path.join(outDir, 'apks.json'),
    JSON.stringify(enrichedApps, null, 2)
  );
}

generateApkMetadata();

console.log(`Built static site in ${outDir}`);
