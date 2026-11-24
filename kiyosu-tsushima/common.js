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
function withData(cb) {
  var cfg = window.SHEET || {};
  if (IS_PREVIEW || !(cfg.id || cfg.csv) || !window.fetch) { cb(); return; }
  function get(tab) { return fetch(sheetCsvUrl(cfg, tab), { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }).then(parseCSV); }
  var done = false, timer = setTimeout(function () { if (!done) { done = true; cb(); } }, 8000);
  Promise.all([get(cfg.tab), get(cfg.siteTab || 'HP全体').catch(function () { return null; })]).then(function (res) {
    var list = rowsToCompanies(res[0]);
    if (!list.length) throw new Error('empty');
    window.COMPANIES = list;
    var site = res[1] && rowsToSite(res[1], cfg.tab);
    if (site && site.title) window.SITE = Object.assign({}, window.SITE || {}, site);
    DATA_SOURCE = 'sheet';
  }).catch(function (e) { if (window.console) console.warn('スプレッドシートが読めなかったので data.js で表示します', e); })
    .then(function () { if (!done) { done = true; clearTimeout(timer); cb(); } });
}

// 文字を安全に表示する
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// 写真。空なら正月柄の仮画像
function photoHtml(src, alt, cls) {
  if (src) {
    return '<img src="' + esc(src) + '" alt="' + esc(alt) + '" loading="lazy" style="object-position:center 25%" class="w-full h-full object-cover ' + (cls || '') + '">';
  }
  return '<div class="placeholder w-full h-full flex items-end justify-center pb-6 ' + (cls || '') + '">' +
         '<span class="font-mincho text-[#8E6B2A] text-sm tracking-[0.4em]">迎 春</span></div>';
}

// 丸枠の代表者写真＋役職・名前
function staffHtml(c, size) {
  if (!c.staffPhoto) return '';
  var img = size === 'lg' ? 'w-24 h-24 md:w-32 md:h-32' : 'w-16 h-16 md:w-20 md:h-20';
  return '<div class="absolute bottom-3 right-4 flex flex-col items-center z-10">' +
    '<img src="' + esc(c.staffPhoto) + '" alt="' + esc(c.staffName) + '" class="' + img + ' rounded-full object-cover border-4 border-white shadow-lg">' +
    '<div class="bg-white -mt-3 px-3 py-1 rounded-2xl shadow-md text-center leading-tight relative">' +
      '<div class="text-[10px] text-shu font-bold whitespace-nowrap">' + esc(c.staffRole) + '</div>' +
      '<div class="text-xs font-black whitespace-nowrap">' + esc(c.staffName) + '</div>' +
    '</div></div>';
}

// 表（会社情報・営業日）
function tableHtml(rows) {
  return (rows || []).map(function (r) {
    return '<tr class="border-b border-[#EFE3C4] last:border-b-0">' +
      '<th class="py-3.5 px-4 font-bold w-2/5 align-top text-left bg-[#FBF3E1] text-[#7A5B1E]">' + esc(r[0]) + '</th>' +
      '<td class="py-3.5 px-4 leading-relaxed whitespace-pre-line">' + esc(r[1]) + '</td></tr>';
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
    el.innerHTML = esc(S[k]).replace(/\n/g, '<br>');
  });
}

// ===== 飾り（水引・梅） =====

// 水引のあわじ結び（紅白＋金の紐）
function knotSVG(cls) {
  var d = 'M120 58 C92 18 46 16 52 48 C58 80 104 76 126 52 ' +
          'M120 58 C148 18 194 16 188 48 C182 80 136 76 114 52 ' +
          'M106 60 C92 102 148 102 134 60 ' +
          'M108 66 C92 92 64 108 26 118 M132 66 C148 92 176 108 214 118';
  var layers = [['#5E0F13', 18], ['#C8323A', 16.5], ['#7A1A1F', 11.6], ['#FFFBF2', 10.6],
                ['#8C6B22', 5.8], ['#E3C46A', 4.8], ['#FFF3C8', 1.3]];
  return '<svg class="' + (cls || '') + '" viewBox="0 0 240 124" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<g fill="none" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 2px 2px rgba(80,20,10,.25))">' +
    layers.map(function (l) { return '<path d="' + d + '" stroke="' + l[0] + '" stroke-width="' + l[1] + '"/>'; }).join('') +
    '</g></svg>';
}

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

