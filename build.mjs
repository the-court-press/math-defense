// Builds one self-contained HTML file (styles and script inlined) that runs by
// double-click, from a USB stick, or from any static host. No server needed.
//
//   node build.mjs          production build, minified    -> dist/index.html
//   node build.mjs --dev    readable build with the       -> .tmp/dev/index.html
//                           window.__md debug hook (used by npm run shots)
//
// The dev build never writes to dist/, so the published file never carries the debug hook.

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const dev = process.argv.includes('--dev');
const outFile = dev ? '.tmp/dev/index.html' : 'dist/index.html';

const result = await esbuild.build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  format: 'iife',
  target: ['es2020', 'safari14', 'chrome90', 'firefox90'],
  define: { __VERSION__: JSON.stringify(pkg.version), __DEV__: JSON.stringify(dev) },
  minify: !dev,
  write: false,
  legalComments: 'none',
  logLevel: 'warning',
});

const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = fs.readFileSync('src/styles.css', 'utf8');
const html = fs
  .readFileSync('src/index.html', 'utf8')
  .replaceAll('{{VERSION}}', pkg.version)
  .replace('/*STYLES*/', () => css)
  .replace('/*SCRIPT*/', () => js);

if (!dev && html.includes('__md')) throw new Error('debug hook leaked into the production build');

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, html);
console.log(`${outFile}  v${pkg.version}${dev ? ' (dev)' : ''}  ${(html.length / 1024).toFixed(0)} KB`);
