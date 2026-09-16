/* PDFを作る。
   ページの大きさは封筒の実寸そのもの。印刷するときは必ず
   「実際のサイズ」「用紙に合わせる=OFF」で刷ること(縮小されると全部ズレる)。

   画面と同じ App.layout.build() の結果を使うので、画面で合っていれば紙でも同じ位置に出る。
   PDFのy座標は下から数える決まりなので、そこだけ変換している。 */

App.pdf = {
  build: function () {
    var env = App.store.envelope();
    var off = App.store.offset();
    var els = App.store.elements();
    var PDFLibRef = window.PDFLib;

    return PDFLibRef.PDFDocument.create().then(function (doc) {
      doc.registerFontkit(window.fontkit);

      // 使っている書体だけ埋め込む
      var used = {};
      els.forEach(function (el) { used[el.font || 'regular'] = true; });

      var embeds = {};
      var chain = Promise.resolve();
      Object.keys(used).forEach(function (fid) {
        chain = chain.then(function () {
          var bytes = App.fonts.get(fid).bytes;
          // ★ subset: false は必須。
          //   pdf-lib のサブセット化(subset:true)はこの日本語フォントだと壊れ、
          //   PDFの文字が虫食いになる(「〒930-0000」が「30-0000」になる等)。
          //   厄介なことに、壊れていてもPDFからの文字列抽出は正常に見えるので、
          //   直したときは必ず「画像にして目で見る」こと。
          //   丸ごと埋め込むとPDFは1.5MBほどになるが、フォントは1つのPDFに1回しか
          //   入らないので、25通まとめても同じくらいの大きさで済む。
          return doc.embedFont(bytes, { subset: false })
            .then(function (f) { embeds[fid] = f; });
        });
      });

      return chain.then(function () {
        var wPt = App.mmToPt(env.size_mm.w);
        var hPt = App.mmToPt(env.size_mm.h);

        // 差し込みデータを読んでいれば、選んだ件数ぶんのページを作る。
        // 読んでいなければ、いま画面に見えているものを1ページだけ作る。
        var records = App.data.loaded() ? App.data.selectedRecords() : [null];
        if (!records.length) records = [null];

        records.forEach(function (rec) {
          var page = doc.addPage([wPt, hPt]);
          els.forEach(function (el) {
            var lay = App.layout.build(el, rec);
            var font = embeds[el.font || 'regular'];
            var col = hexToRgb(el.color || '#111111');
            lay.lines.forEach(function (ln) {
              if (!ln.text) return;
              page.drawText(ln.text, {
                x: App.mmToPt(ln.x + (off.dx || 0)),
                y: hPt - App.mmToPt(ln.baselineY + (off.dy || 0)),
                size: lay.sizePt,
                font: font,
                color: PDFLibRef.rgb(col[0], col[1], col[2])
              });
            });
          });
        });

        doc.setTitle('封筒印刷 ' + env.name);
        doc.setCreator('医薬祭 封筒印刷ツール');
        doc.setProducer('医薬祭 封筒印刷ツール');
        return doc.save();
      });
    });
  },

  /** PDFを作って新しいタブで開く(そのまま Ctrl+P で印刷できる)。
      ブラウザに邪魔されないよう、タブはボタンを押した瞬間に開いておいて、
      できあがったPDFを後からそのタブに読み込ませる。 */
  openForPrint: function (win) {
    var self = this;
    return this.build().then(function (bytes) {
      var blob = new Blob([bytes], { type: 'application/pdf' });
      var url = URL.createObjectURL(blob);
      if (win) { win.location.href = url; return 'opened'; }
      var w2 = window.open(url, '_blank');
      if (w2) return 'opened';
      // ブラウザにポップアップを止められたときは、保存に切り替える(黙って失敗させない)
      URL.revokeObjectURL(url);
      return self.download().then(function () { return 'downloaded'; });
    });
  },

  /** PDFを作って保存する */
  download: function () {
    var env = App.store.envelope();
    var n = App.data.loaded() ? App.data.selectedCount() : 1;
    return this.build().then(function (bytes) {
      var name = '封筒_' + env.name + '_' + n + '件_' + ymd() + '.pdf';
      var blob = new Blob([bytes], { type: 'application/pdf' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      return name;
    });
  }
};

function hexToRgb(hex) {
  var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return [0.07, 0.08, 0.09];
  return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255];
}

function ymd() {
  var d = new Date();
  var p = function (n) { return (n < 10 ? '0' : '') + n; };
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate());
}
