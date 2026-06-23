import { Jimp } from 'jimp';
import fs from 'fs';
import path from 'path';

async function run() {
  const sourcePath = path.resolve('src/assets/images/mcq_hero_logo_1782242825762.jpg');
  console.log('Reading source image from:', sourcePath);
  
  if (!fs.existsSync(sourcePath)) {
    console.error('Source image does not exist!');
    process.exit(1);
  }

  const sourceImg = await Jimp.read(sourcePath);
  console.log('Successfully loaded source image. Dimensions:', sourceImg.width, 'x', sourceImg.height);

  // 1. Generate Web public icons
  const publicDir = path.resolve('public');
  if (!fs.existsSync(publicDir)) {
    console.log('Creating public directory:', publicDir);
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // Web Logo (512x512)
  console.log('Generating public/logo.png...');
  const webLogo = sourceImg.clone().resize({ w: 512, h: 512 });
  await webLogo.write(path.join(publicDir, 'logo.png'));

  // Web Favicon (48x48)
  console.log('Generating public/favicon.png...');
  const webFavicon = sourceImg.clone().resize({ w: 48, h: 48 });
  const faviconPngPath = path.join(publicDir, 'favicon.png');
  await webFavicon.write(faviconPngPath);

  // Also write a copy to public/favicon.ico just in case (using fs copy to avoid Jimp file extension error)
  fs.copyFileSync(faviconPngPath, path.join(publicDir, 'favicon.ico'));

  console.log('Web public icons generated successfully!');

  // 2. Generate Android Mipmap Icons
  const androidResDir = path.resolve('android/app/src/main/res');
  if (!fs.existsSync(androidResDir)) {
    console.warn('Android resources directory not found. Skipping Android launcher icon generation.', androidResDir);
    return;
  }

  const mipmaps = [
    { folder: 'mipmap-mdpi', size: 48, fgSize: 108 },
    { folder: 'mipmap-hdpi', size: 72, fgSize: 162 },
    { folder: 'mipmap-xhdpi', size: 96, fgSize: 216 },
    { folder: 'mipmap-xxhdpi', size: 144, fgSize: 324 },
    { folder: 'mipmap-xxxhdpi', size: 192, fgSize: 432 }
  ];

  for (const m of mipmaps) {
    const dirPath = path.join(androidResDir, m.folder);
    if (!fs.existsSync(dirPath)) {
      console.log(`Creating mipmap directory: ${dirPath}`);
      fs.mkdirSync(dirPath, { recursive: true });
    }

    // A. Legacy ic_launcher.png
    console.log(`Generating legacy launcher icon for ${m.folder} (${m.size}x${m.size})...`);
    const icLauncher = sourceImg.clone().resize({ w: m.size, h: m.size });
    await icLauncher.write(path.join(dirPath, 'ic_launcher.png'));

    // B. Round ic_launcher_round.png
    console.log(`Generating round launcher icon for ${m.folder} (${m.size}x${m.size})...`);
    const icLauncherRound = sourceImg.clone().resize({ w: m.size, h: m.size });
    await icLauncherRound.write(path.join(dirPath, 'ic_launcher_round.png'));

    // C. Adaptive foreground ic_launcher_foreground.png
    console.log(`Generating adaptive foreground launcher icon for ${m.folder} (${m.fgSize}x${m.fgSize})...`);
    const fgCanvas = new Jimp({ width: m.fgSize, height: m.fgSize, color: 0x00000000 });
    // Inside 108dp, the safe area is 72dp. So the logo should occupy around 66% (or 70%) of the foreground image.
    const logoSize = Math.floor(m.fgSize * 0.70);
    const offset = Math.floor((m.fgSize - logoSize) / 2);
    
    const resizedLogo = sourceImg.clone().resize({ w: logoSize, h: logoSize });
    fgCanvas.composite(resizedLogo, offset, offset);
    await fgCanvas.write(path.join(dirPath, 'ic_launcher_foreground.png'));
  }

  console.log('🎉 All Web and Android launcher icons have been generated successfully from the MCQ Hero source image!');
}

run().catch(err => {
  console.error('Fatal error during execution:', err);
  process.exit(1);
});
