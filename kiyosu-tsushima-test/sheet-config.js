// ★Googleスプレッドシートとつなぐ設定（Claudeが入れます。ふだんは触らなくてOK）
// 入力シート：Googleドライブの「くれよん新年あいさつ_入力シート」
// シートの「ウェブに公開」のCSVを読みます。読めないときは data.js の内容で表示します。
window.SHEET = {
  id: '1rcrm7m4ALW1q7LJZyrA9jAjusPsUZi6NwkbZARb7cBc', // 入力シートのID（メモ用）
  tab: '清須津島版',
  // くれよんのホームページ（フッターのリンク）。決まったら '' の中にURLを入れる。空ならリンクは出ない
  kureyonUrl: '',
  csv: {
    '清須津島版': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQt5MN-n5Rumm0JXsKrDD1frR9ZJvw3nvdE7nc18PI2ZspdtGv2H02f_rYb-uIVFBESWnl3G4OF3cur/pub?single=true&output=csv&gid=582696573',
    'HP全体': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQt5MN-n5Rumm0JXsKrDD1frR9ZJvw3nvdE7nc18PI2ZspdtGv2H02f_rYb-uIVFBESWnl3G4OF3cur/pub?single=true&output=csv&gid=96532923'
  }
};