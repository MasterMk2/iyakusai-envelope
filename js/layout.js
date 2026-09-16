/* テキスト要素を「行の並び」に組む処理。
   画面のプレビューもPDFもこの関数の結果だけを見て描くので、
   画面で合っていれば印刷でも同じ位置に出る。

   組み方のきまり:
     - 改行(\n)で行を分ける。自動折り返しはしない(封筒の宛名は自分で改行を決めた方が事故らない)
     - 枠の幅に収まらない行があれば、収まるまでフォントサイズを 0.25pt ずつ下げる(min_size_pt まで)
     - 行送りは フォントサイズ × 行間
     - 各行のベースラインは 行の上端 + フォントの ascent */

App.layout = {
  build: function (el) {
    var f = App.fonts.get(el.font);
    var text = App.normalizeText(el.content || '');
    var lines = text.split('\n');
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

    var out = [];
    var maxLineWmm = 0;
    for (var i = 0; i < lines.length; i++) {
      var wMm = App.ptToMm(App.fonts.measurePt(lines[i], size, el.font));
      maxLineWmm = Math.max(maxLineWmm, wMm);
      var x = el.x;
      if (el.align === 'center') x = el.x + (el.w - wMm) / 2;
      else if (el.align === 'right') x = el.x + el.w - wMm;
      out.push({
        text: lines[i],
        x: x,
        baselineY: top + i * lineAdvMm + ascentMm,
        wMm: wMm
      });
    }

    return {
      sizePt: size,
      shrunk: shrunk,
      lines: out,
      blockHmm: blockHmm,
      maxLineWmm: maxLineWmm,
      overflowW: maxLineWmm > el.w + 0.01,      // 最小サイズまで下げても入らなかった
      overflowH: blockHmm > el.h + 0.01,        // 行数が多くて枠の高さを超えた
      missing: App.fonts.missingChars(text, el.font),
      /** 実際に文字が載っている範囲(mm)。窓に収まるかの判定に使う */
      inkBox: function () {
        if (!out.length) return { x: el.x, y: el.y, w: 0, h: 0 };
        var minX = Infinity, maxX = -Infinity;
        for (var j = 0; j < out.length; j++) {
          if (!out[j].text) continue;
          minX = Math.min(minX, out[j].x);
          maxX = Math.max(maxX, out[j].x + out[j].wMm);
        }
        if (minX === Infinity) return { x: el.x, y: el.y, w: 0, h: 0 };
        return { x: minX, y: top, w: maxX - minX, h: blockHmm };
      }
    };
  }
};
