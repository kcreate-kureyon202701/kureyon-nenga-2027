// 共通の部品（ふだんは触らなくてOK）

// 入力画面の「確認する」から開いたときは、保存前の内容で表示する
var IS_PREVIEW = /[?&]preview=1/.test(location.search);
if (IS_PREVIEW) {
  try {
    var draft = JSON.parse(localStorage.getItem('nenga-preview') || 'null');
    if (draft) { window.SITE = draft.site; window.COMPANIES = draft.companies; }
  } catch (e) {}
  document.addEventListener('DOMContentLoaded', function () {
    var bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:100;background:#1F2937;color:#fff;text-align:center;font-size:13px;padding:8px 12px;font-weight:700';
    bar.textContent = '👀 確認用の表示です（まだ保存されていません）。確認が終わったらこのタブを閉じて、入力画面で「保存する」を押してください。';
    document.body.appendChild(bar);
  });
}
// 確認用表示のときはリンク先も確認用のままにする
function pv() { return IS_PREVIEW ? '&preview=1' : ''; }

// ===== Googleスプレッドシートから内容を読む =====
// sheet-config.js に スプレッドシートのID と タブ名 が入っていれば、そこから読む。
// 読めないとき（IDが空・ネットがない など）は data.js の内容で表示する。
function parseCSV(text) {
  var rows = [], row = [], f = '', q = false;
  for (var i = 0; i < text.length; i++) {
    var ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(f); f = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(f); rows.push(row); row = []; f = '';
    } else f += ch;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows;
}
// Googleドライブの共有リンク → 画像として表示できるURL
function photoUrl(v) {
  v = String(v || '').trim();
  var m = /drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=|thumbnail\?id=)([\w-]{10,})/.exec(v) || /docs\.google\.com\/uc\?.*id=([\w-]{10,})/.exec(v);
  if (m) return 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w1600';
  return v;
}
function sheetCsvUrl(cfg, tab) {
  if (cfg.csv && cfg.csv[tab]) return cfg.csv[tab]; // テスト用
  return 'https://docs.google.com/spreadsheets/d/' + encodeURIComponent(cfg.id) + '/gviz/tq?tqx=out:csv&headers=0&sheet=' + encodeURIComponent(tab) + '&t=' + Date.now();
}
function rowsToCompanies(rows) {
  var by = {};
  rows.forEach(function (r) { if (r[0]) by[r[0].trim()] = r; });
  var width = rows.reduce(function (m, r) { return Math.max(m, r.length); }, 0), list = [];
  function v(key, col) { var r = by[key]; return r && r[col] != null ? String(r[col]).trim() : ''; }
  function pairs(prefix, col) {
    return Object.keys(by).filter(function (k) { return k.indexOf(prefix) === 0; })
      .map(function (k) { return [k.slice(prefix.length), v(k, col)]; })
      .filter(function (p) { return p[1]; });
  }
  for (var col = 3; col < width; col++) {
    var name = v('companyName', col), show = v('show', col);
    if (!name || show === '×' || show === 'x' || show === 'X') continue;
    var news = [];
    for (var n = 1; n <= 3; n++) {
      var nt = v('news' + n + 'Title', col), nx = v('news' + n + 'Text', col);
      if (nt || nx) news.push({ title: nt, text: nx });
    }
    var overview = pairs('ov:', col);
    overview.unshift([/店|食堂|カフェ|喫茶/.test(v('category', col)) ? '店名' : '会社名', name]);
    list.push({
      id: list.length + 1, category: v('category', col), companyName: name,
      photo: photoUrl(v('photo', col)), staffPhoto: photoUrl(v('staffPhoto', col)),
      staffRole: v('staffRole', col), staffName: v('staffName', col),
      catchphrase: v('catchphrase', col), message: v('message', col), news: news,
      extraType: v('extraType', col) === 'フリースペース' ? 'free' : 'recruit',
      recruit: pairs('rec:', col), freeTitle: v('freeTitle', col), freeText: v('freeText', col),
      overview: overview, url: v('url', col), instagram: v('instagram', col), recruitUrl: v('recruitUrl', col), tel: v('tel', col)
    });
  }
  return list;
}
function rowsToSite(rows, edition) {
  var head = rows[1] || [], col = head.indexOf(edition), site = {};
  if (col < 0) return null;
  rows.slice(2).forEach(function (r) { if (r[0] && r[col]) site[r[0].trim()] = String(r[col]).trim(); });
  return site;
}
var DATA_SOURCE = 'data.js';
// 画面を一度描いたあとで動かす（最初の表示を待たせない）
function afterPaint(fn) {
  if (window.requestAnimationFrame) requestAnimationFrame(function () { setTimeout(fn, 0); }); else setTimeout(fn, 0);
}
// 文字（Google Fonts・無料）を読み込む。表示を止めない
function addFont(href) {
  var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l);
}
afterPaint(function () { addFont('https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@500;800&display=swap'); });

