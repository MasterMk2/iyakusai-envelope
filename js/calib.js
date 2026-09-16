/* 校正ページ(位置合わせ用の試し刷り)を作る。
   これを封筒に1枚刷って定規で測れば、ズレの量と印刷倍率の狂いが分かる。

   刷るもの:
     - 上と左の目盛り(5mm刻み・10mmごとに数字)… 窓や封筒の端がどこに来るか読める
     - 四隅の十字マーク(封筒の角から20mmの位置)… ズレの量を測る基準
     - 100mmのスケールバー … 定規で測って100mmでなければ印刷倍率が狂っている
     - 手順の説明と、そのとき使っていたズレ補正値

   窓の中には何も刷らない。窓のフィルムにインクが乗ると汚れるため。 */

App.calib = {
  build: function () {
    var env = App.store.envelope();
    var off = App.store.offset();
    var PDFLibRef = window.PDFLib;
    var W = env.size_mm.w, H = env.size_mm.h;
    var pa = env.printable_area || { x: 5, y: 5, w: W - 10, h: H - 10 };

    return PDFLibRef.PDFDocument.create().then(function (doc) {
      doc.registerFontkit(window.fontkit);
      return doc.embedFont(App.fonts.get('regular').bytes, { subset: false }).then(function (font) {
        var page = doc.addPage([App.mmToPt(W), App.mmToPt(H)]);
        var gray = PDFLibRef.rgb(0.45, 0.45, 0.45);
        var black = PDFLibRef.rgb(0.1, 0.1, 0.1);

        // mm(上からのy)をPDFの座標に直す
        function X(mm) { return App.mmToPt(mm); }
        function Y(mm) { return App.mmToPt(H - mm); }
        function line(x1, y1, x2, y2, w, color) {
          page.drawLine({
            start: { x: X(x1), y: Y(y1) }, end: { x: X(x2), y: Y(y2) },
            thickness: w || 0.4, color: color || gray
          });
        }
        function text(s, x, y, size, color) {
          page.drawText(s, { x: X(x), y: Y(y), size: size || 6, font: font, color: color || gray });
        }

        // --- 印刷可能範囲の枠 ---
        line(pa.x, pa.y, pa.x + pa.w, pa.y, 0.3);
        line(pa.x, pa.y + pa.h, pa.x + pa.w, pa.y + pa.h, 0.3);
        line(pa.x, pa.y, pa.x, pa.y + pa.h, 0.3);
        line(pa.x + pa.w, pa.y, pa.x + pa.w, pa.y + pa.h, 0.3);

        // --- 上の目盛り(封筒の左端からの距離) ---
        var ry = pa.y + 6;                       // 目盛りの基準線(上から)
        line(pa.x, ry, pa.x + pa.w, ry, 0.4, black);
        for (var x = Math.ceil(pa.x / 5) * 5; x <= pa.x + pa.w; x += 5) {
          var big = (x % 10 === 0);
          line(x, ry, x, ry - (big ? 4 : 2), 0.3, black);
          if (big) text(String(x), x - 2.2, ry - 5, 5, black);
        }
        text('↑ 数字は封筒の左端からの mm（左の列は上端からの mm）', pa.x + 45, ry + 4, 5);

        // --- 左の目盛り(封筒の上端からの距離) ---
        var rx = pa.x + 6;
        line(rx, pa.y, rx, pa.y + pa.h, 0.4, black);
        for (var y = Math.ceil(pa.y / 5) * 5; y <= pa.y + pa.h; y += 5) {
          var big2 = (y % 10 === 0);
          line(rx, y, rx - (big2 ? 4 : 2), y, 0.3, black);
          if (big2) text(String(y), rx + 1, y + 1.5, 5, black);
        }

        // --- 四隅の十字(印刷可能範囲の内側10mmの、キリのいい位置) ---
        var mx1 = Math.ceil(pa.x + 10), mx2 = Math.floor(pa.x + pa.w - 10);
        var my1 = Math.ceil(pa.y + 10), my2 = Math.floor(pa.y + pa.h - 10);
        [[mx1, my1], [mx2, my1], [mx1, my2], [mx2, my2]].forEach(function (p) {
          var cx = p[0], cy = p[1];
          if (cx < pa.x || cx > pa.x + pa.w || cy < pa.y || cy > pa.y + pa.h) return;
          line(cx - 5, cy, cx + 5, cy, 0.4, black);
          line(cx, cy - 5, cx, cy + 5, 0.4, black);
          text('(' + Math.round(cx) + ',' + Math.round(cy) + ')', cx + 1.5, cy - 1.5, 5, black);
        });

        // --- 窓の角を示すカギ形のマーク ---
        // ツールが思っている窓の位置を、窓の 3mm 外側に印す。刷った紙を見て、
        // マークが実物の窓の角を囲んでいなければ、窓の値かズレ補正が違う。
        (env.windows || []).forEach(function (w) {
          var g = 3, a = 6;   // g=窓から離す距離 / a=カギの腕の長さ
          var L = w.x - g, R = w.x + w.w + g, T = w.y - g, B = w.y + w.h + g;
          function inside(x, y) {
            return x >= pa.x && x <= pa.x + pa.w && y >= pa.y && y <= pa.y + pa.h;
          }
          // 印刷できない場所にはマークを出さない(ずらして出すと位置を誤解させるため)
          [[L, T, 1, 1], [R, T, -1, 1], [L, B, 1, -1], [R, B, -1, -1]].forEach(function (c) {
            if (!inside(c[0], c[1])) return;
            line(c[0], c[1], c[0] + a * c[2], c[1], 0.5, black);
            line(c[0], c[1], c[0], c[1] + a * c[3], 0.5, black);
          });
          var f1 = function (v) { return (Math.round(v * 10) / 10); };
          text('↑ カギ形のマークの内側に実物の窓が入るはず。ツールが思っている窓は' +
               ' 左' + f1(w.x) + ' / 上' + f1(w.y) + ' / 右' + f1(w.x + w.w) + ' / 下' + f1(w.y + w.h) +
               ' mm（上と左の目盛りで実物と見比べる）',
               Math.max(L, pa.x + 1), Math.min(B + 4, pa.y + pa.h - 1), 5, black);
        });

        // --- 100mm のスケールバー(窓とぶつからない高さに置く) ---
        var lowestWindow = 0;
        (env.windows || []).forEach(function (w) { lowestWindow = Math.max(lowestWindow, w.y + w.h); });
        var sx = Math.max(pa.x + 10, (W - 100) / 2);
        var sy = lowestWindow ? lowestWindow + 14 : H / 2;
        if (sx + 100 > pa.x + pa.w) sx = pa.x + 10;
        line(sx, sy, sx + 100, sy, 0.6, black);
        for (var t = 0; t <= 100; t += 10) {
          line(sx + t, sy, sx + t, sy - 3, 0.4, black);
        }
        text('← この線をはさんだ端から端が ちょうど 100mm（定規で測る）', sx, sy + 5, 6, black);

        // --- 手順と、いまのズレ補正値(スケールバーの下) ---
        var ix = rx + 6, iy = sy + 9;
        if (iy + 27 > pa.y + pa.h) iy = pa.y + pa.h - 27;
        var msg = [
          '【校正ページの使い方】',
          '1) 100mm のバーを定規で測る。100mm でなければ印刷設定を「実際のサイズ」に直してもう一度',
          '2) 十字マークの中心が、封筒の角から本当にその数字の位置にあるか測る',
          '3) ずれていた量を、画面の「ズレの補正」に 右へ/下へ の mm で入れる（マイナスも可）',
          '4) もう一度この校正ページを刷って、合っていることを確かめる',
          '',
          '封筒: ' + env.name + ' (' + W + '×' + H + 'mm)   ' +
            'このとき使った補正: 右へ ' + (off.dx || 0) + 'mm / 下へ ' + (off.dy || 0) + 'mm   ' +
            new Date().toLocaleString('ja-JP')
        ];
        msg.forEach(function (s, i) {
          text(s, ix, iy + i * 3.9, i === 0 ? 6.5 : 5.5, black);
        });

        doc.setTitle('校正ページ ' + env.name);
        doc.setCreator('医薬祭 封筒印刷ツール');
        return doc.save();
      });
    });
  },

  download: function () {
    var env = App.store.envelope();
    return this.build().then(function (bytes) {
      var name = '校正ページ_' + env.name + '.pdf';
      var blob = new Blob([bytes], { type: 'application/pdf' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      return name;
    });
  }
};
