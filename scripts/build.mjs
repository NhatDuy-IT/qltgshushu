import { cpSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const dist = resolve(root, 'dist');

if (existsSync(dist)) {
  rmSync(dist, { recursive: true, force: true });
}
mkdirSync(dist, { recursive: true });

const copyTargets = [
  ['index.html', 'index.html'],
  ['sw.js', 'sw.js'],
  ['favicon.ico', 'favicon.ico'],
  ['favicon.png', 'favicon.png'],
  ['src', 'src'],
  ['public', 'public']
];

for (const [from, to] of copyTargets) {
  const srcPath = resolve(root, from);
  const destPath = resolve(dist, to);
  if (existsSync(srcPath)) {
    cpSync(srcPath, destPath, { recursive: true });
  }
}

// Also copy manifest at root fallback for older PWA scanners
const manifestSrc = resolve(root, 'public/manifest.json');
if (existsSync(manifestSrc)) {
  cpSync(manifestSrc, resolve(dist, 'manifest.json'));
}

console.log('ShuShu build completed -> dist/');
