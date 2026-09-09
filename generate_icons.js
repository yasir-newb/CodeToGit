const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ (-1)) >>> 0;
}

function createChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const toCrc = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(toCrc), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function generatePng(size) {
  const width = size;
  const height = size;
  const scanlines = [];

  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 4);
    row[0] = 0; // No filter
    for (let x = 0; x < width; x++) {
      const idx = 1 + x * 4;
      // Rounded corner calculation
      const r = size * 0.22;
      const dx = Math.min(x, width - 1 - x);
      const dy = Math.min(y, height - 1 - y);
      let inside = true;
      if (dx < r && dy < r) {
        const dist = Math.hypot(r - dx, r - dy);
        if (dist > r) inside = false;
      }

      if (!inside) {
        row[idx] = 0;
        row[idx + 1] = 0;
        row[idx + 2] = 0;
        row[idx + 3] = 0;
        continue;
      }

      // Gradient from Indigo (#4F46E5) to Cyan (#06B6D4)
      const t = (x + y) / (width + height);
      let red = Math.round(79 + (6 - 79) * t);
      let green = Math.round(70 + (182 - 70) * t);
      let blue = Math.round(229 + (212 - 229) * t);

      // Draw T-bar
      const txStart = Math.round(width * 0.25);
      const txEnd = Math.round(width * 0.75);
      const tyTop = Math.round(height * 0.26);
      const tThick = Math.max(2, Math.round(width * 0.1));
      const stemXMid = Math.round(width * 0.5);

      const inTopBar = y >= tyTop && y < tyTop + tThick && x >= txStart && x <= txEnd;
      const inStem = y >= tyTop && y <= Math.round(height * 0.76) && Math.abs(x - stemXMid) <= Math.floor(tThick / 2);

      if (inTopBar || inStem) {
        red = 255;
        green = 255;
        blue = 255;
      }

      row[idx] = red;
      row[idx + 1] = green;
      row[idx + 2] = blue;
      row[idx + 3] = 255;
    }
    scanlines.push(row);
  }

  const rawData = Buffer.concat(scanlines);
  const compressedData = zlib.deflateSync(rawData);

  // PNG Signature
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = createChunk('IHDR', ihdr);
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

const iconsDir = path.join(__dirname, 'extension', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

[16, 48, 128].forEach(size => {
  const png = generatePng(size);
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), png);
  console.log(`Generated icon${size}.png (${png.length} bytes)`);
});
