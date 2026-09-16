/* テキスト要素を「描く文字の並び」に組む処理。
   画面のプレビューもPDFもこの結果(items)だけを見て描くので、
   画面で合っていれば印刷でも同じ位置に出る。

   items の1件 = { text, x, y, rot, size }
     x, y … mm。rot=0 なら (x, y) は行の左端・ベースライン
                rot=90 なら (x, y) を中心に時計回りに90度回して下へ読ませる
     size  … pt

   横書きのきまり:
     - 改行(\n)で行を分ける。自動折り返しはしない(封筒の宛名は自分で改行を決めた方が事故らない)
     - {{列名}} は差し込みデータの値に置き換える
     - 差し込みの結果が空になった行は消す。もともと空の行(意図的な1行あけ)は残す
     - 枠の幅に収まらない行があれば、収まるまでフォントサイズを 0.25pt ずつ下げる(min_size_pt まで)
     - 行送りは フォントサイズ × 行間、ベースラインは行の上端 + フォントの ascent

   縦書きのきまり:
     - 文字を上から下へ積み、行は右から左へ進む
     - 長音符・括弧・ダッシュは90度回す
     - 数字1〜2桁は縦中横(横に並べて1文字ぶんの枠に収める)、3桁以上と英字は90度回す
     - 句読点(、。)は枠の右上に寄せる */

/* 90度回して使う文字 */
var ROTATE_CHARS = 'ー〜～―‐−-（）()「」『』【】〔〕《》〈〉｛｝{}[]［］…‥';
/* 右上に寄せる文字 */
var CORNER_CHARS = '、。，．';

App.layout = {
  /** el: 要素 / record: 差し込む1件(無ければ {{列名}} はそのまま残る) */
  build: function (el, record) {
    var lines = fillLines(el, record);
    return el.vertical ? buildVertical(el, lines, record) : buildHorizontal(el, lines, record);
  }
};

