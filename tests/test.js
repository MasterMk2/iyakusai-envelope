/* 自己テスト。ブラウザで tests/test.html を開くと走ります。
   新しい決まりごとを入れたら、ここにもテストを1つ足してください。 */

var results = [];

function check(name, cond, detail) {
  results.push({ name: name, ok: !!cond, detail: detail || '' });
}
function near(a, b, tol) {
  return Math.abs(a - b) <= (tol === undefined ? 0.05 : tol);
}
function el(over) {
  var base = {
    id: 't', name: 'test', type: 'text',
    x: 10, y: 10, w: 80, h: 40,
    align: 'left', valign: 'top', font: 'regular',
    size_pt: 12, min_size_pt: 8, line_height: 1.5,
    vertical: false, content: ''
  };
  for (var k in over) base[k] = over[k];
  return base;
}

function run() {
  /* ---- 単位 ---- */
  check('mm→pt が正しい', near(App.mmToPt(25.4), 72, 0.001), App.mmToPt(25.4));
  check('pt→mm が正しい', near(App.ptToMm(72), 25.4, 0.001), App.ptToMm(72));

  /* ---- フォント ---- */
  var f = App.fonts.get('regular');
  check('フォントが読めている', !!f && f.unitsPerEm > 0, f && f.unitsPerEm);
  check('行の基準が em ボックス(0.88前後)である', f && near(f.ascentRatio, 0.88, 0.02),
        f && f.ascentRatio);
  check('全角は1em幅', near(App.fonts.measurePt('国', 100, 'regular'), 100, 1),
        App.fonts.measurePt('国', 100, 'regular'));
  check('半角英数は全角より狭い', App.fonts.measurePt('A', 100, 'regular') < 80,
        App.fonts.measurePt('A', 100, 'regular'));
  check('人名異体字(髙﨑濵德栁)が収録されている',
        App.fonts.missingChars('髙﨑濵德栁邊邉曻', 'regular').length === 0,
        App.fonts.missingChars('髙﨑濵德栁邊邉曻', 'regular').join(''));
  check('未収録文字(－～)は置き換えられる',
        App.fonts.missingChars(App.normalizeText('－～'), 'regular').length === 0,
        App.normalizeText('－～'));

  /* ---- 横書きの組み ---- */
  var lay = App.layout.build(el({ x: 126, y: 26, w: 96, h: 60, size_pt: 13, line_height: 1.5,
                                  content: '〒930-0000\n富山県富山市杉谷2630番地' }), null);
  check('1行目のベースライン = 枠の上 + ascent×サイズ',
        near(lay.items[0].y, 26 + App.ptToMm(13 * f.ascentRatio), 0.01), lay.items[0].y);
  check('行送り = サイズ × 行間',
        near(lay.items[1].y - lay.items[0].y, App.ptToMm(13 * 1.5), 0.01),
        lay.items[1].y - lay.items[0].y);
  check('左揃えの x は枠の左', near(lay.items[0].x, 126, 0.001), lay.items[0].x);

  var shrink = App.layout.build(el({ w: 40, size_pt: 14, min_size_pt: 8,
                                     content: 'とてもながい会社名の株式会社北陸支店' }), null);
  check('枠に入らない行は自動で縮む', shrink.sizePt < 14, shrink.sizePt);
  check('縮めても最小サイズより小さくならない', shrink.sizePt >= 8, shrink.sizePt);

  var right = App.layout.build(el({ x: 0, w: 100, align: 'right', content: 'あいう' }), null);
  check('右揃えは枠の右端で終わる',
        near(right.items[0].x + right.items[0].wMm, 100, 0.1),
        right.items[0].x + right.items[0].wMm);

  /* ---- 差し込み ---- */
  var rec = { '会社名': '見本商事', '部署役職': '', '氏名': '', '敬称': '御中' };
  var merged = App.layout.build(el({ content: '{{会社名}}\n{{部署役職}}\n{{氏名}}　{{敬称}}' }), rec);
  var texts = merged.items.map(function (i) { return i.text; });
  check('{{列名}} がデータで置き換わる', texts[0] === '見本商事', texts.join(' / '));
  check('空になった行は消える', texts.length === 2, texts.join(' / '));
  check('余った区切りの空白が詰まる(「　御中」→「御中」)', texts[1] === '御中', texts[1]);
  check('空の列は警告として拾える',
        merged.emptyFields.indexOf('氏名') >= 0, merged.emptyFields.join(','));

  check('もともと空の行は残る',
        App.layout.build(el({ content: 'A\n\nB' }), rec).items.length === 3);

  /* ---- 縦書き ---- */
  var v = App.layout.build(el({ x: 0, y: 0, w: 60, h: 120, size_pt: 20, line_height: 1.6,
                                vertical: true, align: 'right', valign: 'top',
                                content: '〒930-0194\n株式会社見本（北陸）' }), null);
  check('縦書きは1文字ずつに分かれる', v.items.length > 10, v.items.length);
  check('縦書きは上から下へ積む', v.items[1].y > v.items[0].y, v.items[0].y + ' → ' + v.items[1].y);
  var line2 = v.items.filter(function (i) { return i.text === '株'; })[0];
  check('行は右から左へ進む', line2 && line2.x < v.items[0].x, line2 && line2.x);
  check('3桁以上の数字は寝かせる',
        v.items.some(function (i) { return i.text === '0194' && i.rot === 90; }));
  check('括弧も寝かせる',
        v.items.some(function (i) { return i.text === '（' && i.rot === 90; }));
  var tate = App.layout.build(el({ vertical: true, w: 40, h: 60, size_pt: 16, content: '5号室' }), null);
  check('1〜2桁の数字は縦中横(小さくして横並び)',
        tate.items.some(function (i) { return i.text === '5' && i.rot === 0 && i.size < 16; }));

  /* ---- データの読み取り ---- */
  var TAB = String.fromCharCode(9);
  App.data.loadFromText(['〒' + TAB + '会社名', '930-0001' + TAB + '見本商事'].join('\n'), 'tsv');
  check('スプレッドシートからの貼り付け(タブ区切り)が読める',
        App.data.records.length === 1 && App.data.records[0]['会社名'] === '見本商事',
        JSON.stringify(App.data.records[0]));
  App.data.loadFromText('〒,会社名\n930-0002,カンマ商会', 'csv');
  check('カンマ区切りも読める', App.data.records[0]['会社名'] === 'カンマ商会');
  App.data.loadFromText('a,b\n"x,y",z', 'csv');
  check('ダブルクォート内のカンマを壊さない', App.data.records[0]['a'] === 'x,y',
        App.data.records[0]['a']);
  App.data.clear();

  check('スプレッドシートURLがCSVのURLに直る',
        App.toCsvUrl('https://docs.google.com/spreadsheets/d/ABC123/edit#gid=456')
          === 'https://docs.google.com/spreadsheets/d/ABC123/export?format=csv&gid=456',
        App.toCsvUrl('https://docs.google.com/spreadsheets/d/ABC123/edit#gid=456'));
  check('公開済みCSVのURLはそのまま',
        App.toCsvUrl('https://docs.google.com/spreadsheets/d/e/XYZ/pub?output=csv')
          === 'https://docs.google.com/spreadsheets/d/e/XYZ/pub?output=csv');

  /* ---- 速達の赤線(内国郵便約款 第98条) ----
     「表面の右上部に朱色の横線(横に長い郵便物は右側部に朱色の縦線)を明瞭に施す」。
     長さ・太さの数値指定は約款に無いので、日本郵便の案内図の比率を下限として見張る。
     ※ App.store を触るので、アプリの保存データを壊さないよう退避して戻す */
  var STORAGE_KEY = 'iyakusai-envelope/v1';
  var savedState = null;
  try { savedState = localStorage.getItem(STORAGE_KEY); } catch (e) {}

  ['naga3-mado', 'kaku2'].forEach(function (envId) {
    App.state.byEnvelope = {};
    App.store.setEnvelope(envId);
    App.store.elements().length = 0;
    var mark = App.store.addExpressMark();
    var env = App.envelopes[envId];
    var pa = env.printable_area;
    var yoko = env.size_mm.w > env.size_mm.h;
    var lenPct = 100 * (yoko ? mark.h / env.size_mm.h : mark.w / env.size_mm.w);

    check(env.name + ': 速達の赤線が' + (yoko ? '縦線' : '横線') + 'になる',
          yoko ? (mark.h > mark.w) : (mark.w > mark.h),
          mark.w + '×' + mark.h);
    check(env.name + ': 赤線が' + (yoko ? '右側部' : '右上部') + 'にある',
          yoko
            ? near(mark.x + mark.w, pa.x + pa.w, 2)
            : (near(mark.x + mark.w, pa.x + pa.w, 4) && mark.y < env.size_mm.h * 0.15),
          'x=' + mark.x + ' y=' + mark.y);
    check(env.name + ': 赤線の長さが案内図の比率(' + (yoko ? '高さの58%' : '幅の42%') + ')以上',
          lenPct >= (yoko ? 55 : 39), lenPct.toFixed(0) + '%');
    check(env.name + ': 赤線の太さが6mm以上(細いと見落とされる)',
          Math.min(mark.w, mark.h) >= 6, Math.min(mark.w, mark.h));
    check(env.name + ': 赤線が印刷可能範囲に収まる',
          App.contains(pa, { x: mark.x, y: mark.y, w: mark.w, h: mark.h }),
          JSON.stringify(mark));
  });

  try {
    if (savedState === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, savedState);
  } catch (e) {}

  /* ---- 封筒の定義 ---- */
  Object.keys(App.envelopes).forEach(function (id) {
    var env = App.envelopes[id];
    var box = { x: 0, y: 0, w: env.size_mm.w, h: env.size_mm.h };
    check(env.name + ': 印刷可能範囲が封筒の中にある',
          !env.printable_area || App.contains(box, env.printable_area));
    (env.windows || []).forEach(function (w) {
      check(env.name + ': 窓(' + (w.name || w.id) + ')が封筒の中にある', App.contains(box, w));
      check(env.name + ': 窓の安全余白が窓より小さい', (w.safe_margin_mm || 0) * 2 < Math.min(w.w, w.h));
    });
    (env.preprinted || []).forEach(function (p) {
      check(env.name + ': 印刷済み領域(' + (p.name || p.id) + ')が封筒の中にある', App.contains(box, p));
    });
  });

  /* ---- テンプレート ---- */
  Object.keys(App.templates).forEach(function (id) {
    var t = App.templates[id];
    check('テンプレート ' + id + ' の封筒が存在する', !!App.envelopes[t.envelope], t.envelope);
    t.elements.forEach(function (e) {
      var env = App.envelopes[t.envelope];
      check('テンプレート ' + id + ' の「' + (e.name || e.id) + '」が封筒の中にある',
            App.contains({ x: 0, y: 0, w: env.size_mm.w, h: env.size_mm.h },
                         { x: e.x, y: e.y, w: e.w, h: e.h }));
    });
  });

  show();
}

function show() {
  var tbody = document.getElementById('results');
  var ng = 0;
  results.forEach(function (r) {
    if (!r.ok) ng++;
    var tr = document.createElement('tr');
    tr.innerHTML = '<td class="res ' + (r.ok ? 'ok">PASS' : 'ng">FAIL') + '</td>' +
                   '<td>' + r.name + '</td>' +
                   '<td class="detail">' + (r.ok ? '' : String(r.detail)) + '</td>';
    tbody.appendChild(tr);
  });
  var s = document.getElementById('summary');
  s.className = ng ? 'ng' : 'ok';
  s.textContent = ng
    ? '✗ ' + ng + ' 件が FAIL（' + results.length + ' 件中）'
    : '✓ 全 ' + results.length + ' 件 PASS';
}

App.fonts.loadAll().then(run).catch(function (e) {
  document.getElementById('summary').className = 'ng';
  document.getElementById('summary').textContent = 'フォントを読み込めませんでした: ' + e.message;
});
