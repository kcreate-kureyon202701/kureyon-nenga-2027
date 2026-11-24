// ★Googleスプレッドシートとつなぐ設定（Claudeが入れます。ふだんは触らなくてOK）
// 入力シート：Googleドライブの「くれよん新年あいさつ_入力シート」
// シートの「ウェブに公開」のCSVを読みます。読めないときは data.js の内容で表示します。
window.SHEET = {
  id: '1rcrm7m4ALW1q7LJZyrA9jAjusPsUZi6NwkbZARb7cBc', // 入力シートのID（メモ用）
  tab: '岩倉版',
  csv: {
    '岩倉版': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSD4JtCxVqVOBTAsCOJnPDKLrqrtFCDYC6vL9ImLD9n4e4lC6SqBNEsqu1JJY20jg/pub?single=true&output=csv&gid=1525996329',
    'HP全体': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSD4JtCxVqVOBTAsCOJnPDKLrqrtFCDYC6vL9ImLD9n4e4lC6SqBNEsqu1JJY20jg/pub?single=true&output=csv&gid=96532923'
  }
};