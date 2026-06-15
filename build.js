// ─────────────────────────────────────────────────────────────────────────
//  Desert Peax — מחולל קטלוג יוקרתי (web + PDF)
//  מושך מוצרים חיים מחנות ה-WooCommerce ומייצר קטלוג מינימליסטי-יוקרתי
//  בזהות המותג (שחור / אפור / חול), לכל קהל:
//    catalog-b2c.html / .pdf  — לקוחות פרטיים (מחיר + רכישה באתר)
//    catalog-b2b.html / .pdf  — לקוחות עסקיים (הצעת מחיר לכמויות בוואטסאפ)
//  הרצה:  node build.js        (או לחיצה כפולה על refresh.bat)
// ─────────────────────────────────────────────────────────────────────────
const fs = require('fs');
const https = require('https');

// ── הגדרות שאפשר לשנות ──────────────────────────────────────────────────
const CFG = {
  apiUrl:   'https://desertpeax.co.il/wp-json/wc/store/v1/products?per_page=100',
  site:     'desertpeax.co.il',
  siteUrl:  'https://desertpeax.co.il/',
  brand:    'Desert Peax',
  tagline:  'ציוד קמפינג ושטח · עיצוב נקי, איכות אמיתית',
  logoDark: 'https://desertpeax.co.il/wp-content/uploads/2025/01/Main-Transparent-e1739573611716-1024x370.png', // שחור-אפור על שקוף
  logoWhite:'https://desertpeax.co.il/wp-content/uploads/2026/03/cropped-MainLogo-white-scaled-3-270x270.png', // לוגו לבן לרקע כהה
  whatsapp: '972559620768',          // 055-962-0768 בפורמט בינלאומי
  phoneDisplay: '055-962-0768',
  email:    'contact@desertpeax.co.il',
  catalogB2c: 'https://shlavbitan14-wq.github.io/DeasertPeax-Catalog/catalog-b2c.html',
  catalogB2b: 'https://shlavbitan14-wq.github.io/DeasertPeax-Catalog/catalog-b2b.html',
};

// פלטת המותג הרשמית (גוונים חמים — בלי הנייבי, לפי בקשת בעל העסק)
const C = {
  ink:   '#1A1A1A',   // שחור הלוגו / טקסט
  gray:  '#7C7264',   // טקסט משני חם, קריא
  label: '#A89070',   // תוויות קטנות (sand-dark)
  sand:  '#F0E8DC',   // רקע תמונה / כרטיס (sand-light) — התמונות מתמזגות
  cream: '#F7F4EF',   // רקע העמוד
  card:  '#F0E8DC',   // כרטיס
  line:  '#E2D6BE',   // קו דק
  gold:  '#C9A84C',   // אקסנט זהב (במשורה)
};

