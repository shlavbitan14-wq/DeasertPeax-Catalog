// Desert Peax — רינדור סרטון הפרסומת
// שימוש:  node promo-video/render.js            → promo-video/desertpeax-promo.mp4
//         node promo-video/render.js --frame 5  → תמונת בדיקה של שנייה 5 (promo-video/frame.png)
// הטקסטים, התמונות והזמנים נמצאים ב-promo-video/promo-config.json
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer');
const ffmpegPath = require('ffmpeg-static');

const DIR = __dirname;
const cfg = JSON.parse(fs.readFileSync(path.join(DIR, 'promo-config.json'), 'utf8'));
const OUT = path.join(DIR, 'desertpeax-promo.mp4');
const frameArg = process.argv.indexOf('--frame');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--allow-file-access-from-files', '--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: cfg.width, height: cfg.height, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(DIR, 'promo.html') + '?render=1', { waitUntil: 'load' });

  const total = await page.evaluate(c => PROMO.build(c), cfg);
  // מחכים שהפונטים וכל תמונות הרקע ייטענו לפני הצילום
  await page.evaluate(async () => {
    await document.fonts.load('800 100px Assistant', 'אבג');
    await document.fonts.ready;
    const urls = [...document.querySelectorAll('.bg')].map(b => b.style.backgroundImage.slice(5, -2));
    await Promise.all(urls.map(u => new Promise(res => { const i = new Image(); i.onload = i.onerror = res; i.src = u; })));
  });

  if (frameArg > -1) {
    const t = parseFloat(process.argv[frameArg + 1] || '0');
    await page.evaluate(t => PROMO.seek(t), t);
    const file = path.join(DIR, 'frame.png');
    await page.screenshot({ path: file });
    console.log('✓', file);
    await browser.close();
    return;
  }

  const frames = Math.round(total * cfg.fps);
  console.log(`מרנדר ${frames} פריימים (${total.toFixed(1)} שניות)...`);
  const ff = spawn(ffmpegPath, [
    '-y', '-f', 'image2pipe', '-framerate', String(cfg.fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    OUT,
  ], { stdio: ['pipe', 'ignore', 'inherit'] });

  for (let f = 0; f < frames; f++) {
    await page.evaluate(t => PROMO.seek(t), f / cfg.fps);
    const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % cfg.fps === 0) process.stdout.write(`\r${Math.round((f / frames) * 100)}%`);
  }
  ff.stdin.end();
  await new Promise((res, rej) => ff.on('close', code => (code ? rej(new Error('ffmpeg ' + code)) : res())));
  await browser.close();
  console.log(`\r✓ ${OUT}`);
})().catch(e => { console.error(e); process.exit(1); });
