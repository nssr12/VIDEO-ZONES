// One-off icon generator for VIDEO-ZONES. Built-in zlib only, runs outside the
// extension, ships nothing. Shape: dark rounded square + 3x3 grid, centre cell
// in the project accent (#ff4757) — the 3x3 interaction grid the extension is about.
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

const OUT = process.argv[2];
if (!OUT) { console.error("usage: node make-icons.js <outDir>"); process.exit(1); }

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

function png(n, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(n, 0);
  ihdr.writeUInt32BE(n, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  const raw = Buffer.alloc((n * 4 + 1) * n);
  let o = 0;
  for (let y = 0; y < n; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < n; x++) {
      const i = (y * n + x) * 4;
      raw[o++] = rgba[i]; raw[o++] = rgba[i + 1]; raw[o++] = rgba[i + 2]; raw[o++] = rgba[i + 3];
    }
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

const BG = [26, 31, 43];      // #1a1f2b
const CELL = [231, 233, 238]; // #e7e9ee
const ACCENT = [255, 71, 87]; // #ff4757

// Rounded-rect coverage test: distance past the inner corner centre.
function inRound(lx, ly, w, h, r) {
  const dx = Math.max(r - lx, 0, lx - (w - r));
  const dy = Math.max(r - ly, 0, ly - (h - r));
  return dx * dx + dy * dy <= r * r;
}

function render(n) {
  const S = 8, W = n * S;                 // supersample for antialiasing
  const hi = new Uint8Array(W * W * 4);
  const put = (x, y, c) => {
    const i = (y * W + x) * 4;
    hi[i] = c[0]; hi[i + 1] = c[1]; hi[i + 2] = c[2]; hi[i + 3] = 255;
  };

  const rBg = W * 0.22;
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) if (inRound(x, y, W - 1, W - 1, rBg)) put(x, y, BG);
  }

  const m = W * 0.17;                     // outer margin
  const gap = W * 0.05;                   // gap between cells
  const cell = (W - 2 * m - 2 * gap) / 3;
  const rC = cell * 0.2;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const x0 = m + col * (cell + gap);
      const y0 = m + row * (cell + gap);
      const c = row === 1 && col === 1 ? ACCENT : CELL;
      for (let y = Math.floor(y0); y < Math.ceil(y0 + cell); y++) {
        for (let x = Math.floor(x0); x < Math.ceil(x0 + cell); x++) {
          if (x < 0 || y < 0 || x >= W || y >= W) continue;
          if (inRound(x - x0, y - y0, cell, cell, rC)) put(x, y, c);
        }
      }
    }
  }

  // Box-downsample with premultiplied averaging so edges stay clean.
  const out = Buffer.alloc(n * n * 4);
  const per = S * S;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const i = ((y * S + sy) * W + (x * S + sx)) * 4;
          if (!hi[i + 3]) continue;
          r += hi[i]; g += hi[i + 1]; b += hi[i + 2]; a++;
        }
      }
      const o = (y * n + x) * 4;
      if (a) { out[o] = Math.round(r / a); out[o + 1] = Math.round(g / a); out[o + 2] = Math.round(b / a); }
      out[o + 3] = Math.round((a / per) * 255);
    }
  }
  return out;
}

fs.mkdirSync(OUT, { recursive: true });
for (const n of [16, 32, 48, 128]) {
  const file = path.join(OUT, `icon${n}.png`);
  fs.writeFileSync(file, png(n, render(n)));
  console.log(`${file}  ${fs.statSync(file).size} bytes`);
}