// קו ההרים מהלוגו — SVG דקורטיבי
const PEAKS = c => `<svg class="peaks" viewBox="0 0 120 26" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M2 22 L34 8 L46 16 L70 4 L86 14 L118 22" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// ── עזרי טקסט ───────────────────────────────────────────────────────────
const decode = s => (s || '')
  .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#0?39;/g, "'")
  .replace(/&#8211;/g, '–').replace(/&#8217;/g, "'").replace(/&nbsp;/g, ' ')
  .replace(/&gt;/g, '>').replace(/&lt;/g, '<');

const cleanDesc = s => decode((s || '')
  .replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(/[.#][\w-]+\s*\{[^}]*\}/g, '')
  .replace(/[a-z-]+\s*:\s*[^;{}<>]+;/gi, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ').trim());

const escapeHtml = s => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;')
  .replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const snippet = (s, n = 95) => {
  s = cleanDesc(s);
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  return cut.slice(0, cut.lastIndexOf(' ') > 40 ? cut.lastIndexOf(' ') : n).trim() + '…';
};

const shekel = agorot => '₪' + (agorot / 100).toLocaleString('he-IL');

// בוחר וריאנט תמונה במשקל בינוני (~קרוב ל-700px) לקובץ קל ומהיר
function pickImg(p) {
  const im = p.images && p.images[0];
  if (!im) return CFG.logoDark;
  if (im.srcset) {
    const opts = im.srcset.split(',').map(s => s.trim().match(/(\S+)\s+(\d+)w/))
      .filter(Boolean).map(m => ({ url: m[1], w: +m[2] }));
    if (opts.length) {
      const ge = opts.filter(o => o.w >= 600).sort((a, b) => a.w - b.w);
      return (ge[0] || opts.sort((a, b) => b.w - a.w)[0]).url;
    }
  }
  return im.src;
}

// ── שליפה ───────────────────────────────────────────────────────────────
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'DesertPeax-Catalog' } }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

// ── תבנית עמוד ──────────────────────────────────────────────────────────
function pageHtml(mode, products) {
  const isB2B = mode === 'b2b';
  const title = isB2B ? `${CFG.brand} · קטלוג סיטונאי לעסקים` : `${CFG.brand} · קטלוג מוצרים`;
  const kicker = isB2B ? 'קטלוג סיטונאי · לעסקים' : 'קטלוג מוצרים';
  const lead = isB2B
    ? 'הצעות מחיר לכמויות · אספקה לעסקים · מתנות ממותגות לעובדים וללקוחות'
    : 'משלוחים לכל הארץ · רכישה ישירה באתר';

  const cats = [...new Set(products.flatMap(p => p.categories.map(c => decode(c.name))))].sort();

  const cards = products.map(p => {
    const name = decode(p.name);
    const img  = pickImg(p);
    const cat  = p.categories.map(c => decode(c.name)).join(' · ');
    const catKey = p.categories.map(c => decode(c.name)).join(' ');
    const desc = snippet(p.short_description || p.description);
    const price = shekel(p.prices.price);
    const inStock = p.is_in_stock;

    let cta, priceBlock;
    if (isB2B) {
      const msg = encodeURIComponent(`שלום, אשמח להצעת מחיר לכמויות עבור: ${name} (קמעונאי ${price}). כמות: `);
      cta = `<a class="cta" href="https://wa.me/${CFG.whatsapp}?text=${msg}" target="_blank" rel="noopener">בקשת הצעת מחיר <span>›</span></a>`;
      priceBlock = `<div class="price"><span class="plabel">החל מ־</span>${price}<span class="pnote">מחיר קמעונאי · סיטונאי בהצעה</span></div>`;
    } else {
      priceBlock = `<div class="price">${price}</div>`;
      if (inStock) {
        cta = `<a class="cta" href="${p.permalink}" target="_blank" rel="noopener">לרכישה <span>›</span></a>`;
      } else {
        const msg = encodeURIComponent(`שלום, אשמח לעדכון על חזרת המלאי של: ${name}`);
        cta = `<a class="cta cta-soft" href="https://wa.me/${CFG.whatsapp}?text=${msg}" target="_blank" rel="noopener">עדכנו אותי</a>`;
      }
    }
    const badge = (!inStock && !isB2B) ? `<span class="badge">אזל זמנית</span>` : '';

    return `      <article class="item" data-name="${escapeHtml(name.toLowerCase())}" data-cat="${escapeHtml(catKey)}">
        <a class="ph" href="${isB2B ? '#' : p.permalink}"${isB2B ? '' : ' target="_blank" rel="noopener"'}>
          <span class="ph-in"><img src="${img}" alt="${escapeHtml(name)}" loading="lazy"/></span>${badge}
        </a>
        <div class="meta">
          <div class="cat">${escapeHtml(cat)}</div>
          <h3 class="name">${escapeHtml(name)}</h3>
          <p class="desc">${escapeHtml(desc)}</p>
          <div class="foot">${priceBlock}${cta}</div>
        </div>
      </article>`;
  }).join('\n');

  const chips = ['<button class="chip active" data-cat="">הכול</button>']
    .concat(cats.map(c => `<button class="chip" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`))
    .join('');

  const updated = new Date().toLocaleDateString('he-IL', { year: 'numeric', month: 'long', day: 'numeric' });

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${title}</title>
<meta name="description" content="${escapeHtml(lead)}"/>
<link rel="icon" href="${CFG.logoDark}"/>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Assistant:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"/>
<style>
:root{--ink:${C.ink};--gray:${C.gray};--label:${C.label};--sand:${C.sand};--cream:${C.cream};--card:${C.card};--line:${C.line};--gold:${C.gold}}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:var(--cream)}
body{font-family:'Assistant',sans-serif;color:var(--ink);line-height:1.55;-webkit-print-color-adjust:exact;print-color-adjust:exact;-webkit-font-smoothing:antialiased}
a{text-decoration:none;color:inherit}
img{display:block;max-width:100%}
.peaks{width:118px;height:26px;display:block}
.wrap{max-width:1120px;margin:0 auto;padding:0 26px}

/* ── כותרת / שער ── */
.cover{text-align:center;padding:54px 26px 34px}
.cover img.logo{height:64px;width:auto;margin:0 auto 22px}
.cover .peaks{margin:0 auto 20px}
.kicker{font-size:.82rem;font-weight:700;letter-spacing:.32em;color:var(--label);text-transform:uppercase}
.cover h1{font-size:2.2rem;font-weight:800;letter-spacing:-.01em;margin:8px 0 12px}
.cover h1::after{content:"";display:block;width:46px;height:3px;background:var(--gold);margin:14px auto 0;border-radius:2px}
.cover .lead{color:var(--gray);font-size:1rem;font-weight:500}
.rule{height:1px;background:var(--line);max-width:1120px;margin:6px auto 0}

/* ── סינון (לא מודפס) ── */
.tools{display:flex;gap:14px;flex-wrap:wrap;align-items:center;justify-content:center;padding:22px 26px 4px}
.search{position:relative}
.search input{width:230px;padding:9px 38px 9px 14px;border:1px solid var(--line);border-radius:2px;background:#fbf8f1;font-family:inherit;font-size:.92rem;color:var(--ink)}
.search input:focus{outline:none;border-color:var(--ink)}
.search::before{content:"⌕";position:absolute;right:12px;top:50%;transform:translateY(-50%);color:var(--gray);font-size:1.1rem}
.chips{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.chip{background:transparent;border:1px solid var(--line);color:var(--ink);font-family:inherit;font-weight:600;font-size:.85rem;padding:8px 16px;border-radius:2px;cursor:pointer;transition:.15s}
.chip:hover{border-color:var(--ink)}
.chip.active{background:var(--ink);color:var(--cream);border-color:var(--ink)}

/* ── רשת מוצרים ── */
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:34px 26px;padding:34px 0 12px}
.item{display:flex;flex-direction:column}
.ph{position:relative;display:block;background:var(--sand);overflow:hidden}
.ph-in{display:block;position:relative;padding-top:100%}
.ph-in img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:.4s ease}
.item:hover .ph-in img{transform:scale(1.035)}
.badge{position:absolute;top:10px;right:10px;background:var(--ink);color:var(--cream);font-size:.7rem;font-weight:700;letter-spacing:.04em;padding:4px 10px}
.meta{padding-top:14px;display:flex;flex-direction:column;flex:1}
.cat{font-size:.7rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--label)}
.name{font-size:1.08rem;font-weight:700;margin-top:5px;letter-spacing:-.01em}
.desc{font-size:.86rem;color:var(--gray);font-weight:500;margin-top:5px;flex:1}
.foot{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-top:14px;padding-top:13px;border-top:1px solid var(--line)}
.price{font-size:1.18rem;font-weight:800;display:flex;flex-direction:column;line-height:1.18}
.plabel{font-size:.64rem;font-weight:600;color:var(--gray);letter-spacing:.04em}
.pnote{font-size:.62rem;font-weight:600;color:var(--gray);margin-top:2px}
.cta{font-weight:700;font-size:.88rem;color:var(--ink);white-space:nowrap;border-bottom:1.5px solid var(--ink);padding-bottom:2px;transition:.15s}
.cta span{font-weight:700}
.cta:hover{opacity:.6}
.cta-soft{color:var(--gray);border-color:var(--line)}
.empty{grid-column:1/-1;text-align:center;color:var(--gray);padding:50px;font-weight:600}

/* ── פוטר ── */
.foot-band{background:var(--ink);color:var(--cream);margin-top:46px;padding:42px 26px}
.foot-in{max-width:1120px;margin:0 auto;text-align:center}
.foot-in .peaks{margin:0 auto 16px}
.foot-in .fbrand{font-size:1.3rem;font-weight:800;letter-spacing:.02em}
.foot-in .ftag{color:#C8B89A;font-size:.9rem;margin-top:4px}
.foot-links{display:flex;gap:26px;flex-wrap:wrap;justify-content:center;margin-top:20px;font-size:.94rem;font-weight:600}
.foot-links a{border-bottom:1px solid rgba(255,255,255,.35);padding-bottom:2px}
.foot-upd{color:#8e887b;font-size:.78rem;margin-top:22px}

/* ── רספונסיבי (אייפד וטלפון) ── */
@media(max-width:1000px){.grid{grid-template-columns:repeat(3,1fr);gap:30px 22px}}
@media(max-width:720px){.grid{grid-template-columns:repeat(2,1fr);gap:26px 16px}.cover h1{font-size:1.7rem}.cover{padding:38px 22px 26px}}
@media(max-width:430px){.grid{grid-template-columns:repeat(2,1fr);gap:20px 12px}.name{font-size:.96rem}.price{font-size:1.05rem}.cta{font-size:.8rem}}

/* ── הדפסה / PDF ── */
@page{size:A4;margin:14mm 12mm}
@media print{
  .tools{display:none!important}
  .wrap{max-width:none;padding:0}
  .foot-band{margin-top:22px;padding:26px}
  .cover{padding:6px 0 14px}
  .cover img.logo{height:54px}
  .grid{grid-template-columns:repeat(2,1fr);gap:16px 18px;padding:14px 0 0}
  .item{break-inside:avoid;page-break-inside:avoid}
  .item:hover .ph-in img{transform:none}
  .name{font-size:1.12rem}
  a[target]{color:inherit}
  body{background:var(--cream)}
}
</style>
</head>
<body>
<header class="cover">
  <img class="logo" src="${CFG.logoDark}" alt="${CFG.brand}"/>
  ${PEAKS(C.gold)}
  <div class="kicker">${kicker}</div>
  <h1>${isB2B ? 'קטלוג סיטונאי' : 'הקטלוג שלנו'}</h1>
  <div class="lead">${escapeHtml(lead)}</div>
</header>
<div class="rule"></div>

<div class="tools">
  <div class="search"><input type="text" id="q" placeholder="חיפוש מוצר…" autocomplete="off"/></div>
  <div class="chips">${chips}</div>
</div>

<main class="wrap">
  <div class="grid" id="grid">
${cards}
    <div class="empty" id="empty" style="display:none">לא נמצאו מוצרים תואמים</div>
  </div>
</main>

<footer class="foot-band">
  <div class="foot-in">
    ${PEAKS('#C8B89A')}
    <div class="fbrand">${CFG.brand}</div>
    <div class="ftag">${escapeHtml(CFG.tagline)}</div>
    <div class="foot-links">
      <a href="https://wa.me/${CFG.whatsapp}" target="_blank" rel="noopener">וואטסאפ ${CFG.phoneDisplay}</a>
      <a href="tel:${CFG.phoneDisplay}">${CFG.phoneDisplay}</a>
      <a href="mailto:${CFG.email}">${CFG.email}</a>
      <a href="${CFG.siteUrl}" target="_blank" rel="noopener">${CFG.site}</a>
    </div>
    <div class="foot-upd">עודכן ${updated}</div>
  </div>
</footer>

<script>
(function(){
  var grid=document.getElementById('grid'),q=document.getElementById('q'),
      empty=document.getElementById('empty'),items=[].slice.call(grid.querySelectorAll('.item')),
      chips=[].slice.call(document.querySelectorAll('.chip')),cat='';
  function apply(){var t=(q.value||'').trim().toLowerCase(),n=0;
    items.forEach(function(c){var ok=(!t||c.dataset.name.indexOf(t)>-1)&&(!cat||c.dataset.cat.indexOf(cat)>-1);
      c.style.display=ok?'':'none';if(ok)n++;});
    empty.style.display=n?'none':'';}
  q.addEventListener('input',apply);
  chips.forEach(function(ch){ch.addEventListener('click',function(){
    chips.forEach(function(x){x.classList.remove('active')});ch.classList.add('active');cat=ch.dataset.cat;apply();});});
})();
</script>
</body>
</html>`;
}