// 一度読んだシートの内容は、この端末に覚えておく（次からはすぐ表示し、裏で新しい内容を読み直す）
function cacheKey() { return 'nenga-cache:' + ((window.SHEET || {}).tab || ''); }
function readCache() {
  try { var c = JSON.parse(localStorage.getItem(cacheKey()) || 'null'); return c && c.companies && c.companies.length ? c : null; } catch (e) { return null; }
}
function writeCache(site, companies) {
  try { localStorage.setItem(cacheKey(), JSON.stringify({ t: Date.now(), site: site, companies: companies })); } catch (e) {}
}
// cb(fresh) は、表示できる内容がそろったときに呼ばれる。
// 覚えている内容があれば すぐ1回 → シートが新しくなっていたら もう1回（fresh=true）呼ばれる。
// 覚えていないときは、シートを読み終えたとき（読めなければ data.js で）に1回だけ。
function withData(cb, opts) {
  var cfg = window.SHEET || {};
  if (IS_PREVIEW || !(cfg.id || cfg.csv) || !window.fetch) { cb(false); return; }
  var cached = readCache(), shown = false;
  function show(fresh) { shown = true; cb(fresh); }
  if (cached) {
    window.COMPANIES = cached.companies;
    window.SITE = Object.assign({}, window.SITE || {}, cached.site || {});
    DATA_SOURCE = 'cache';
    show(false);
  }
  function get(tab) {
    return fetch(sheetCsvUrl(cfg, tab), { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }).then(parseCSV);
  }
  var timer = setTimeout(function () { if (!shown) show(false); }, 6000); // 電波が弱いときも6秒で予備の内容を出す
  // 会社ページは中身がシート次第なので、すぐ読み始める（opts.now）。トップは画面を描いてから
  (opts && opts.now ? function (f) { f(); } : afterPaint)(function () { Promise.all([get(cfg.tab), get(cfg.siteTab || 'HP全体').catch(function () { return null; })]).then(function (res) {
    var list = rowsToCompanies(res[0]);
    if (!list.length) throw new Error('empty');
    var site = res[1] && rowsToSite(res[1], cfg.tab);
    var newSite = Object.assign({}, window.SITE || {}, site && site.title ? site : {});
    var changed = !cached || JSON.stringify(cached.companies) !== JSON.stringify(list) || JSON.stringify(cached.site || {}) !== JSON.stringify(site || {});
    writeCache(site || {}, list);
    if (shown && !changed) return;
    window.COMPANIES = list; window.SITE = newSite; DATA_SOURCE = 'sheet';
    clearTimeout(timer);
    show(shown); // すでに出していたら「新しくなった」として描き直す
  }).catch(function (e) {
    if (window.console) console.warn('スプレッドシートが読めなかったので、予備の内容で表示します', e);
    clearTimeout(timer);
    if (!shown) show(false);
  });
  });
}

// 読み込み中の表示（梅結びがゆっくり回る）
function loaderHtml() {
  return '<div class="loader" role="status" aria-live="polite">' +
    '<svg class="loader-knot" viewBox="-60 -60 120 120" aria-hidden="true">' + (window.umeKnotG ? umeKnotG() : '') + '</svg>' +
    '<p>読み込み中…</p></div>';
}