/** 差し込みを済ませた行の配列を作る */
function fillLines(el, record) {
  var lines = (el.content || '').split('\n')
    .map(function (line) {
      var filled = App.fillPlaceholders(line, record);
      // 空の列が混じった行は、余った区切りの空白を詰める
      // (「{{氏名}}　{{敬称}}」で氏名が空 → 「　御中」ではなく「御中」にする)
      var hasEmpty = record && App.placeholdersIn(line).some(function (k) {
        return !String(record[k] === undefined ? '' : record[k]).trim();
      });
      if (hasEmpty) {
        filled = filled.replace(/[ 　]{2,}/g, '　').replace(/^[ 　]+|[ 　]+$/g, '');
      }
      return { src: line, out: App.normalizeText(filled) };
    })
    .filter(function (o) {
      // 差し込みで空になった行だけ落とす
      return !(record && /\{\{/.test(o.src) && o.out.trim() === '');
    })
    .map(function (o) { return o.out; });
  return lines.length ? lines : [''];
}

function common(el, record, lines, sizePt, shrunk, items, ink, overflowW, overflowH) {
  return {
    sizePt: sizePt,
    shrunk: shrunk,
    items: items,
    lines: items,                 // 以前の呼び名(互換)
    overflowW: overflowW,
    overflowH: overflowH,
    missing: App.fonts.missingChars(lines.join(''), el.font),
    /** 差し込みデータ側が空だった列(宛名が欠けたまま刷る事故を防ぐ) */
    emptyFields: record ? App.placeholdersIn(el.content || '').filter(function (k) {
      return !String(record[k] === undefined ? '' : record[k]).trim();
    }) : [],
    /** 実際に文字が載っている範囲(mm)。窓に収まるかの判定に使う */
    inkBox: function () { return ink; }
  };
}

/* ---------------- 横書き ---------------- */

function buildHorizontal(el, lines, record) {
  var f = App.fonts.get(el.font);
  var boxWpt = App.mmToPt(el.w);
  var size = el.size_pt;
  var min = Math.min(el.min_size_pt || el.size_pt, el.size_pt);

  var widest = function (sz) {
    var m = 0;
    for (var i = 0; i < lines.length; i++) {
      m = Math.max(m, App.fonts.measurePt(lines[i], sz, el.font));
    }
    return m;
  };

  var shrunk = false;
  while (size > min && widest(size) > boxWpt) {
    size = Math.round((size - 0.25) * 100) / 100;
    shrunk = true;
  }

  var lineAdvMm = App.ptToMm(size * (el.line_height || 1.4));
  var blockHmm = lineAdvMm * lines.length;
  var top = el.y;
  if (el.valign === 'middle') top = el.y + (el.h - blockHmm) / 2;
  else if (el.valign === 'bottom') top = el.y + el.h - blockHmm;

  var ascentMm = App.ptToMm(size * (f ? f.ascentRatio : 0.88));
  var items = [], maxLineWmm = 0, minX = Infinity, maxX = -Infinity;

  for (var i = 0; i < lines.length; i++) {
    var wMm = App.ptToMm(App.fonts.measurePt(lines[i], size, el.font));
    maxLineWmm = Math.max(maxLineWmm, wMm);
    var x = el.x;
    if (el.align === 'center') x = el.x + (el.w - wMm) / 2;
    else if (el.align === 'right') x = el.x + el.w - wMm;
    items.push({ text: lines[i], x: x, y: top + i * lineAdvMm + ascentMm, baselineY: top + i * lineAdvMm + ascentMm, rot: 0, size: size, wMm: wMm });
    if (lines[i]) { minX = Math.min(minX, x); maxX = Math.max(maxX, x + wMm); }
  }

  var ink = (minX === Infinity)
    ? { x: el.x, y: el.y, w: 0, h: 0 }
    : { x: minX, y: top, w: maxX - minX, h: blockHmm };

  return common(el, record, lines, size, shrunk, items, ink,
                maxLineWmm > el.w + 0.01, blockHmm > el.h + 0.01);
}

/* ---------------- 縦書き ---------------- */

/** 1行を「枠1つぶんのかたまり」に切り分ける */
function cellsOf(line) {
  var cells = [], i = 0;
  while (i < line.length) {
    var ch = line[i];
    if (/[0-9]/.test(ch)) {
      var run = '';
      while (i < line.length && /[0-9]/.test(line[i])) { run += line[i]; i++; }
      if (run.length <= 2) cells.push({ text: run, kind: 'tate' });     // 縦中横
      else cells.push({ text: run, kind: 'rot' });                      // 3桁以上は寝かせる
      continue;
    }
    if (/[A-Za-z@:\/.]/.test(ch)) {
      var run2 = '';
      while (i < line.length && /[A-Za-z0-9@:\/._-]/.test(line[i])) { run2 += line[i]; i++; }
      cells.push({ text: run2, kind: 'rot' });
      continue;
    }
    if (ROTATE_CHARS.indexOf(ch) >= 0) { cells.push({ text: ch, kind: 'rot' }); i++; continue; }
    if (CORNER_CHARS.indexOf(ch) >= 0) { cells.push({ text: ch, kind: 'corner' }); i++; continue; }
    cells.push({ text: ch, kind: 'up' });
    i++;
  }
  return cells;
}

/** かたまりが縦に占める高さ(em単位) */
function cellHeightEm(cell, sizePt, fontId) {
  if (cell.kind === 'rot') {
    return App.ptToMm(App.fonts.measurePt(cell.text, sizePt, fontId)) / App.ptToMm(sizePt);
  }
  return 1;   // 上向き・縦中横・句読点は1文字ぶん
}

function buildVertical(el, lines, record) {
  var f = App.fonts.get(el.font);
  var ascent = f ? f.ascentRatio : 0.88;
  var size = el.size_pt;
  var min = Math.min(el.min_size_pt || el.size_pt, el.size_pt);
  var cellLines = lines.map(cellsOf);

  // 縦に入る高さと、行数ぶんの幅が収まるまで縮める
  var fits = function (sz) {
    var emMm = App.ptToMm(sz);
    var maxH = 0;
    cellLines.forEach(function (cells) {
      var h = 0;
      cells.forEach(function (c) { h += cellHeightEm(c, sz, el.font); });
      maxH = Math.max(maxH, h * emMm);
    });
    var totalW = cellLines.length * emMm * (el.line_height || 1.4);
    return { h: maxH, w: totalW, ok: maxH <= el.h + 0.01 && totalW <= el.w + 0.01 };
  };

  var shrunk = false, m = fits(size);
  while (size > min && !m.ok) {
    size = Math.round((size - 0.25) * 100) / 100;
    m = fits(size);
    shrunk = true;
  }

  var emMm = App.ptToMm(size);
  var lineAdvMm = emMm * (el.line_height || 1.4);
  var blockWmm = cellLines.length * lineAdvMm;

  // 行は右から左へ。横の揃えは枠の中でのかたまりの置き方
  var rightEdge = el.x + el.w;
  if (el.align === 'left') rightEdge = el.x + blockWmm;
  else if (el.align === 'center') rightEdge = el.x + (el.w + blockWmm) / 2;

  var items = [], minY = Infinity, maxY = -Infinity;

  cellLines.forEach(function (cells, li) {
    var colCenter = rightEdge - (li + 0.5) * lineAdvMm;
    var colH = 0;
    cells.forEach(function (c) { colH += cellHeightEm(c, size, el.font) * emMm; });

    var top = el.y;
    if (el.valign === 'middle') top = el.y + (el.h - colH) / 2;
    else if (el.valign === 'bottom') top = el.y + el.h - colH;

    var cy = top;
    cells.forEach(function (c) {
      var hMm = cellHeightEm(c, size, el.font) * emMm;
      if (c.kind === 'rot') {
        // 90度寝かせる。回した後は ascent 側が右に出るので、その分だけ左へ置く
        items.push({ text: c.text, x: colCenter - (ascent - 0.5) * emMm, y: cy, rot: 90, size: size });
      } else if (c.kind === 'tate') {
        // 縦中横: 小さくして1枠に横並び
        var s2 = size * 0.55;
        var wMm = App.ptToMm(App.fonts.measurePt(c.text, s2, el.font));
        items.push({
          text: c.text, x: colCenter - wMm / 2,
          y: cy + (emMm - App.ptToMm(s2)) / 2 + App.ptToMm(s2) * ascent,
          rot: 0, size: s2
        });
      } else if (c.kind === 'corner') {
        // 句読点は枠の右上へ
        items.push({ text: c.text, x: colCenter - emMm / 2 + emMm * 0.5, y: cy + ascent * emMm - emMm * 0.5, rot: 0, size: size });
      } else {
        items.push({ text: c.text, x: colCenter - emMm / 2, y: cy + ascent * emMm, rot: 0, size: size });
      }
      cy += hMm;
    });

    if (cells.length) { minY = Math.min(minY, top); maxY = Math.max(maxY, top + colH); }
  });

  var ink = (minY === Infinity)
    ? { x: el.x, y: el.y, w: 0, h: 0 }
    : { x: rightEdge - blockWmm, y: minY, w: blockWmm, h: maxY - minY };

  return common(el, record, lines, size, shrunk, items, ink,
                blockWmm > el.w + 0.01, (maxY - minY) > el.h + 0.01);
}
