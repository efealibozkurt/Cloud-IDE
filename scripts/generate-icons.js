const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function generateIcons() {
  const sourcePath = path.resolve(__dirname, '../Cloud.png');
  const resourcesDir = path.resolve(__dirname, '../resources');

  if (!fs.existsSync(resourcesDir)) {
    fs.mkdirSync(resourcesDir, { recursive: true });
  }

  // 1. Generate 512x512 icon.png
  await sharp(sourcePath)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(resourcesDir, 'icon.png'));
  console.log('Created resources/icon.png (512x512)');

  // 2. Generate multi-resolution PNG buffers for ICO
  const sizes = [256, 128, 64, 48, 32, 24, 16];
  const pngBuffers = [];

  for (const size of sizes) {
    const buf = await sharp(sourcePath)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    pngBuffers.push({ size, buffer: buf });
  }

  // 3. Build Windows ICO format
  // ICO header: 6 bytes
  // ICONDIR entries: 16 bytes each
  const count = pngBuffers.length;
  const headerSize = 6 + count * 16;
  let currentOffset = headerSize;

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type 1 = ICO
  header.writeUInt16LE(count, 4); // Number of images

  const entries = [];
  for (const item of pngBuffers) {
    const entry = Buffer.alloc(16);
    // width and height: 0 means 256
    entry.writeUInt8(item.size === 256 ? 0 : item.size, 0); // bWidth
    entry.writeUInt8(item.size === 256 ? 0 : item.size, 1); // bHeight
    entry.writeUInt8(0, 2); // bColorCount
    entry.writeUInt8(0, 3); // bReserved
    entry.writeUInt16LE(1, 4); // wPlanes
    entry.writeUInt16LE(32, 6); // wBitCount
    entry.writeUInt32LE(item.buffer.length, 8); // dwBytesInRes
    entry.writeUInt32LE(currentOffset, 12); // dwImageOffset

    entries.push(entry);
    currentOffset += item.buffer.length;
  }

  const icoBuffer = Buffer.concat([
    header,
    ...entries,
    ...pngBuffers.map((p) => p.buffer)
  ]);

  fs.writeFileSync(path.join(resourcesDir, 'icon.ico'), icoBuffer);
  console.log(`Created resources/icon.ico (${sizes.join(', ')} px frames)`);
}

generateIcons().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