// 文字を安全に表示する
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// 写真の大きさ違い（スマホには小さいほう、パソコン・高精細の画面には大きいほう）
function photoSrcset(src) {
  var m = /^(https:\/\/drive\.google\.com\/thumbnail\?id=[\w-]+)&sz=w\d+$/.exec(src);
  if (m) return m[1] + '&sz=w800 800w, ' + m[1] + '&sz=w1600 1600w';
  m = /^(images\/[\w-]+)\.jpe?g$/i.exec(src); // 見本の写真は WebP の 800px・1600px を用意してある
  if (m) return m[1] + '-800.webp 800w, ' + m[1] + '-1600.webp 1600w';
  return '';
}
// 写真。空なら正月柄の仮画像
// opt: { eager: true（最初に見える写真）, sizes: 表示される幅, vt: 画面がつながって見える動きの名前 }
function photoHtml(src, alt, cls, opt) {
  opt = opt || {};
  if (src) {
    var set = photoSrcset(src);
    return '<img src="' + esc(src) + '"' + (set ? ' srcset="' + esc(set) + '" sizes="' + esc(opt.sizes || '(min-width: 1280px) 380px, (min-width: 768px) 50vw, 100vw') + '"' : '') +
      ' alt="' + esc(alt) + '" width="800" height="533" decoding="async"' +
      (opt.eager ? ' fetchpriority="high"' : ' loading="lazy"') +
      ' onerror="if(this.srcset){this.removeAttribute(\'srcset\')}"' +
      ' style="object-position:center 25%' + (opt.vt ? ';view-transition-name:' + opt.vt : '') + '" class="w-full h-full object-cover ' + (cls || '') + '">';
  }
  return '<div class="placeholder w-full h-full flex items-end justify-center pb-6 ' + (cls || '') + '">' +
         '<span class="font-mincho text-[#8E6B2A] text-sm tracking-[0.4em]">迎 春</span></div>';
}

// 丸枠の代表者写真＋役職・名前
function staffHtml(c, size) {
  if (!c.staffPhoto) return '';
  var img = size === 'lg' ? 'w-24 h-24 md:w-32 md:h-32' : 'w-16 h-16 md:w-20 md:h-20';
  return '<div class="absolute bottom-3 right-4 flex flex-col items-center z-10">' +
    '<img src="' + esc(String(c.staffPhoto).replace(/&sz=w\d+$/, '&sz=w300')) + '" alt="' + esc((c.staffRole || '') + ' ' + (c.staffName || '')) + '" width="128" height="128" loading="lazy" decoding="async" class="' + img + ' rounded-full object-cover border-4 border-white shadow-lg">' +
    '<div class="bg-white -mt-3 px-3 py-1 rounded-2xl shadow-md text-center leading-tight relative">' +
      '<div class="text-[10px] text-shu font-bold whitespace-nowrap">' + esc(c.staffRole) + '</div>' +
      '<div class="text-xs font-black whitespace-nowrap">' + esc(c.staffName) + '</div>' +
    '</div></div>';
}

// 表（会社情報・営業日）
// 番地・電話番号などの数字のかたまりは、途中で折り返さない
function nowrapNums(h) { return h.replace(/([0-9０-９]+(?:[-‐－−ー][0-9０-９]+)+)/g, '<span class="whitespace-nowrap">$1</span>'); }

function tableHtml(rows) {
  return (rows || []).map(function (r) {
    return '<tr class="tbl-row">' +
      '<th class="py-3.5 px-4 font-bold w-2/5 align-top text-left tbl-th">' + esc(r[0]) + '</th>' +
      '<td class="py-3.5 px-4 leading-relaxed whitespace-pre-line break-words">' + nowrapNums(esc(r[1])) + '</td></tr>';
  }).join('');
}

// 改行を除いた先頭○文字
function shortText(s, n) {
  s = String(s || '').replace(/\n/g, '');
  return s.length > n ? s.slice(0, n) + '…' : s;
}

// ヘッダー・フッターの文字を入れる（data-site="項目名"）
function fillSite() {
  var S = window.SITE || {};
  document.querySelectorAll('[data-site]').forEach(function (el) {
    var k = el.getAttribute('data-site');
    if (!S[k]) { el.style.display = 'none'; return; }
    var h = esc(S[k]).replace(/\n/g, '<br>');
    // 見出しの下の一文・あいさつ文は、スマホのときだけ「、」のあとで改行（PCはそのまま）
    if (k === 'subtitle' || k === 'lead') h = h.replace(/、(?!<br>|$)/g, '、<br class="sp-br">');
    el.innerHTML = h;
  });
}

// ===== 飾り（水引・梅） =====

