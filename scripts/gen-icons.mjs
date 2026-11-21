// One-off generator for the PNG icons / OG image (no deps: hand-rolled PNG encoder).
// Run: node scripts/gen-icons.mjs  → writes public/icon-192.png, icon-512.png, apple-touch-icon.png, og.png
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = buf => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

function png(w, h, paint) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) { const [r, g, b] = paint(x + 0.5, y + 0.5); const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const FELT = hex('#0f4d3a'), INK = hex('#13201b'), WHITE = [255, 255, 255], GOLD = hex('#d9a441'), RED = hex('#c8372d'), BLUE = hex('#2f5fb3');
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
// Anti-aliased circle coverage.
const cov = (x, y, cx, cy, r) => Math.max(0, Math.min(1, r - Math.hypot(x - cx, y - cy) + 0.5));
// A ball: body colour + shade crescent + white number disc (number omitted: no font rasteriser).
function ball(base, x, y, cx, cy, r, color) {
  let c = mix(base, color, cov(x, y, cx, cy, r));
  const shade = cov(x, y, cx, cy, r) * (1 - cov(x, y, cx - r * 0.12, cy - r * 0.12, r * 0.92));
  c = mix(c, [0, 0, 0], shade * 0.22);
  c = mix(c, WHITE, cov(x, y, cx, cy, r * 0.48));
  return mix(c, color === INK ? INK : color, cov(x, y, cx, cy, r * 0.16) * (color === INK ? 1 : 0));
}

function icon(size) {
  return png(size, size, (x, y) => ball(FELT, x, y, size / 2, size / 2, size * 0.36, INK));
}

writeFileSync('public/icon-192.png', icon(192));
writeFileSync('public/icon-512.png', icon(512));
writeFileSync('public/apple-touch-icon.png', icon(180));
writeFileSync('public/og.png', png(1200, 630, (x, y) => {
  let c = FELT;
  c = ball(c, x, y, 470, 315, 170, RED);
  c = ball(c, x, y, 650, 315, 170, BLUE);
  c = ball(c, x, y, 830, 315, 170, INK);
  // gold rule along the bottom
  if (y > 590 && y < 600 && x > 80 && x < 1120) c = GOLD;
  return c;
}));
console.log('icons written');
