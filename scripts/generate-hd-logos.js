const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function generateHdLogos() {
  const masterPath = path.resolve(__dirname, '../Cloud.png');
  const assetsDir = path.resolve(__dirname, '../src/renderer/src/assets');
  const rootDir = path.resolve(__dirname, '..');

  // Master Cloud.png: 2000x2000, content bbox [206, 73, 1810, 1947] (1605 x 1875)
  const iconHeight = 600;
  const iconWidth = Math.round((iconHeight * 1605) / 1875); // ~514px

  const croppedCloudBuf = await sharp(masterPath)
    .extract({ left: 206, top: 73, width: 1605, height: 1875 })
    .resize(iconWidth, iconHeight, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const cloudBase64 = `data:image/png;base64,${croppedCloudBuf.toString('base64')}`;

  const canvasWidth = 2600;
  const canvasHeight = 700;
  const iconX = 30;
  const iconY = Math.round((canvasHeight - iconHeight) / 2); // 50

  const textX = iconX + iconWidth + 25; // x = 569
  const textY = Math.round(canvasHeight / 2 + 155);

  function createSvg(textColor, ideColor) {
    return `
    <svg width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>
          .brand-loud {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            font-weight: 600;
            font-size: 470px;
            letter-spacing: -6px;
            fill: ${textColor};
          }
          .brand-ide {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            font-weight: 300;
            font-size: 470px;
            letter-spacing: 16px;
            fill: ${ideColor};
          }
        </style>
      </defs>
      <image href="${cloudBase64}" x="${iconX}" y="${iconY}" width="${iconWidth}" height="${iconHeight}" />
      <text x="${textX}" y="${textY}">
        <tspan class="brand-loud">loud</tspan>
        <tspan dx="100" class="brand-ide">IDE</tspan>
      </text>
    </svg>
    `;
  }

  const whiteSvg = Buffer.from(createSvg('#FFFFFF', '#E2E8F0'));
  const blackSvg = Buffer.from(createSvg('#0F172A', '#1E293B'));

  const whitePng = await sharp(whiteSvg)
    .trim()
    .extend({ top: 20, bottom: 20, left: 20, right: 20, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ quality: 100, compressionLevel: 9 })
    .toBuffer();

  const blackPng = await sharp(blackSvg)
    .trim()
    .extend({ top: 20, bottom: 20, left: 20, right: 20, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ quality: 100, compressionLevel: 9 })
    .toBuffer();

  fs.writeFileSync(path.join(assetsDir, 'beyaz_cloud_ide.png'), whitePng);
  fs.writeFileSync(path.join(assetsDir, 'siyah_cloud_ide.png'), blackPng);

  fs.writeFileSync(path.join(rootDir, 'beyaz_cloud_ide.png'), whitePng);
  fs.writeFileSync(path.join(rootDir, 'siyah_cloud_ide.png'), blackPng);

  const meta = await sharp(whitePng).metadata();
  console.log(`Updated HD logos: ${meta.width}x${meta.height}`);
}

generateHdLogos().catch((err) => {
  console.error(err);
  process.exit(1);
});
