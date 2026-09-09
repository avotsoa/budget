/**
 * Génère les icônes PNG de la PWA — sans dépendance.
 *
 * Un encodeur PNG minimal suffit ici : l'icône n'est faite que d'aplats
 * rectangulaires (fond arrondi + trois barres évoquant un graphique). Éviter
 * une bibliothèque de rendu d'image pour trois rectangles garde l'outillage
 * léger et reproductible.
 *
 * Usage : node scripts/generate-icons.mjs
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUTPUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

/** Couleurs alignées sur les tokens de thème (voir src/styles/index.css). */
const BRAND = [1, 62, 55]; // --brand clair : #013e37 (Green)
const INK = [255, 239, 179]; // --brand-ink clair : #ffefb3 (Butter)

// --- Encodeur PNG ------------------------------------------------------------

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

/** `pixels` : Buffer RGBA de taille width * height * 4. */
function encodePng(width, height, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // profondeur : 8 bits par canal
  header[9] = 6; // type couleur : RGBA
  // Les octets 10 à 12 restent à zéro : compression, filtre et entrelacement
  // standard, seules valeurs admises par la spécification.

  // Chaque ligne est préfixée par son octet de filtre — 0 = aucun.
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    pixels.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- Dessin ------------------------------------------------------------------

function createCanvas(size) {
  return { size, pixels: Buffer.alloc(size * size * 4) };
}

function setPixel(canvas, x, y, [r, g, b], alpha = 255) {
  if (x < 0 || y < 0 || x >= canvas.size || y >= canvas.size) return;
  const offset = (y * canvas.size + x) * 4;
  canvas.pixels[offset] = r;
  canvas.pixels[offset + 1] = g;
  canvas.pixels[offset + 2] = b;
  canvas.pixels[offset + 3] = alpha;
}

function fillRoundedRect(canvas, x0, y0, width, height, radius, color) {
  for (let y = y0; y < y0 + height; y += 1) {
    for (let x = x0; x < x0 + width; x += 1) {
      // Distance aux quatre centres d'arrondi : hors du rayon, on ne peint pas.
      const dx = Math.max(x0 + radius - x, 0, x - (x0 + width - 1 - radius));
      const dy = Math.max(y0 + radius - y, 0, y - (y0 + height - 1 - radius));
      if (dx * dx + dy * dy <= radius * radius) setPixel(canvas, x, y, color);
    }
  }
}

/**
 * Icône : fond bleu marque, trois barres croissantes en blanc cassé.
 *
 * `padding` élargit la marge pour la variante « maskable », qu'Android rogne
 * en cercle ou en losange selon le lanceur — le motif doit tenir dans la
 * zone de sécurité centrale (80 % du côté).
 */
function drawIcon(size, { padding = 0.08, background = true } = {}) {
  const canvas = createCanvas(size);

  if (background) {
    fillRoundedRect(canvas, 0, 0, size, size, Math.round(size * 0.22), BRAND);
  } else {
    // Variante maskable : fond plein bord à bord, le lanceur découpe lui-même.
    fillRoundedRect(canvas, 0, 0, size, size, 0, BRAND);
  }

  const inset = Math.round(size * padding);
  const usable = size - inset * 2;
  const barWidth = Math.round(usable * 0.18);
  const gap = Math.round((usable - barWidth * 3) / 2);
  const baseline = inset + usable;
  const heights = [0.42, 0.68, 0.95];

  heights.forEach((ratio, index) => {
    const barHeight = Math.round(usable * ratio);
    const x = inset + index * (barWidth + gap);
    fillRoundedRect(
      canvas,
      x,
      baseline - barHeight,
      barWidth,
      barHeight,
      Math.round(barWidth * 0.35),
      INK,
    );
  });

  return encodePng(size, size, canvas.pixels);
}

// --- Écriture ----------------------------------------------------------------

mkdirSync(OUTPUT_DIR, { recursive: true });

const outputs = [
  ['icon-192.png', drawIcon(192, { padding: 0.2 })],
  ['icon-512.png', drawIcon(512, { padding: 0.2 })],
  // Zone de sécurité plus large : Android rogne jusqu'à 20 % de chaque bord.
  ['icon-maskable-512.png', drawIcon(512, { padding: 0.28, background: false })],
  ['apple-touch-icon.png', drawIcon(180, { padding: 0.2 })],
];

for (const [name, data] of outputs) {
  writeFileSync(join(OUTPUT_DIR, name), data);
  console.log(`${name.padEnd(26)} ${(data.length / 1024).toFixed(1)} ko`);
}

console.log(`\n${outputs.length} icônes écrites dans public/icons/`);
