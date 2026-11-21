export const vnd = n => Math.round(n).toLocaleString('vi-VN') + 'đ';
export const signed = n => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n);
export const short = u => u / 1000 + 'k';
export const dur = ms => {
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60;
  return h + ':' + String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
};
export const CELLS = [1, 2, 3, 4, 5, 6, -1, -2, -3, -4, -5, -6];
export const sv = n => (n > 0 ? '+' : n < 0 ? '−' : '') + vnd(Math.abs(n));
export const num = v => parseInt(String(v || '').replace(/\D/g, ''), 10) || 0;
export const fmt = n => (n ? n.toLocaleString('vi-VN') : '');
export const uid = () => Math.random().toString(36).slice(2, 9);

/** Split `total` by weights, rounded to 1000/500 units (largest remainder). */
export const split = (total, weights) => {
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const u = total % 1000 === 0 ? 1000 : total % 500 === 0 ? 500 : 1;
  const units = total / u;
  const raw = weights.map(w => (units * w) / sum);
  const out = raw.map(Math.floor);
  let rem = units - out.reduce((a, b) => a + b, 0);
  raw
    .map((r, i) => ({ i, f: r - Math.floor(r) }))
    .sort((a, b) => b.f - a.f)
    .forEach(x => { if (rem > 0) { out[x.i]++; rem--; } });
  return out.map(n => n * u);
};
