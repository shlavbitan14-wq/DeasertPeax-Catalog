// Desert Peax — סאונד דיזיין סינתטי לסרטון (רוח, BOOM, ביט, וושים). בלי תלויות.
// node promo-video/sound.js  → promo-video/soundtrack.wav
// הזמנים תואמים ל-promo-config.json (הביט על גריד של 0.4 שניות מ-5.0).
const fs = require('fs');
const path = require('path');

const SR = 44100, DUR = 25;
const N = SR * DUR;
const L = new Float32Array(N), R = new Float32Array(N);

let seed = 7;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const add = (i, v, pan = 0) => { if (i >= 0 && i < N) { L[i] += v * (1 - pan) ; R[i] += v * (1 + pan); } };

// ── רוח מדברית: רעש חום מסונן עם משבים ──
function wind(t0, t1, gain) {
  let b = 0, lp = 0;
  for (let i = t0 * SR; i < t1 * SR; i++) {
    const t = i / SR;
    b = (b + 0.02 * rnd()) / 1.02;
    const gust = 0.55 + 0.45 * Math.sin(t * 1.7) * Math.sin(t * 0.63 + 1);
    lp += 0.08 * (b - lp);
    const env = Math.min(1, (t - t0) / 0.6, (t1 - t) / 0.8);
    add(i | 0, lp * 9 * gust * env * gain, 0.3 * Math.sin(t * 0.9));
  }
}

// ── BOOM: סאב יורד + רעש נמוך ──
function boom(t0, gain = 1, len = 2.2) {
  let lp = 0;
  for (let k = 0; k < len * SR; k++) {
    const t = k / SR;
    const f = 38 + 60 * Math.exp(-t * 9);
    const env = Math.exp(-t * 2.1) * Math.min(1, t * 400);
    lp += 0.02 * (rnd() - lp);
    add(t0 * SR + k | 0, gain * env * (0.9 * Math.sin(2 * Math.PI * f * t) + lp * 1.2));
  }
}

// ── קיק ──
function kick(t0, gain = 0.8) {
  let ph = 0;
  for (let k = 0; k < 0.45 * SR; k++) {
    const t = k / SR;
    ph += 2 * Math.PI * (48 + 110 * Math.exp(-t * 30)) / SR;
    add(t0 * SR + k | 0, gain * Math.sin(ph) * Math.exp(-t * 7) * Math.min(1, t * 2000));
  }
}

// ── היט חזק (קאט): קיק + קלאפ ──
function hit(t0, gain = 1) {
  kick(t0, gain);
  let hp = 0, prev = 0;
  for (let k = 0; k < 0.25 * SR; k++) {
    const t = k / SR, n = rnd();
    hp = 0.9 * (hp + n - prev); prev = n;
    add(t0 * SR + k | 0, gain * 0.35 * hp * Math.exp(-t * 22), rnd() * 0.2);
  }
}

// ── היי-האט ──
function hat(t0, gain = 0.12) {
  let hp = 0, prev = 0;
  for (let k = 0; k < 0.06 * SR; k++) {
    const t = k / SR, n = rnd();
    hp = 0.6 * (hp + n - prev); prev = n;
    add(t0 * SR + k | 0, gain * hp * Math.exp(-t * 70), 0.25);
  }
}

// ── ווש: רעש בפס עולה-יורד, נע בין הערוצים ──
function whoosh(t0, len = 0.6, gain = 0.5, dir = 1) {
  let a = 0, b = 0;
  for (let k = 0; k < len * SR; k++) {
    const x = k / (len * SR);
    const env = Math.sin(Math.PI * x) ** 2;
    const c = 0.02 + 0.2 * env;
    a += c * (rnd() - a); b += c * (a - b);
    add(t0 * SR + k | 0, gain * (a - b) * 6 * env, dir * (x * 2 - 1) * 0.8);
  }
}

// ── פד מוזיקלי: אקורדים רכים Am–F–C–G ──
function pad(t0, t1, gain) {
  const chords = [[110, 164.81, 220, 261.63], [87.31, 174.61, 220, 261.63], [130.81, 196, 261.63, 329.63], [98, 196, 246.94, 293.66]];
  const step = 3.2;
  for (let i = t0 * SR; i < t1 * SR; i++) {
    const t = i / SR, rel = t - t0;
    const ci = Math.floor(rel / step) % 4, x = (rel % step) / step;
    const env = Math.min(1, rel / 1.5, (t1 - t) / 0.5) * (0.7 + 0.3 * Math.sin(Math.PI * x));
    let v = 0;
    for (const f of chords[ci]) v += Math.sin(2 * Math.PI * f * t) + 0.4 * Math.sin(2 * Math.PI * f * 1.003 * t);
    add(i | 0, gain * env * v / 6, 0.2 * Math.sin(t * 0.5));
  }
}

// ── ריזר: טון עולה + רעש ──
function riser(t0, len, gain) {
  let ph = 0, a = 0;
  for (let k = 0; k < len * SR; k++) {
    const x = k / (len * SR);
    ph += 2 * Math.PI * (200 + 900 * x * x) / SR;
    a += 0.1 * (rnd() - a);
    add(t0 * SR + k | 0, gain * x * x * (0.3 * Math.sin(ph) + a * 1.5));
  }
}

// ═══ ציר הזמן ═══
wind(0, 3.2, 0.5);           // HOOK
wind(3, 25, 0.12);           // רוח רקע עדינה לכל אורך הסרטון
boom(1.0, 0.9);              // "כדי לצאת לשטח."
whoosh(1.75, 0.55, 0.45);    // מסכת חול → מותג
boom(2.95, 0.45, 1.4);       // לוגו
pad(2.0, 21.6, 0.09);
whoosh(4.7, 0.6, 0.55, -1);  // Foreground wipe
for (let t = 5.0; t < 14.0 - 1e-6; t += 0.8) kick(t, 0.55);
for (let t = 5.4; t < 14.0 - 1e-6; t += 0.8) hat(t, 0.07);
hit(8.0, 0.7);               // match cut לרביעייה
whoosh(10.55, 0.5, 0.5);     // כניסה לתוך האוהל
riser(12.9, 1.1, 0.12);      // לקראת Exposure reveal
boom(14.05, 0.5, 1.6);
for (let t = 14.4; t < 17.0 - 1e-6; t += 0.4) kick(t, 0.6);
for (let t = 14.6; t < 17.0 - 1e-6; t += 0.4) hat(t, 0.1);
[17.0, 17.8, 18.6].forEach(t => hit(t, 1));   // חזק. עמיד. מוכן לשטח.
[17.4, 18.2, 19.0].forEach(t => hat(t, 0.14));
for (let t = 19.4; t < 21.6 - 1e-6; t += 0.4) { kick(t, 0.75); hat(t + 0.2, 0.13); }
riser(20.4, 1.3, 0.16);
whoosh(21.5, 0.7, 0.6);      // עלייה לשמיים
boom(22.75, 1.1, 2.3);       // חשיפת הלוגו
hat(24.35, 0.08);            // תזוזת ה-CTA

// ── נרמול ושמירה ──
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const g = 0.89 / peak;
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8);
buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  const fade = Math.min(1, (N - i) / (SR * 0.4));
  buf.writeInt16LE(Math.round(Math.tanh(L[i] * g) * 32767 * fade), 44 + i * 4);
  buf.writeInt16LE(Math.round(Math.tanh(R[i] * g) * 32767 * fade), 46 + i * 4);
}
const out = path.join(__dirname, 'soundtrack.wav');
fs.writeFileSync(out, buf);
console.log('✓', out);