// ── תבנית מייל (HTML לאימייל — טבלאות + inline, בטוח ל-Gmail/Outlook) ────
const MAIL_COPY = {
  b2c: {
    subject: 'הקמפינג מתחיל כאן 🏕️ קטלוג Desert Peax',
    preheader: 'כיסאות, מזרנים, אוהלים וציוד שטח · משלוח לכל הארץ',
    h1: 'יוצאים לשטח? יש לנו בדיוק מה שצריך',
    intro: 'בחרנו עבורכם ציוד קמפינג שמחזיק שנים, נוח וקומפקטי בעיצוב נקי. כל המוצרים נבדקו בשטח ומגיעים עם אחריות לשנה. הציצו במבחר והזמינו ישירות מהאתר עם משלוח עד הבית.',
    catalogLabel: 'לצפייה בקטלוג המלא',
    catalogUrl: 'catalogB2c',
    btn: 'לרכישה',
    infobar: 'בחרו מוצר והזמינו ישירות מהאתר · משלוח לכל הארץ',
    foot: 'קיבלת מייל זה כי נרשמת לרשימת הלקוחות של Desert Peax.',
  },
  b2b: {
    subject: 'ציוד שטח לעסק שלך - הצעות מחיר לכמויות | Desert Peax',
    preheader: 'ציוד לצוות · מתנות ממותגות ללקוחות ולעובדים · אספקה סדירה',
    h1: 'מציידים עסק, צוות או מבצעים מתנות?',
    intro: 'Desert Peax מספקת ציוד שטח איכותי בכמויות: ציוד לצוותים, מתנות ממותגות וקמפיינים. הסחורה נבדקה בשטח ומגיעה עם אחריות לשנה. בחרו מוצר ושלחו בקשת הצעת מחיר בלחיצה, ונחזור אליכם עם תמחור סיטונאי.',
    catalogLabel: 'לקטלוג הסיטונאי המלא',
    catalogUrl: 'catalogB2b',
    btn: 'בקשת הצעה',
    infobar: 'בחרו מוצרים ושלחו לנו בקשת הצעת מחיר בוואטסאפ',
    foot: 'קיבלת מייל זה כי אתה לקוח עסקי או נציג מטעם עסק שפנה ל-Desert Peax.',
  },
};

