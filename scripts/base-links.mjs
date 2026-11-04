// After a build with BASE_PATH set (a site under a path, like GitHub Pages'
// https://<owner>.github.io/<repo>/): the pages' Markdown links to each other
// with root paths ("/protocol/finality/"). This prefixes every root-relative
// href and src in dist/ that lacks the base. Astro's own links already have it.
//
//   BASE_PATH=/kusdt-docs node scripts/base-links.mjs
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const base = (process.env.BASE_PATH || '').replace(/\/$/, '');
if (!base) {
  console.log('base-links: no BASE_PATH, nothing to do');
  process.exit(0);
}
const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : [path];
});
let pages = 0;
for (const file of walk('dist').filter((f) => f.endsWith('.html'))) {
  const html = readFileSync(file, 'utf8');
  const next = html.replace(/\b(href|src)="\/(?!\/)([^"]*)"/g, (whole, attr, rest) => {
    const url = `/${rest}`;
    return url === base || url.startsWith(`${base}/`) ? whole : `${attr}="${base}${url}"`;
  });
  if (next !== html) {
    writeFileSync(file, next);
    pages += 1;
  }
}
console.log(`base-links: prefixed root links with ${base} in ${pages} pages`);