// 梅の花ひとつ
function umeFlower(x, y, r, petal, edge) {
  var s = '';
  for (var i = 0; i < 5; i++) {
    var a = (i * 72 - 90) * Math.PI / 180;
    s += '<circle cx="' + (x + Math.cos(a) * r * 1.05).toFixed(1) + '" cy="' + (y + Math.sin(a) * r * 1.05).toFixed(1) + '" r="' + (r * 0.95).toFixed(1) + '" fill="' + petal + '" stroke="' + edge + '" stroke-width="1"/>';
  }
  s += '<circle cx="' + x + '" cy="' + y + '" r="' + (r * 0.5).toFixed(1) + '" fill="#F3D27A"/>';
  for (var j = 0; j < 8; j++) {
    var b = j * 45 * Math.PI / 180;
    s += '<circle cx="' + (x + Math.cos(b) * r * 0.75).toFixed(1) + '" cy="' + (y + Math.sin(b) * r * 0.75).toFixed(1) + '" r="' + (r * 0.09).toFixed(1) + '" fill="#A8801F"/>';
  }
  return s;
}

// 小さな梅（見出し用）
function umeIcon(cls, white) {
  return '<svg class="' + (cls || '') + '" viewBox="-24 -24 48 48" aria-hidden="true">' +
    (white ? umeFlower(0, 0, 10, '#fff', '#D9B6A0') : umeFlower(0, 0, 10, '#D8434A', '#9E1F25')) + '</svg>';
}

// 紐の帯＋真ん中にあわじ結び（カードや枠の上に付ける）
function noshiHtml(size) {
  return awajiSVG({ h: size === 'lg' ? 110 : 72, lw: size === 'lg' ? 3 : 3.6 });
}

// ロゴの太い文字（Noto Sans JP の一番太い字）を、使う文字だけ読み込む（とても軽い）
var logoFontText = '';
function loadLogoFont(text) {
  var chars = Array.from(new Set(String(text).replace(/s/g, '').split(''))).sort().join('');
  if (!chars || chars === logoFontText) return;
  logoFontText = chars;
  afterPaint(function () { addFont('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@900&display=swap&text=' + encodeURIComponent(chars)); });
}

