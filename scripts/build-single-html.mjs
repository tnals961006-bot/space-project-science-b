import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist-pages');
const output = resolve(dist, 'SPACE_scienceB_1-3_review.html');
let html = await readFile(resolve(dist, 'index.html'), 'utf8');
function assetPath(url) {
  if (!url || /^(?:https?:|data:|\/\/)/i.test(url)) throw new Error('External build dependency cannot be embedded.');
  const path = resolve(dist, url.replace(/^\.\//, ''));
  if (relative(dist, path).startsWith('..')) throw new Error('Asset path leaves the build folder.');
  return path;
}
for (const match of [...html.matchAll(/<script\b([^>]*?)\bsrc="([^"]+)"([^>]*)>\s*<\/script>/gi)]) {
  let source = await readFile(assetPath(match[2]), 'utf8');
  if (match[2].endsWith('config.js')) source += '\nwindow.__SPACE_CONFIG__.STATIC_EXPORT = true;\nwindow.__SPACE_CONFIG__.PUBLIC_BACKEND_URL = "";\n';
  const module = /\btype="module"/.test(match[1] + match[3]) ? ' type="module"' : '';
  html = html.replace(match[0], () => '<script' + module + '>' + source.replace(/<\/script/gi, '<\\/script') + '</script>');
}
for (const match of [...html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*>/gi)]) {
  const href = match[0].match(/\bhref="([^"]+)"/)?.[1];
  if (!href) throw new Error('Stylesheet has no URL.');
  const source = await readFile(assetPath(href), 'utf8');
  html = html.replace(match[0], () => '<style>' + source.replace(/<\/style/gi, '<\\/style') + '</style>');
}
html = html.replace(/<link\b[^>]*\brel="modulepreload"[^>]*>/gi, '');
const scriptTags = [...html.matchAll(/<script\b([^>]*)>[\s\S]*?<\/script>/gi)];
const shell = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
if (scriptTags.some(match => /\bsrc\s*=/.test(match[1])) || /<link\b[^>]*\brel="stylesheet"/i.test(shell)) throw new Error('The standalone HTML still references a JS or CSS file.');
const assets = await readdir(resolve(dist, 'assets'));
if (assets.filter(name => name.endsWith('.js')).length !== 1) throw new Error('Standalone output requires a single JavaScript bundle.');
await writeFile(output, html);
await writeFile(resolve(dist, '.nojekyll'), '');
console.log(JSON.stringify({ standalone: relative(root, output), bytes: Buffer.byteLength(html), reviewOnly: true }));
