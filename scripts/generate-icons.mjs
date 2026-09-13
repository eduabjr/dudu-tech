// Gera os ícones do site (favicon + apple-touch-icon) pixel a pixel, sem
// depender de nenhuma lib de imagem (sharp/canvas puxariam binário nativo).
// Mesma técnica usada no projeto registrocivil (scripts/generate-pwa-icons.mjs).
//
// Rode com: node scripts/generate-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const NAVY = [10, 14, 23]; // fundo escuro da marca
const CYAN = [34, 211, 238]; // accent principal

function makeCanvas(size) {
  const pixels = new Uint8Array(size * size * 4);
  return {
    size,
    pixels,
    set(x, y, [r, g, b], a = 255) {
      x = Math.round(x);
      y = Math.round(y);
      if (x < 0 || y < 0 || x >= size || y >= size) return;
      const i = (y * size + x) * 4;
      pixels[i] = r;
      pixels[i + 1] = g;
      pixels[i + 2] = b;
      pixels[i + 3] = a;
    },
  };
}

function fillRect(canvas, x0, y0, w, h, color) {
  const xStart = Math.round(x0);
  const yStart = Math.round(y0);
  const xEnd = Math.round(x0 + w);
  const yEnd = Math.round(y0 + h);
  for (let y = yStart; y < yEnd; y++) {
    for (let x = xStart; x < xEnd; x++) canvas.set(x, y, color);
  }
}

function strokeLine(canvas, x1, y1, x2, y2, width, color) {
  const minX = Math.floor(Math.min(x1, x2) - width);
  const maxX = Math.ceil(Math.max(x1, x2) + width);
  const minY = Math.floor(Math.min(y1, y2) - width);
  const maxY = Math.ceil(Math.max(y1, y2) + width);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      let t = lenSq === 0 ? 0 : ((x - x1) * dx + (y - y1) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const px = x1 + t * dx;
      const py = y1 + t * dy;
      const distSq = (x - px) ** 2 + (y - py) ** 2;
      if (distSq <= (width / 2) ** 2) canvas.set(x, y, color);
    }
  }
}

// Marca: fundo azul-marinho + prompt de terminal "> _" em ciano — motivo
// simples e universal de "código/dev", legível em qualquer tamanho.
function drawIcon(size) {
  const canvas = makeCanvas(size);
  fillRect(canvas, 0, 0, size, size, NAVY);

  const pad = size * 0.24;
  const w = Math.max(3, size * 0.045);

  // ">"
  strokeLine(canvas, pad, pad, pad + size * 0.24, size / 2, w, CYAN);
  strokeLine(canvas, pad + size * 0.24, size / 2, pad, size - pad, w, CYAN);

  // "_"
  fillRect(canvas, pad + size * 0.32, size - pad - w, size * 0.32, w, CYAN);

  return canvas;
}

function crc32(buf) {
  let c;
  const table =
    crc32.table ||
    (crc32.table = (() => {
      const t = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
      }
      return t;
    })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePng(canvas) {
  const { size, pixels } = canvas;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    Buffer.from(pixels.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1);
  }
  const idatData = deflateSync(raw);
  return Buffer.concat([signature, chunk("IHDR", ihdrData), chunk("IDAT", idatData), chunk("IEND", Buffer.alloc(0))]);
}

const outDir = path.join(process.cwd(), "icons");
mkdirSync(outDir, { recursive: true });

for (const { name, size } of [
  { name: "favicon-32.png", size: 32 },
  { name: "favicon-192.png", size: 192 },
  { name: "apple-touch-icon.png", size: 180 },
  { name: "icon-512.png", size: 512 },
]) {
  const png = encodePng(drawIcon(size));
  writeFileSync(path.join(outDir, name), png);
  console.log(`Gerado: icons/${name} (${size}x${size})`);
}
