// Fails if the built site contains a colour outside the Trestly palette
// (src/styles/trestly.css): mint and teal, cool blue, amber and rose. Anything
// below 25 % saturation counts as a neutral. Run after `npm run build`.
//
//   npm run check:colors
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const root = new URL('../dist/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (['.css', '.html', '.svg', '.js'].includes(extname(name))) files.push(path);
  }
})(root);

function hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}

// Saturated enough to read as a colour, and not one of the palette's hues:
// mint and teal (150°–195°), amber (22°–45°), rose (345°–10°), cool blue (195°–235°).
const allowed = (h) => (h >= 150 && h <= 235) || (h >= 22 && h <= 45) || h >= 345 || h <= 10;
const forbidden = ({ h, s }) => s >= 0.25 && !allowed(h);

const found = [];
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g)) {
    let hex = m[1];
    if (hex.length === 3) hex = [...hex].map((c) => c + c).join('');
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const c = hsl(r, g, b);
    if (forbidden(c)) found.push(`${file.slice(root.length)}: #${hex}`);
  }
  for (const m of text.matchAll(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/g)) {
    const c = hsl(Number(m[1]), Number(m[2]), Number(m[3]));
    if (forbidden(c)) found.push(`${file.slice(root.length)}: ${m[0]}`);
  }
  for (const m of text.matchAll(/hsla?\(\s*(-?[\d.]+)(?:deg)?[\s,]+([\d.]+)%/g)) {
    const c = { h: ((Number(m[1]) % 360) + 360) % 360, s: Number(m[2]) / 100 };
    if (forbidden(c)) found.push(`${file.slice(root.length)}: ${m[0]}`);
  }
}

const unique = [...new Set(found)];
if (unique.length) {
  console.error(`Colours outside the palette (${unique.length}):\n` + unique.slice(0, 50).join('\n'));
  process.exit(1);
}
console.log(`Only palette colours in ${files.length} files.`);
