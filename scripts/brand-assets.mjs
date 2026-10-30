#!/usr/bin/env node
// Writes the site's brand files from Cadu's sprite sheet (js/cadu.sprites.json), so the logo is the app icon:
// - assets/logo-symbol.svg: the resting frame, used by the blog and as the SVG logo;
// - assets/og-image.png: 1200×630 share card, Cadu on black with a soft gold halo.
// The favicons come from the app's own icon files (crates/app/assets/icons), copied as they are.
// Usage: node scripts/brand-assets.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sheet = JSON.parse(fs.readFileSync(path.join(root, 'js/cadu.sprites.json'), 'utf8'));
const COLORS = { body: '#f6c343', light: '#fbe48d', shade: '#df8623', deep: '#a04f27', glow: '#fff9e2', ink: '#291508', blush: '#f68678', spark: '#fbe48d', dust: '#a855f7', alert: '#ff8272' };
const rest = sheet.frames.rest;

// SVG: one rect per pixel run, no anti-aliasing.
const rects = [];
rest.forEach((row, y) => {
  for (let x = 0; x < 16; x++) {
    const ch = row[x];
    if (ch === '.') continue;
    let end = x;
    while (row[end + 1] === ch) end++;
    rects.push(`<rect x="${x}" y="${y}" width="${end - x + 1}" height="1" fill="${COLORS[sheet.palette[ch]]}"/>`);
    x = end;
  }
});
fs.writeFileSync(path.join(root, 'assets/logo-symbol.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges"><title>Cadente</title>${rects.join('')}</svg>\n`);

// PNG: Cadu at 24 px per cell on black, with a gold halo behind it.
const W = 1200, H = 630, cell = 24, ox = (W - 16 * cell) / 2, oy = (H - 16 * cell) / 2;
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const gold = hex(COLORS.body);
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) {
  raw[y * (W * 4 + 1)] = 0;
  for (let x = 0; x < W; x++) {
    const dx = (x - W / 2) / 150, dy = (y - H / 2) / 150, halo = 0.38 * Math.exp(-(dx * dx + dy * dy) / 2);
    let px = gold.map(c => Math.round(c * halo));
    const cx = Math.floor((x - ox) / cell), cy = Math.floor((y - oy) / cell);
    if (cx >= 0 && cx < 16 && cy >= 0 && cy < 16 && rest[cy][cx] !== '.') px = hex(COLORS[sheet.palette[rest[cy][cx]]]);
    raw.set([...px, 255], y * (W * 4 + 1) + 1 + x * 4);
  }
}
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = buf => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4), body = Buffer.concat([Buffer.from(type), data]), sum = Buffer.alloc(4); len.writeUInt32BE(data.length); sum.writeUInt32BE(crc(body)); return Buffer.concat([len, body, sum]); };
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr.set([8, 6, 0, 0, 0], 8);
fs.writeFileSync(path.join(root, 'assets/og-image.png'), Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
console.log('wrote assets/logo-symbol.svg and assets/og-image.png');