// ===== 「謹賀新年」ロゴ（見本：デスクトップの「謹賀新年.jpg」） =====
// 金の丸い枠の中に、赤と金の太い文字を2文字×2段。雲・金の玉・花火・扇の「HAPPY NEW YEAR」・縦の赤いリボン
function nengaLogoSVG(year, title, ribbon) {
  year = String(year || ''); title = String(title || '');
  var RD = '#C8232C', GD = '#C9A044', F = "'Noto Sans JP','Hiragino Sans','Yu Gothic',sans-serif";
  loadLogoFont(year + title + (ribbon || '') + 'HAPPY NEW YEAR');
  var s = '<defs>' +
    // 文字の塗り分け（へん・つくり などで赤と金に分ける）
    '<linearGradient id="ng0" gradientUnits="userSpaceOnUse" x1="212" x2="380" y1="0" y2="0"><stop offset=".37" stop-color="' + GD + '"/><stop offset=".37" stop-color="' + RD + '"/></linearGradient>' +
    '<linearGradient id="ng1" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="93" y2="261"><stop offset=".5" stop-color="' + RD + '"/><stop offset=".5" stop-color="' + GD + '"/></linearGradient>' +
    '<linearGradient id="ng2" gradientUnits="userSpaceOnUse" x1="212" x2="380" y1="0" y2="0"><stop offset=".56" stop-color="' + RD + '"/><stop offset=".56" stop-color="' + GD + '"/></linearGradient>' +
    // 「年」：上の部分（ノと一画目）を金、下を赤
    '<linearGradient id="ng3" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="263" y2="431"><stop offset=".36" stop-color="' + GD + '"/><stop offset=".36" stop-color="' + RD + '"/></linearGradient>' +
    // 赤い玉
    '<radialGradient id="ngRed" cx=".35" cy=".35" r=".75"><stop offset="0" stop-color="#F4888C"/><stop offset=".55" stop-color="#D33238"/><stop offset="1" stop-color="#9E1B21"/></radialGradient>' +
    '<linearGradient id="ngGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F6E2A6"/><stop offset=".45" stop-color="#D9B260"/><stop offset="1" stop-color="#B8893A"/></linearGradient>' +
    '<radialGradient id="ngMoon" cx=".35" cy=".35" r=".75"><stop offset="0" stop-color="#FBEFC8"/><stop offset=".6" stop-color="#E2C27A"/><stop offset="1" stop-color="#C99B48"/></radialGradient>' +
    '<linearGradient id="ngRib" x1="0" x2="1"><stop offset="0" stop-color="#A51B22"/><stop offset=".5" stop-color="#D2353C"/><stop offset="1" stop-color="#A51B22"/></linearGradient>' +
    '<pattern id="ngDot" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="4.5" cy="4.5" r="1.3" fill="' + GD + '" opacity=".45"/></pattern>' +
    // 文字のうっすら影
    '<filter id="ngShadow" x="-10%" y="-10%" width="120%" height="125%"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#6E1A12" flood-opacity=".28"/></filter>' +
    // 星のまわりの やわらかい光
    '<radialGradient id="ngGlow"><stop offset="0" stop-color="#FFF8DC" stop-opacity=".95"/><stop offset=".45" stop-color="#F6DC86" stop-opacity=".45"/><stop offset="1" stop-color="#F6DC86" stop-opacity="0"/></radialGradient>' +
    // 金の部分に すっと走る光
    '<linearGradient id="ngShine" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#FFF6D8" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
    '</defs>';

  // まわりの飾り（開いたときに ふわっと出る）
  s += '<g class="ng-deco">';
  // 金の玉と赤い玉（左上と右下で 位置・大きさ・重なり方を変えて、動きを出す）。それぞれ ゆっくり ふわふわ
  function ball(x, y, r, fill, fd, ft) {
    return '<g class="ng-float" style="--fd:' + fd + 's;--ft:' + ft + 's"><circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="url(#' + fill + ')"/></g>';
  }
  // 左上：大きな金の右上に赤（赤はうしろ）、下に小さな赤。対角線になりすぎないよう、左はやや下・右はやや上に置く
  s += ball(114, 58, 38, 'ngRed', 0, 7.5) + ball(34, 106, 70, 'ngMoon', 1.2, 9) + ball(70, 204, 10, 'ngRed', 2.1, 6);
  // 右：金の左下に赤（赤が手前）、上に小さな金
  s += ball(742, 336, 58, 'ngMoon', .6, 8.5) + ball(688, 372, 30, 'ngRed', 1.8, 7) + ball(706, 270, 11, 'ngMoon', 3, 6.5) +
       '<circle cx="132" cy="168" r="30" fill="url(#ngDot)"/>' +
       '<circle cx="690" cy="40" r="52" fill="url(#ngDot)"/>';
  // 花火（金の細い線）
  function burst(cx, cy, r, n) {
    var g = '';
    for (var i = 0; i < n; i++) {
      var a = i / n * 2 * Math.PI, r0 = r * (i % 2 ? .45 : .3);
      g += '<line x1="' + (cx + Math.cos(a) * r0).toFixed(1) + '" y1="' + (cy + Math.sin(a) * r0).toFixed(1) + '" x2="' + (cx + Math.cos(a) * r).toFixed(1) + '" y2="' + (cy + Math.sin(a) * r).toFixed(1) + '"/>';
    }
    return '<g stroke="' + GD + '" stroke-width="1.4" stroke-linecap="round" opacity=".85">' + g + '</g>';
  }
  s += burst(712, 190, 54, 28) + burst(92, 410, 34, 20);

  // 丸い枠：外に赤い丸、その内側に太い金の丸、いちばん内側に細い金の線
  s += '<circle cx="380" cy="262" r="216" fill="none" stroke="' + RD + '" stroke-width="6"/>' +
       '<circle cx="380" cy="262" r="206" fill="#FFFDF8" fill-opacity=".85" stroke="url(#ngGold)" stroke-width="8"/>' +
       '<circle cx="380" cy="262" r="195" fill="none" stroke="' + GD + '" stroke-width="1.4" opacity=".85"/>';

  // 雲（線で描いた瑞雲）
  function cloud(x, y, sc, flip) {
    var d = 'M0 0 H40 C40 -16 62 -22 72 -10 C78 -30 108 -30 112 -8 C122 -18 142 -12 140 0 H190 ' +
            'M20 12 H170 M60 24 H150';
    return '<g transform="translate(' + x + ',' + y + ') scale(' + (flip ? -sc : sc) + ',' + sc + ')">' +
      '<path d="M40 0 C40 -16 62 -22 72 -10 C78 -30 108 -30 112 -8 C122 -18 142 -12 140 0 Z" fill="#fff"/>' +
      '<path d="' + d + '" fill="none" stroke="#B9A67E" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></g>';
  }
  s += cloud(95, 470, 1.1) + cloud(560, 118, .85, false) + cloud(600, 440, .9, true);

  // 扇の「HAPPY NEW YEAR」と年（左）
  var fx = 114, fy = 318, R1 = 92, R0 = 34, a0 = -148, a1 = -32;
  function pt(r, a) { a = a * Math.PI / 180; return (fx + Math.cos(a) * r).toFixed(1) + ' ' + (fy + Math.sin(a) * r).toFixed(1); }
  var fan = 'M' + pt(R0, a0) + ' L' + pt(R1, a0) + ' A' + R1 + ' ' + R1 + ' 0 0 1 ' + pt(R1, a1) + ' L' + pt(R0, a1) + ' A' + R0 + ' ' + R0 + ' 0 0 0 ' + pt(R0, a0) + 'Z';
  s += '<path d="' + fan + '" fill="' + RD + '" stroke="' + GD + '" stroke-width="2.5"/>' +
       '<path d="M' + pt(R1 - 6, a0 + 3) + ' A' + (R1 - 6) + ' ' + (R1 - 6) + ' 0 0 1 ' + pt(R1 - 6, a1 - 3) + '" fill="none" stroke="#F3D88A" stroke-width=".9"/>' +
       '<text x="' + fx + '" y="' + (fy - 64) + '" text-anchor="middle" font-size="13.5" font-weight="900" letter-spacing="1.5" fill="#fff" font-family="' + F + '">HAPPY</text>' +
       '<text x="' + fx + '" y="' + (fy - 47) + '" text-anchor="middle" font-size="13.5" font-weight="900" letter-spacing="1.5" fill="#fff" font-family="' + F + '">NEW YEAR</text>';
  if (window.umeKnotG) s += '<g transform="translate(' + fx + ',' + (fy - 104) + ') scale(.26)">' + umeKnotG() + '</g>';
  s += '<text x="' + fx + '" y="' + (fy + 4) + '" text-anchor="middle" font-size="40" font-weight="900" fill="' + RD + '" font-family="' + F + '" stroke="#FFFDF8" stroke-width="6" paint-order="stroke">' + esc(year) + '</text>';

  s += '</g>'; // ng-deco ここまで

  // 大きな文字（2文字×2段）。開いたときは一文字ずつ現れて、そのあと光が走る
  var chars = title.split(''), clip = '';
  if (chars.length === 4) {
    var pos = [[296, 241], [464, 241], [296, 411], [464, 411]]; // 丸の中心（380,262）に文字のかたまりの真ん中がくるように
    var fills = ['url(#ng0)', 'url(#ng1)', 'url(#ng2)', 'url(#ng3)'];
    chars.forEach(function (ch, i) {
      var t = '<text x="' + pos[i][0] + '" y="' + pos[i][1] + '" text-anchor="middle" font-size="168" font-weight="900" font-family="' + F + '"';
      // 文字を強く：白いふちどり＋うっすら影
      s += t + ' class="ng-ch" style="--i:' + i + '" fill="' + fills[i] + '" stroke="#FFFDF8" stroke-width="7" stroke-linejoin="round" paint-order="stroke" filter="url(#ngShadow)">' + esc(ch) + '</text>';
      clip += t + '>' + esc(ch) + '</text>';
    });
  } else {
    var t1 = '<text x="380" y="300" text-anchor="middle" font-size="' + Math.min(150, 560 / Math.max(1, chars.length)) + '" font-weight="900" font-family="' + F + '"';
    s += t1 + ' class="ng-ch" style="--i:0" fill="' + RD + '" stroke="#FFFDF8" stroke-width="7" stroke-linejoin="round" paint-order="stroke" filter="url(#ngShadow)">' + esc(title) + '</text>';
    clip += t1 + '>' + esc(title) + '</text>';
  }
  s += '<clipPath id="ngClip">' + clip + '</clipPath>' +
       '<g clip-path="url(#ngClip)" aria-hidden="true"><rect class="ng-shine" x="140" y="40" width="180" height="420" fill="url(#ngShine)" transform="skewX(-18)"/></g>';

  // 縦の赤いリボン（右）
  if (ribbon) {
    s += '<g class="ng-rib">';
    // 1文字ずつ縦に置く（スマホで縦書き指定がずれて帯が足りなくなるのを防ぐ）。帯の長さは文字数から計算
    var rx = 628, rw = 54, FS = 27, STEP = 31, y = 22, rt = '';
    ribbon.split('').forEach(function (ch) {
      if (/\s/.test(ch)) { y += STEP / 2; return; }
      rt += '<text x="' + (rx + rw / 2) + '" y="' + (y + FS * .88).toFixed(1) + '" text-anchor="middle" font-size="' + FS + '" font-weight="900" fill="#fff" font-family="' + F + '">' + esc(ch) + '</text>';
      y += STEP;
    });
    var rh = Math.max(200, Math.round(y + 40));
    s += '<path d="M' + rx + ' 0 H' + (rx + rw) + ' V' + rh + ' L' + (rx + rw / 2) + ' ' + (rh - 22) + ' L' + rx + ' ' + rh + ' Z" fill="url(#ngRib)"/>' + rt + '</g>';
  }

  // 文字がそろったときに広がる金の光の輪
  s += '<circle class="ng-halo" cx="380" cy="262" r="206" fill="none" stroke="#E9C66E" stroke-width="7" aria-hidden="true"/>';
  // きらきら またたく星（白と金の4本の光）
  var STAR = 'M0 -10 C1 -2.2 2.2 -1 10 0 C2.2 1 1 2.2 0 10 C-1 2.2 -2.2 1 -10 0 C-2.2 -1 -1 -2.2 0 -10Z';
  var sparks = [[232, 66, 3.2, 0, 3.2], [548, 92, 2.2, 1.1, 2.8], [604, 356, 2.8, .5, 3.6], [196, 300, 2.0, 1.7, 3.0],
                [474, 486, 2.5, 2.3, 3.4], [262, 466, 1.8, .9, 2.6], [340, 36, 2.0, 2.0, 3.1], [706, 112, 2.4, 1.4, 3.3], [70, 226, 2.2, 2.6, 2.9]];
  s += '<g aria-hidden="true">' + sparks.map(function (p, i) {
    return '<g transform="translate(' + p[0] + ',' + p[1] + ') scale(' + p[2] + ')"><g class="ng-spark" style="--dl:' + p[3] + 's;--t:' + p[4] + 's">' +
      '<circle r="11" fill="url(#ngGlow)"/><path d="' + STAR + '" fill="' + (i % 3 === 1 ? '#FFFFFF' : '#F6DC86') + '" stroke="#C9A044" stroke-width=".6"/></g></g>';
  }).join('') + '</g>';

  return '<svg viewBox="0 0 760 520" class="w-full h-auto overflow-visible" role="img" aria-label="' + esc(year + ' ' + title) + '" xmlns="http://www.w3.org/2000/svg">' + s + '</svg>';
}

