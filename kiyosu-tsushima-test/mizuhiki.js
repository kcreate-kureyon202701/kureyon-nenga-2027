// 水引（梅結び）を描く仕組み（ふだんは触らなくてOK）
// デスクトップの見本「これ.png」と同じ形：
// 真ん中に5枚の花びらの「梅結び」（紐は4本線、上下に交互にくぐる）
// 左右にのびる紐（赤3本＋金1本）。トップでは波のようにゆれながら広がる
(function () {
  var SETS = {
    kohaku: { line: '#E0262D', gold: '#E8B43C', fill: '#FFFBF4' },  // 白地用（赤い線＋金）
    kingin: { line: '#FFF3D6', gold: '#E9C66E', fill: '#B7282E', lw: 2.3 }   // 赤地用（白っぽい金の線）
  };
  var GAP = 3.5;     // 4本線の間かく
  var K = 37;        // 結びの大きさ
  var N = 720;       // 線をなめらかにする細かさ
  var A = 0.42;      // 花びらの丸さ（大きいほど丸く、となりの花びらと重なる）

  // ---- 梅結びの形（花びら5枚、ひとつが真上） ----
  var KNOT = (function () {
    var P = [];
    for (var i = 0; i < N; i++) {
      var t = i / N * 2 * Math.PI;
      var x = A * Math.cos(2 * t) + Math.cos(-3 * t);
      var y = A * Math.sin(2 * t) + Math.sin(-3 * t);
      P.push([y * K, -x * K]); // 90度まわして花びらを真上に
    }
    return P;
  })();

  // 交わるところを探して、上・下を交互に決める
  var OVERS = (function () {
    // 近くにある線どうしだけを調べる（升目に分けて、計算を軽くする）
    var ev = [], CELL = 6, grid = {};
    function seg(i) { return [KNOT[i], KNOT[(i + 1) % N]]; }
    function key(x, y) { return Math.floor(x / CELL) + ',' + Math.floor(y / CELL); }
    for (var i = 0; i < N; i++) {
      var s = seg(i), k = key((s[0][0] + s[1][0]) / 2, (s[0][1] + s[1][1]) / 2);
      (grid[k] = grid[k] || []).push(i);
    }
    var seen = {};
    for (var i2 = 0; i2 < N; i2++) {
      var a = seg(i2), cx = Math.floor((a[0][0] + a[1][0]) / 2 / CELL), cy = Math.floor((a[0][1] + a[1][1]) / 2 / CELL);
      for (var dx = -1; dx <= 1; dx++) for (var dy = -1; dy <= 1; dy++) {
        var list = grid[(cx + dx) + ',' + (cy + dy)]; if (!list) continue;
        for (var q = 0; q < list.length; q++) {
          var j = list[q];
          if (j < i2 + 2 || (i2 === 0 && j === N - 1) || seen[i2 * N + j]) continue;
          seen[i2 * N + j] = 1;
          var b = seg(j);
          var d = (a[1][0] - a[0][0]) * (b[1][1] - b[0][1]) - (a[1][1] - a[0][1]) * (b[1][0] - b[0][0]);
          if (!d) continue;
          var u = ((b[0][0] - a[0][0]) * (b[1][1] - b[0][1]) - (b[0][1] - a[0][1]) * (b[1][0] - b[0][0])) / d;
          var v = ((b[0][0] - a[0][0]) * (a[1][1] - a[0][1]) - (b[0][1] - a[0][1]) * (a[1][0] - a[0][0])) / d;
          if (u >= 0 && u < 1 && v >= 0 && v < 1) { var id = ev.length / 2; ev.push({ s: i2 + u, id: id }, { s: j + v, id: id }); }
        }
      }
    }
    ev.sort(function (p, q) { return p.s - q.s; });
    return ev.filter(function (e, k) { return k % 2 === 0; }).map(function (e) { return e.s; });
  })();

  // 中心線 → 4本線＋下地
  function offsetPath(pts, off, closed) {
    var n = pts.length, d = '';
    for (var i = 0; i < n; i++) {
      var a = pts[i - 1 < 0 ? (closed ? n - 1 : 0) : i - 1], b = pts[i + 1 >= n ? (closed ? 0 : n - 1) : i + 1];
      var dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      d += (i ? 'L' : 'M') + (pts[i][0] - dy / l * off).toFixed(1) + ' ' + (pts[i][1] + dx / l * off).toFixed(1);
    }
    return d + (closed ? 'Z' : '');
  }
  function cord(pts, c, lw, closed) {
    var s = '<g stroke-linecap="butt"><path d="' + offsetPath(pts, 0, closed) + '" stroke="' + c.fill + '" stroke-width="' + (GAP * 3 + lw) + '"/>';
    [-1.5, -0.5, 0.5, 1.5].forEach(function (k) {
      s += '<path d="' + offsetPath(pts, k * GAP, closed) + '" stroke="' + c.line + '" stroke-width="' + lw + '"/>';
    });
    return s + '</g>';
  }
  function knot(c, lw) {
    var s = cord(KNOT, c, lw, true), R = 14; // 交わるところで上になる紐を描き直す
    OVERS.forEach(function (p) {
      var i0 = Math.round(p), pts = [];
      for (var k = -R; k <= R; k++) pts.push(KNOT[(i0 + k + N) % N]);
      s += cord(pts, c, lw, false);
    });
    return s;
  }

  // 結びの左右のはし（紐はここから外へ出る）
  var EDGE = K * 1.2;

  // 左右にのびる紐（4本：赤・赤・赤・金）
  var BAND = [[-1.5, 'line'], [-0.5, 'line'], [0.5, 'line'], [1.5, 'gold']];
  function straightTails(c, lw, reach) {
    var s = '';
    BAND.forEach(function (b) {
      var y = (b[0] * GAP + 4).toFixed(1);
      s += '<path d="M' + (-reach) + ' ' + y + 'H' + (-EDGE) + 'M' + EDGE + ' ' + y + 'H' + reach + '" stroke="' + c[b[1]] + '" stroke-width="' + lw + '"/>';
    });
    return s;
  }
  // 波のようにゆれる紐（トップ用）：左は下へ、右は上へ
  // 左右の紐は別々の <g> にまとめる（トップを開いたとき、左右から伸びてくる動きに使う）
  function waveTails(c, lw, reach) {
    var out = { '-1': '', '1': '' };
    BAND.forEach(function (b, i) {
      [-1, 1].forEach(function (side) {
        var d = '';
        for (var x = 0; x <= reach; x += 8) {
          var u = Math.max(0, x - 70);
          if (x < EDGE) continue;                    // 結びの近くはまっすぐ
          var spread = 1 + u / 90;                        // 先へ行くほど線が広がる
          var y = b[0] * GAP * spread + 4 +
                  Math.sin(u / 260 * Math.PI + i * 0.25) * Math.min(1, u / 200) * 26 +   // ゆれ
                  u * 0.085;                              // 左は下へ（右は上へ）
          d += (d ? 'L' : 'M') + (side * x).toFixed(1) + ' ' + (side < 0 ? y : -y + 8).toFixed(1);
        }
        out[side] += '<path d="' + d + '" stroke="' + c[b[1]] + '" stroke-width="' + lw + '"/>';
      });
    });
    return '<g class="mz-tail mz-l">' + out['-1'] + '</g><g class="mz-tail mz-r">' + out['1'] + '</g>';
  }

  // opt: { set: 'kohaku' | 'kingin', h: 高さpx, cls: クラス, wave: true（トップ用） }
  window.awajiSVG = function (opt) {
    opt = opt || {};
    var c = SETS[opt.set] || SETS.kohaku;
    var lw = c.lw || 1.6, REACH = 2000;
    var BIG = 1.65; // トップの結びの大きさ（1 で元の大きさ）
    var vb = opt.wave ? '-' + REACH + ' -120 ' + (REACH * 2) + ' 240' : '-' + REACH + ' -62 ' + (REACH * 2) + ' 124';
    return '<svg class="' + (opt.cls || '') + '" style="display:block;width:100%;' + (opt.h ? 'height:' + opt.h + 'px;' : '') + '" ' +
      'viewBox="' + vb + '" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<g fill="none" stroke-linecap="round" stroke-linejoin="round">' +
      (opt.wave ? '<g transform="scale(' + BIG + ')">' + waveTails(c, lw, REACH / BIG) + '<g class="mz-knot">' + knot(c, lw) + '</g></g>' : straightTails(c, lw, REACH) + '<g class="mz-knot">' + knot(c, lw) + '</g>') +
      '</g></svg>';
  };
  window.mizuhikiSVG = window.awajiSVG;
  // 結びだけ（ほかの絵の中に入れる用。中心0,0・はば約120）
  window.umeKnotG = function (set) {
    var c = SETS[set] || SETS.kohaku;
    return '<g fill="none" stroke-linecap="round" stroke-linejoin="round">' + knot(c, c.lw || 1.6) + '</g>';
  };
})();
