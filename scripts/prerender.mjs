// Post-build: inject prerendered home-screen HTML, inline the CSS, add absolute SEO URLs.
// Set SITE_URL (e.g. SITE_URL=https://bida.vn npm run build) to emit canonical / og:url / sitemap.
import { readFileSync, writeFileSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const ssrDir = join(root, 'dist-ssr');
const ssrFile = readdirSync(ssrDir).find(f => /^entry-server\.m?js$/.test(f));
const { prerender } = await import(pathToFileURL(join(ssrDir, ssrFile)).href);

let html = readFileSync(join(dist, 'index.html'), 'utf8');
html = html.replace('<!--app-->', prerender());

// Inline the single (small) stylesheet so first paint needs no extra round trip.
html = html.replace(/<link rel="stylesheet"[^>]*href="\/(assets\/[^"]+\.css)"[^>]*>/, (_, href) => {
  const css = readFileSync(join(dist, href), 'utf8');
  rmSync(join(dist, href));
  return `<style>${css}</style>`;
});

// Preload the two woff2 files the first paint actually uses (latin body + heading).
const fonts = readdirSync(join(dist, 'assets')).filter(f =>
  /^(be-vietnam-pro-latin-400-normal|fraunces-latin-800-normal)-.*\.woff2$/.test(f));
html = html.replace('</title>', '</title>\n' + fonts.map(f => `<link rel="preload" href="/assets/${f}" as="font" type="font/woff2" crossorigin>`).join('\n'));

const site = (process.env.SITE_URL || '').replace(/\/$/, '');
if (site) {
  html = html.replace('<!--seo-url-->', [
    `<link rel="canonical" href="${site}/">`,
    `<meta property="og:url" content="${site}/">`,
    `<meta property="og:image" content="${site}/og.png">`,
    `<meta name="twitter:image" content="${site}/og.png">`,
  ].join('\n'));
  writeFileSync(join(dist, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${site}/</loc><changefreq>monthly</changefreq><priority>1.0</priority></url>\n</urlset>\n`);
  writeFileSync(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n`);
} else {
  html = html.replace('<!--seo-url-->', '<meta property="og:image" content="/og.png">');
  console.warn('[prerender] SITE_URL not set: canonical, og:url and sitemap.xml were skipped.');
}

writeFileSync(join(dist, 'index.html'), html);

// Service worker: precache the built shell so the app works offline in the bida hall.
const assets = readdirSync(join(dist, 'assets')).filter(f => !f.endsWith('.woff')).map(f => `/assets/${f}`);
const version = Date.now().toString(36);
const sw = readFileSync(join(root, 'scripts', 'sw.template.js'), 'utf8')
  .replace('__VERSION__', version)
  .replace('__PRECACHE__', JSON.stringify(['/', '/manifest.webmanifest', '/favicon.svg', ...assets]));
writeFileSync(join(dist, 'sw.js'), sw);

if (existsSync(ssrDir)) rmSync(ssrDir, { recursive: true, force: true });
console.log(`[prerender] done · ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB index.html · ${assets.length} precached assets`);
