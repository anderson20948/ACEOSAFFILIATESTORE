const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '..');
const buildDir = path.join(srcDir, 'build');
const entries = [
  'index.html',
  'css',
  'fonts',
  'images',
  'js',
  'users',
  'views'
];

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const child of fs.readdirSync(src)) {
      if (child === 'node_modules' || child === 'build' || child === 'scripts') continue;
      copyRecursive(path.join(src, child), path.join(dest, child));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

if (fs.existsSync(buildDir)) {
  fs.rmSync(buildDir, { recursive: true, force: true });
}
fs.mkdirSync(buildDir, { recursive: true });

for (const entry of entries) {
  const entryPath = path.join(srcDir, entry);
  if (!fs.existsSync(entryPath)) {
    continue;
  }

  const destPath = path.join(buildDir, entry);
  copyRecursive(entryPath, destPath);
}

console.log('Frontend build folder created at:', buildDir);