function emailHtml(mode, products) {
  const isB2B = mode === 'b2b';
  const t = MAIL_COPY[mode];
  const ink = C.ink, gray = C.gray, label = C.label, cream = C.cream, sand = C.sand, line = C.line, gold = C.gold;
  const cardBg = '#FBF8F1';           // אוף-לבן חם לגוף הכרטיס
  const FONT = "font-family:Arial,'Assistant',sans-serif;";

  // כל המוצרים (קטלוג מלא במייל). B2B כולל הכל; B2C מציג הכל ומסמן אזל.
  const list = products;

  // כרטיס מוצר בודד (inline-block — נערם רספונסיבית 4→2 בזכות min/max-width, בלי תלות במדיה-קוורי)
  const cell = p => {
    const name = decode(p.name);
    const img = pickImg(p);
    const price = shekel(p.prices.price);
    const cat = p.categories.map(c => decode(c.name)).join(' · ');
    const inStock = p.is_in_stock;
    const waQuote = `https://wa.me/${CFG.whatsapp}?text=${encodeURIComponent('שלום, אשמח להצעת מחיר לכמויות עבור: ' + name + ' (קמעונאי ' + price + '). כמות: ')}`;
    const waUpdate = `https://wa.me/${CFG.whatsapp}?text=${encodeURIComponent('שלום, אשמח לעדכון על חזרת המלאי של: ' + name)}`;

    let href, btnLabel, btnStyle;
    if (isB2B) {
      href = waQuote; btnLabel = 'בקשת הצעה';
      btnStyle = `background:${ink};color:${cream};`;
    } else if (inStock) {
      href = p.permalink; btnLabel = 'לרכישה';
      btnStyle = `background:${ink};color:${cream};`;
    } else {
      href = waUpdate; btnLabel = 'עדכנו אותי';
      btnStyle = `background:transparent;color:${gray};border:1px solid ${line};`;
    }

    return `<div class="product-col" style="display:inline-block;vertical-align:top;width:24%;min-width:146px;max-width:172px;padding:6px;box-sizing:border-box;direction:rtl;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate;background:${cardBg};border:1px solid ${line};border-radius:14px;overflow:hidden;">
    <tr><td style="padding:0;background:${sand};">
      <a href="${href}" target="_blank" style="text-decoration:none;display:block;">
        <img src="${img}" width="160" alt="${escapeHtml(name)}" style="display:block;width:100%;height:auto;aspect-ratio:1/1;object-fit:cover;border:0;outline:none;background:${sand};"/>
      </a>
    </td></tr>
    <tr><td style="padding:9px 10px 11px;text-align:right;${FONT}">
      <div style="font-size:10px;line-height:13px;font-weight:bold;letter-spacing:.04em;color:${label};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(cat)}</div>
      <div style="font-size:14px;line-height:17px;font-weight:bold;color:${ink};min-height:34px;max-height:34px;overflow:hidden;margin-top:3px;">${escapeHtml(name)}</div>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin-top:8px;">
        <tr><td align="right" style="${FONT}font-size:16px;line-height:18px;font-weight:bold;color:${ink};white-space:nowrap;">${isB2B ? '<span style="font-size:10px;font-weight:normal;color:' + gray + ';">החל מ-</span> ' : ''}${price}</td></tr>
        <tr><td align="right" style="padding-top:7px;">
          <a href="${href}" target="_blank" style="display:block;${btnStyle}text-decoration:none;${FONT}font-size:12px;line-height:15px;font-weight:bold;text-align:center;border-radius:8px;padding:7px 6px;">${btnLabel}</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</div>`;
  };

  const cards = list.map(cell).join('\n');
  const catUrl = CFG[t.catalogUrl];

  return `<!DOCTYPE html>
<html lang="he" dir="rtl" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<meta http-equiv="X-UA-Compatible" content="IE=edge"/>
<meta name="x-apple-disable-message-reformatting"/>
<title>${escapeHtml(t.subject)}</title>
<style>
  body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
  table,td{mso-table-lspace:0pt;mso-table-rspace:0pt;}
  img{-ms-interpolation-mode:bicubic;}
  @media screen and (max-width:640px){
    .email-shell{width:100%!important;}
    .hero-title{font-size:23px!important;line-height:29px!important;}
    .product-col{width:49%!important;max-width:none!important;}
  }
  @media screen and (min-width:641px){ .product-col{width:24%!important;} }
</style>
</head>
<body dir="rtl" style="margin:0;padding:0;background:${cream};${FONT}color:${ink};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(t.preheader)}</div>
<center style="width:100%;background:${cream};direction:rtl;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background:${cream};">
    <tr><td align="center" style="padding:16px 8px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="680" class="email-shell" style="width:680px;max-width:680px;border-collapse:separate;background:${cream};">

        <!-- כותרת -->
        <tr><td align="center" style="padding:24px 22px 14px;text-align:center;">
          <img src="${CFG.logoDark}" width="190" alt="${CFG.brand}" style="display:block;width:190px;max-width:70%;height:auto;margin:0 auto 12px;border:0;"/>
          <div style="${FONT}font-size:11px;line-height:16px;font-weight:bold;letter-spacing:2px;color:${label};">${isB2B ? 'קטלוג סיטונאי · לעסקים' : 'קטלוג מוצרים'}</div>
          <h1 class="hero-title" style="margin:7px 0 8px;${FONT}font-size:29px;line-height:35px;font-weight:bold;color:${ink};">${escapeHtml(t.h1)}</h1>
          <div style="width:46px;height:3px;background:${gold};margin:0 auto 10px;border-radius:2px;"></div>
          <div style="${FONT}font-size:15px;line-height:22px;font-weight:500;color:${gray};max-width:520px;margin:0 auto;">${escapeHtml(t.intro)}</div>
        </td></tr>

        <!-- שורת מידע -->
        <tr><td align="center" style="padding:4px 18px 8px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate;background:${sand};border:1px solid ${line};border-radius:14px;">
            <tr><td align="center" style="padding:11px 14px;${FONT}font-size:13px;line-height:19px;color:${ink};font-weight:bold;">${escapeHtml(t.infobar)}</td></tr>
          </table>
        </td></tr>

        <!-- מוצרים (כל הקטלוג, 4 בשורה / 2 בנייד) -->
        <tr><td align="center" style="padding:8px 10px 18px;text-align:center;font-size:0;line-height:0;">
${cards}
        </td></tr>

        <!-- כפתור לקטלוג המלא -->
        <tr><td align="center" style="padding:0 18px 18px;">
          <a href="${catUrl}" target="_blank" style="display:inline-block;background:${ink};color:${cream};text-decoration:none;${FONT}font-size:14px;font-weight:bold;border-radius:9px;padding:11px 24px;">${escapeHtml(t.catalogLabel)}  ›</a>
        </td></tr>

        <!-- פוטר -->
        <tr><td align="center" style="padding:0 18px 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate;background:${ink};border-radius:16px;">
            <tr><td align="center" style="padding:20px 16px;${FONT}color:${cream};text-align:center;">
              <div style="font-size:18px;line-height:22px;font-weight:bold;margin-bottom:6px;">${CFG.brand}</div>
              <div style="font-size:13px;line-height:19px;color:#C8B89A;margin-bottom:12px;">ציוד קמפינג ושטח · ${isB2B ? 'פתרונות לעסקים ולכמויות' : 'משלוח לכל הארץ'}</div>
              <a href="https://wa.me/${CFG.whatsapp}" target="_blank" style="display:inline-block;background:${cream};color:${ink};text-decoration:none;font-size:13px;line-height:16px;font-weight:bold;border-radius:9px;padding:10px 14px;margin:3px;">וואטסאפ ${CFG.phoneDisplay}</a>
              <a href="${CFG.siteUrl}" target="_blank" style="display:inline-block;color:${cream};text-decoration:none;font-size:13px;line-height:16px;font-weight:bold;border:1px solid ${gray};border-radius:9px;padding:9px 14px;margin:3px;">לאתר</a>
              <div style="font-size:11px;line-height:16px;color:#8e887b;margin-top:14px;">${escapeHtml(t.foot)}<br/>להסרה מרשימת התפוצה השיבו למייל זה עם "הסר".</div>
            </td></tr>
          </table>
        </td></tr>

      </table>
    </td></tr>
  </table>
</center>
</body>
</html>`;
}

