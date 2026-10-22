import { build } from 'esbuild';
import fs from 'fs';
import path from 'path';

fs.rmSync('www', { recursive: true, force: true });
fs.mkdirSync('www/fonts', { recursive: true });

for (const f of fs.readdirSync('public')) {
  fs.copyFileSync(path.join('public', f), path.join('www', f));
}

const fonts = {
  'fredoka-500.woff2': 'node_modules/@fontsource/fredoka/files/fredoka-latin-500-normal.woff2',
  'fredoka-600.woff2': 'node_modules/@fontsource/fredoka/files/fredoka-latin-600-normal.woff2',
  'fredoka-700.woff2': 'node_modules/@fontsource/fredoka/files/fredoka-latin-700-normal.woff2',
  'jakarta-500.woff2': 'node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-500-normal.woff2',
  'jakarta-600.woff2': 'node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-600-normal.woff2',
  'jakarta-700.woff2': 'node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-700-normal.woff2',
  'jakarta-800.woff2': 'node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-800-normal.woff2',
};
for (const [dst, src] of Object.entries(fonts)) fs.copyFileSync(src, path.join('www/fonts', dst));

await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  outfile: 'www/app.js',
  format: 'iife',
  minify: true,
  target: ['es2019'],
  logLevel: 'info',
});