// ===== フッター（紙面とのつながり） =====
// 「情報誌くれよん ○○版 1月号 連動企画」と、くれよんへのリンク（sheet-config.js の kureyonUrl が入っているときだけ）
function footerHtml() {
  var S = window.SITE || {}, url = (window.SHEET || {}).kureyonUrl || '';
  return '<div class="foot-inner">' +
    '<div class="foot-knot">' + awajiSVG({ set: 'kingin', h: 70, lw: 3.2 }) + '</div>' +
    (S.badge ? '<p class="foot-badge font-mincho">' + esc(S.badge) + '</p>' : '') +
    (url ? '<a class="foot-link" href="' + esc(url) + '" target="_blank" rel="noopener">情報誌くれよん のホームページへ ›</a>' : '') +
    (S.footer ? '<p class="foot-copy">' + esc(S.footer) + '</p>' : '') +
    '</div>';
}

// ===== 動き =====
var REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

// 画面に入ったら .is-in を付ける（スクロールのたびに重い計算をしない）
// 同じタイミングで入ったものは、少しずつずらして出す
function revealOnScroll(els, step) {
  els = [].slice.call(els || []);
  if (REDUCED || !('IntersectionObserver' in window)) { els.forEach(function (el) { el.classList.add('is-in'); }); return; }
  var io = new IntersectionObserver(function (entries) {
    var n = 0;
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.style.setProperty('--d', (n++ * (step || 90)) + 'ms');
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  els.forEach(function (el) { io.observe(el); });
}