// ── יצירת PDF (אם puppeteer מותקן) ──────────────────────────────────────
// נתיבי Chrome אפשריים במערכת (כדי לא להוריד דפדפן נפרד)
const CHROME_PATHS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
async function makePdf(htmlPath, pdfPath) {
  let puppeteer;
  try { puppeteer = require('puppeteer'); }
  catch { return false; }
  const exe = CHROME_PATHS.find(p => { try { return fs.existsSync(p); } catch { return false; } });
  const udd = require('path').join(require('os').tmpdir(), 'dp-catalog-chrome');
  const opts = { headless: 'new', userDataDir: udd,   // פרופיל מבודד — לא מתנגש ב-Chrome פתוח
    args: ['--no-sandbox', '--disable-gpu'] };
  if (exe) opts.executablePath = exe;          // משתמש ב-Chrome המותקן
  const browser = await puppeteer.launch(opts);
  const page = await browser.newPage();
  const fileUrl = 'file://' + require('path').resolve(htmlPath).replace(/\\/g, '/');
  await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.pdf({ path: pdfPath, format: 'A4', printBackground: true,
    margin: { top: '14mm', bottom: '14mm', left: '12mm', right: '12mm' } });
  await browser.close();
  return true;
}

// ── ריצה ראשית ──────────────────────────────────────────────────────────
(async () => {
  console.log('מושך מוצרים מהאתר…');
  let products;
  try { products = await fetchJson(CFG.apiUrl); }
  catch (e) { console.error('שגיאה במשיכה:', e.message); process.exit(1); }

  const visible = products.filter(p => !p.is_password_protected);
  visible.sort((a, b) => a.is_in_stock === b.is_in_stock ? a.prices.price - b.prices.price : (a.is_in_stock ? -1 : 1));

  fs.writeFileSync('catalog-data.json', JSON.stringify(visible, null, 0));
  for (const mode of ['b2c', 'b2b']) {
    fs.writeFileSync(`catalog-${mode}.html`, pageHtml(mode, visible));
    fs.writeFileSync(`email-${mode}.html`, emailHtml(mode, visible));
    console.log(`✓ catalog-${mode}.html  +  email-${mode}.html`);
  }
  console.log(`נוצרו ${visible.length} מוצרים (מתוך ${products.length}).`);

  console.log('מייצר PDF…');
  let any = false;
  for (const mode of ['b2c', 'b2b']) {
    try {
      const ok = await makePdf(`catalog-${mode}.html`, `catalog-${mode}.pdf`);
      if (ok) { console.log(`✓ catalog-${mode}.pdf`); any = true; }
    } catch (e) { console.error(`PDF ${mode} נכשל:`, e.message); }
  }
  if (!any) console.log('ℹ דילגתי על PDF (puppeteer לא מותקן). הקטלוגים ב-HTML מוכנים. להפקת PDF: npm install puppeteer');
})();