// 梅の枝（紅白の花）
function umeBranchSVG(cls) {
  var R = ['#D8434A', '#9E1F25'], W = ['#FFFFFF', '#D9B6A0'];
  return '<svg class="' + (cls || '') + '" viewBox="0 0 260 180" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<g fill="none" stroke="#5A3A28" stroke-linecap="round">' +
      '<path d="M0 18 C60 30 100 60 150 70 C190 78 220 96 250 130" stroke-width="5"/>' +
      '<path d="M95 55 C110 30 130 22 150 14" stroke-width="3"/>' +
      '<path d="M170 78 C175 105 168 130 178 160" stroke-width="3"/>' +
    '</g>' +
    umeFlower(60, 34, 13, R[0], R[1]) + umeFlower(150, 14, 9, W[0], W[1]) + umeFlower(128, 66, 15, W[0], W[1]) +
    umeFlower(205, 92, 12, R[0], R[1]) + umeFlower(178, 158, 9, R[0], R[1]) + umeFlower(245, 128, 8, W[0], W[1]) +
    '<circle cx="100" cy="50" r="4" fill="#D8434A"/><circle cx="230" cy="110" r="3.5" fill="#D8434A"/><circle cx="20" cy="22" r="3.5" fill="#fff" stroke="#D9B6A0"/>' +
    '</svg>';
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

// ===== 「謹賀新年」ロゴ（見本：デスクトップの「謹賀新年.jpg」） =====
// 金の丸い枠の中に、赤と金の太い文字を2文字×2段。雲・金の玉・花火・扇の「HAPPY NEW YEAR」・縦の赤いリボン
function nengaLogoSVG(year, title, ribbon) {
  year = String(year || ''); title = String(title || '');
  var RD = '#C8232C', GD = '#C9A044', F = "'Noto Sans JP',sans-serif";
  var s = '<defs>' +
    // 文字の塗り分け（へん・つくり などで赤と金に分ける）
    '<linearGradient id="ng0" gradientUnits="userSpaceOnUse" x1="221" x2="379" y1="0" y2="0"><stop offset=".37" stop-color="' + GD + '"/><stop offset=".37" stop-color="' + RD + '"/></linearGradient>' +
    '<linearGradient id="ng1" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="83" y2="241"><stop offset=".5" stop-color="' + RD + '"/><stop offset=".5" stop-color="' + GD + '"/></linearGradient>' +
    '<linearGradient id="ng2" gradientUnits="userSpaceOnUse" x1="221" x2="379" y1="0" y2="0"><stop offset=".56" stop-color="' + RD + '"/><stop offset=".56" stop-color="' + GD + '"/></linearGradient>' +
    '<linearGradient id="ngGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F6E2A6"/><stop offset=".45" stop-color="#D9B260"/><stop offset="1" stop-color="#B8893A"/></linearGradient>' +
    '<radialGradient id="ngMoon" cx=".35" cy=".35" r=".75"><stop offset="0" stop-color="#FBEFC8"/><stop offset=".6" stop-color="#E2C27A"/><stop offset="1" stop-color="#C99B48"/></radialGradient>' +
    '<linearGradient id="ngRib" x1="0" x2="1"><stop offset="0" stop-color="#A51B22"/><stop offset=".5" stop-color="#D2353C"/><stop offset="1" stop-color="#A51B22"/></linearGradient>' +
    '<pattern id="ngDot" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="4.5" cy="4.5" r="1.3" fill="' + GD + '" opacity=".45"/></pattern>' +
    '</defs>';

  // 金の玉（左上・右下）と点々
  s += '<circle cx="40" cy="58" r="74" fill="url(#ngMoon)" opacity=".9"/>' +
       '<circle cx="735" cy="452" r="58" fill="url(#ngMoon)" opacity=".9"/>' +
       '<circle cx="118" cy="138" r="46" fill="url(#ngDot)"/>' +
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

  // 金の丸い枠
  s += '<circle cx="380" cy="262" r="206" fill="#FFFDF8" fill-opacity=".75" stroke="url(#ngGold)" stroke-width="3"/>' +
       '<circle cx="380" cy="262" r="197" fill="none" stroke="' + GD + '" stroke-width=".8" opacity=".7"/>';

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
  var fx = 150, fy = 318, R1 = 92, R0 = 34, a0 = -148, a1 = -32;
  function pt(r, a) { a = a * Math.PI / 180; return (fx + Math.cos(a) * r).toFixed(1) + ' ' + (fy + Math.sin(a) * r).toFixed(1); }
  var fan = 'M' + pt(R0, a0) + ' L' + pt(R1, a0) + ' A' + R1 + ' ' + R1 + ' 0 0 1 ' + pt(R1, a1) + ' L' + pt(R0, a1) + ' A' + R0 + ' ' + R0 + ' 0 0 0 ' + pt(R0, a0) + 'Z';
  s += '<path d="' + fan + '" fill="' + RD + '" stroke="' + GD + '" stroke-width="2.5"/>' +
       '<path d="M' + pt(R1 - 6, a0 + 3) + ' A' + (R1 - 6) + ' ' + (R1 - 6) + ' 0 0 1 ' + pt(R1 - 6, a1 - 3) + '" fill="none" stroke="#F3D88A" stroke-width=".9"/>' +
       '<text x="' + fx + '" y="' + (fy - 64) + '" text-anchor="middle" font-size="13.5" font-weight="900" letter-spacing="1.5" fill="#fff" font-family="' + F + '">HAPPY</text>' +
       '<text x="' + fx + '" y="' + (fy - 47) + '" text-anchor="middle" font-size="13.5" font-weight="900" letter-spacing="1.5" fill="#fff" font-family="' + F + '">NEW YEAR</text>';
  if (window.umeKnotG) s += '<g transform="translate(' + fx + ',' + (fy - 104) + ') scale(.26)">' + umeKnotG() + '</g>';
  s += '<text x="' + fx + '" y="' + (fy + 4) + '" text-anchor="middle" font-size="40" font-weight="900" fill="' + RD + '" font-family="' + F + '" stroke="#FFFDF8" stroke-width="6" paint-order="stroke">' + esc(year) + '</text>';

  // 大きな文字（2文字×2段）
  var chars = title.split('');
  if (chars.length === 4) {
    var pos = [[300, 222], [460, 222], [300, 388], [460, 388]];
    var fills = ['url(#ng0)', 'url(#ng1)', 'url(#ng2)', RD];
    chars.forEach(function (ch, i) {
      s += '<text x="' + pos[i][0] + '" y="' + pos[i][1] + '" text-anchor="middle" font-size="158" font-weight="900" fill="' + fills[i] + '" font-family="' + F + '">' + esc(ch) + '</text>';
    });
  } else {
    s += '<text x="380" y="300" text-anchor="middle" font-size="' + Math.min(150, 560 / Math.max(1, chars.length)) + '" font-weight="900" fill="' + RD + '" font-family="' + F + '">' + esc(title) + '</text>';
  }

  // 縦の赤いリボン（右）
  if (ribbon) {
    var rx = 628, rw = 54, rh = Math.max(200, ribbon.length * 31 + 60);
    s += '<path d="M' + rx + ' 0 H' + (rx + rw) + ' V' + rh + ' L' + (rx + rw / 2) + ' ' + (rh - 22) + ' L' + rx + ' ' + rh + ' Z" fill="url(#ngRib)"/>' +
         '<text x="' + (rx + rw / 2) + '" y="24" font-size="27" font-weight="900" fill="#fff" letter-spacing="4" font-family="' + F + '" style="writing-mode:vertical-rl;text-orientation:upright">' + esc(ribbon) + '</text>';
  }

  return '<svg viewBox="0 0 760 520" class="w-full h-auto overflow-visible" role="img" aria-label="' + esc(year + ' ' + title) + '" xmlns="http://www.w3.org/2000/svg">' + s + '</svg>';
}

// ===== 前の「謹賀新年」ロゴ（年・菱飾り・富士山）。いまは使っていない =====
function nengaLogoOldSVG(year, title) {
  var BR = '#6E5048', RD = '#D9343A', PK = '#EBA9A4';
  year = String(year || ''); title = String(title || '');
  var F = "'M PLUS Rounded 1c','Zen Maru Gothic','Noto Sans JP',sans-serif";
  var s = '';
  // 年
  var yx = 40, adv = 31, yb = 150, yw = year.length * adv;
  for (var i = 0; i < year.length; i++) {
    var cx = yx + i * adv + adv / 2;
    if (year[i] === '0') {
      s += '<g transform="translate(' + cx + ',' + (yb - 17) + ')">' + umeFlower(0, 0, 8.2, RD, RD) +
           '<circle r="3.2" fill="#fff"/></g>';
    } else {
      s += '<text x="' + cx + '" y="' + yb + '" text-anchor="middle" font-size="50" font-weight="800" fill="' + BR + '" font-family="' + F + '">' + esc(year[i]) + '</text>';
    }
  }
  // 年の下の線と菱の飾り
  var lx1 = yx - 10, lx2 = yx + yw + 8;
  s += '<line x1="' + lx1 + '" y1="161" x2="' + lx2 + '" y2="161" stroke="' + BR + '" stroke-width="4.5" stroke-linecap="round"/>';
  var dg = '';
  for (var r = 0; r < 2; r++) for (var x = yx + 8 + r * 7; x < yx + yw - 4; x += 14) {
    var y = 178 + r * 18;
    dg += '<path d="M' + x + ' ' + (y - 9) + ' L' + (x + 7) + ' ' + y + ' L' + x + ' ' + (y + 9) + ' L' + (x - 7) + ' ' + y + 'Z"/>';
  }
  s += '<g fill="none" stroke="' + RD + '" stroke-width="2" stroke-linejoin="round">' + dg + '</g>';
  // 文字（2文字目を紅に）
  var tx = lx2 + 14, ta = 84, tb = 206, n = title.length;
  s += '<rect x="' + (tx - 4) + '" y="166" width="5" height="26" rx="1" fill="' + PK + '"/>';
  for (var k = 0; k < n; k++) {
    s += '<text x="' + (tx + k * ta + ta / 2) + '" y="' + tb + '" text-anchor="middle" font-size="80" font-weight="800" fill="' + (k === 1 ? RD : BR) + '" font-family="' + F + '">' + esc(title[k]) + '</text>';
  }
  var te = tx + n * ta;
  // 富士山と初日の出
  var fx = te + 14, base = 214, mx = fx + 56;
  var rays = '';
  for (var a = -165; a <= -15; a += 18.75) {
    var rd = a * Math.PI / 180, r1 = 26, r2 = (Math.round((a + 165) / 18.75) % 2) ? 40 : 46;
    rays += '<line x1="' + (mx + Math.cos(rd) * r1).toFixed(1) + '" y1="' + (118 + Math.sin(rd) * r1).toFixed(1) + '" x2="' + (mx + Math.cos(rd) * r2).toFixed(1) + '" y2="' + (118 + Math.sin(rd) * r2).toFixed(1) + '"/>';
  }
  s += '<g stroke="' + RD + '" stroke-width="2.4" stroke-linecap="round">' + rays + '</g>';
  s += '<path d="M' + fx + ' ' + base + ' L' + (mx - 18) + ' 128 L' + (mx + 18) + ' 128 L' + (fx + 112) + ' ' + base + '" fill="none" stroke="' + BR + '" stroke-width="5" stroke-linejoin="round"/>';
  s += '<path d="M' + (mx - 21) + ' 142 L' + (mx - 11) + ' 133 L' + (mx - 4) + ' 145 L' + (mx + 4) + ' 133 L' + (mx + 11) + ' 145 L' + (mx + 21) + ' 142" fill="none" stroke="' + RD + '" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>';
  // 山の中の水引（あわじ風の小さな結び）
  s += '<g fill="none" stroke="' + RD + '" stroke-width="2.6"><ellipse cx="' + (mx - 9) + '" cy="186" rx="11" ry="9"/><ellipse cx="' + (mx + 9) + '" cy="186" rx="11" ry="9"/>' +
       '<path d="M' + (mx - 6) + ' 195 Q' + mx + ' 201 ' + (mx + 6) + ' 195"/></g>';
  // 下の長い線
  s += '<line x1="' + (te - ta * 0.6) + '" y1="' + base + '" x2="' + (fx + 128) + '" y2="' + base + '" stroke="' + BR + '" stroke-width="4.5" stroke-linecap="round"/>';
  // 霞（うずまきの線）上
  var k0 = tx + ta * 0.85, k1 = fx - 22;
  s += '<g fill="none" stroke="' + RD + '" stroke-width="1.8" stroke-linecap="round">' +
       '<path d="M' + k1 + ' 104 H' + k0 + ' A9 9 0 0 0 ' + k0 + ' 122 H' + (k0 + 42) + '"/>' +
       '<path d="M' + (k0 + 46) + ' 110 H' + k0 + ' A3 3 0 0 0 ' + k0 + ' 116 H' + (k0 + 30) + '"/>' +
  // 霞 下（右端がうずまき）
       '<path d="M' + (tx + ta * 1.8) + ' 244 H' + (fx + 118) + ' A9 9 0 0 0 ' + (fx + 118) + ' 226 H' + (fx + 74) + '"/>' +
       '<path d="M' + (fx + 70) + ' 238 H' + (fx + 118) + ' A3 3 0 0 0 ' + (fx + 118) + ' 232 H' + (fx + 88) + '"/>' +
       '<path d="M' + (tx + ta * 2.3) + ' 252 H' + (fx + 60) + '"/>' +
       '</g>';
  var W = fx + 150;
  return '<svg viewBox="0 58 ' + W + ' 202" class="w-full h-auto" role="img" aria-label="' + esc(year + ' ' + title) + '" xmlns="http://www.w3.org/2000/svg">' + s + '</svg>';
}
