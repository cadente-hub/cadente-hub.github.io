#!/usr/bin/env node
// Writes the site's brand files from Cadu's sprite sheet (js/cadu.sprites.json) in the site palette (js/cadu-colors.mjs):
// - assets/logo-symbol.svg: the resting frame, used by the blog;
// - the inline logo in the navigation and footer of every page;
// - assets/favicon-32.png, assets/favicon.ico (16, 32, 48) and assets/apple-touch-icon.png (180, on black);
// - public/assets/og-image.png: 1200×630 share card, Cadu on black with a soft purple halo.
// Usage: node scripts/brand-assets.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { COLORS } from '../js/cadu-colors.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sheet = JSON.parse(fs.readFileSync(path.join(root, 'js/cadu.sprites.json'), 'utf8'));
const rest = sheet.frames.rest;
const colorAt = (x, y) => (rest[y]?.[x] && rest[y][x] !== '.' ? COLORS[sheet.palette[rest[y][x]]] : null);

// SVG: one rect per pixel run, no anti-aliasing.
const rects = [];
rest.forEach((row, y) => {
  for (let x = 0; x < 16; x++) {
    if (row[x] === '.') continue;
    let end = x;
    while (row[end + 1] === row[x]) end++;
    rects.push(`<rect x="${x}" y="${y}" width="${end - x + 1}" height="1" fill="${colorAt(x, y)}"/>`);
    x = end;
  }
});
const body = rects.join('');
fs.writeFileSync(path.join(root, 'assets/logo-symbol.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges"><title>Cadente</title>${body}</svg>\n`);

// The pages draw the same mark inline from assets/logo-symbol.svg (scripts/i18n/pages.mjs, {{@brand}}).

// PNG encoder: RGBA, no filter, one IDAT.
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = buf => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4), all = Buffer.concat([Buffer.from(type), data]), sum = Buffer.alloc(4); len.writeUInt32BE(data.length); sum.writeUInt32BE(crc(all)); return Buffer.concat([len, all, sum]); };
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
function png(W, H, pixel) {
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) raw.set(pixel(x, y), y * (W * 4 + 1) + 1 + x * 4);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
// Cadu at `cell` pixels per sprite pixel, centred, over a background function.
const cadu = (W, H, cell, bg) => png(W, H, (x, y) => {
  const ox = Math.floor((W - 16 * cell) / 2), oy = Math.floor((H - 16 * cell) / 2);
  const c = colorAt(Math.floor((x - ox) / cell), Math.floor((y - oy) / cell));
  return x >= ox && y >= oy && c ? [...hex(c), 255] : bg(x, y);
});
const clear = () => [0, 0, 0, 0];
const black = () => [0, 0, 0, 255];

fs.writeFileSync(path.join(root, 'assets/favicon-32.png'), cadu(32, 32, 2, clear));
fs.writeFileSync(path.join(root, 'assets/apple-touch-icon.png'), cadu(180, 180, 10, black));
const icons = [[16, 1], [32, 2], [48, 3]].map(([s, c]) => [s, cadu(s, s, c, clear)]);
const head = Buffer.alloc(6 + 16 * icons.length);
head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(icons.length, 4);
let offset = head.length;
icons.forEach(([s, data], i) => {
  const e = 6 + 16 * i;
  head.writeUInt8(s, e); head.writeUInt8(s, e + 1); head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
  head.writeUInt32LE(data.length, e + 8); head.writeUInt32LE(offset, e + 12);
  offset += data.length;
});
fs.writeFileSync(path.join(root, 'assets/favicon.ico'), Buffer.concat([head, ...icons.map(([, d]) => d)]));

const glow = hex(COLORS.body);
// The share card is linked by absolute URL from the meta tags, so it ships from public/ as is.
fs.mkdirSync(path.join(root, 'public/assets'), { recursive: true });
fs.writeFileSync(path.join(root, 'public/assets/og-image.png'), cadu(1200, 630, 24, (x, y) => {
  const dx = (x - 600) / 150, dy = (y - 315) / 150, k = 0.32 * Math.exp(-(dx * dx + dy * dy) / 2);
  return [...glow.map(c => Math.round(c * k)), 255];
}));
console.log('wrote logo-symbol.svg, inline logos, favicons and og-image.png');
