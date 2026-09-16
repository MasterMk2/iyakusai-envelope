/* フォントの読み込みと文字幅の計測。
   画面のプレビューとPDFで同じフォント・同じ幅計算を使うため、ここを唯一の計測元にする。

   読み込み方が2通りあるのは file:// 対策:
     - http(s) で開いたとき  … fonts/*.ttf を fetch する(速い)
     - index.html を直接開いたとき … ブラウザがローカルの .ttf を読めないので、
       base64 にした fonts/*.ttf.b64.js を script タグで読み込む */

App.fonts = {
  defs: [
    { id: 'regular', label: '標準', file: 'ZenKakuGothicNew-Regular.ttf', family: 'ZenKakuGothicNewApp' },
    { id: 'bold',    label: '太字', file: 'ZenKakuGothicNew-Bold.ttf',    family: 'ZenKakuGothicNewAppBold' }
  ],
  loaded: {},

  /** 全フォントを読み込む。呼び終わるまでプレビューもPDFも作れない */
  loadAll: function () {
    var self = this;
    return Promise.all(this.defs.map(function (d) { return self._load(d); }));
  },

  _load: function (def) {
    var self = this;
    return loadFontBytes(def.file).then(function (bytes) {
      var fk = window.fontkit.create(bytes);
      // 画面表示用に登録する(メモリ上のバイト列から作るので file:// でも効く)
      var buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      var face = new FontFace(def.family, buf);
      return face.load().then(function (f) {
        document.fonts.add(f);
        var m = readMetrics(fk);
        self.loaded[def.id] = {
          def: def,
          bytes: bytes,
          fk: fk,
          unitsPerEm: fk.unitsPerEm,
          // 行の基準線(ベースライン)を出すのに使う。フォント自身が持つ値。
          ascentRatio: m.ascent / fk.unitsPerEm,
          descentRatio: Math.abs(m.descent) / fk.unitsPerEm
        };
      });
    });
  },

  get: function (id) {
    return this.loaded[id] || this.loaded['regular'];
  },

  /** 文字列を size pt で組んだときの幅(pt) */
  measurePt: function (text, sizePt, id) {
    if (!text) return 0;
    var f = this.get(id);
    if (!f) return text.length * sizePt;   // フォント読み込み前の保険
    var run = f.fk.layout(text);
    return run.advanceWidth / f.unitsPerEm * sizePt;
  },

  /** このフォントに入っていない文字を返す(印刷すると空白や豆腐になる文字) */
  missingChars: function (text, id) {
    var f = this.get(id);
    if (!f || !text) return [];
    var miss = [];
    for (var i = 0; i < text.length; i++) {
      var cp = text.codePointAt(i);
      if (cp > 0xffff) i++;                       // サロゲートペアは2文字ぶん進める
      if (cp === 0x0a || cp === 0x20 || cp === 0x3000) continue;
      if (!f.fk.hasGlyphForCodePoint(cp) && miss.indexOf(text[i]) < 0) {
        miss.push(String.fromCodePoint(cp));
      }
    }
    return miss;
  }
};

/* ---- ここから下は読み込みの実装 ---- */

/* 行の高さの基準をフォントから読む。
   日本語フォントの hhea(ascent/descent)は行間を含んだ大きな値になっていることが多く
   (Zen Kaku Gothic New は 1160/-288)、そのまま使うと1行目が枠からかなり下がってしまう。
   OS/2 の typo メトリクスは漢字の四角(em)そのものを表す値(880/-120)なので、
   合計が em とほぼ同じならそちらを使う。 */
function readMetrics(fk) {
  var upm = fk.unitsPerEm;
  var os2 = fk['OS/2'];
  if (os2 && os2.typoAscender && os2.typoDescender) {
    var sum = os2.typoAscender - os2.typoDescender;
    if (sum > upm * 0.8 && sum < upm * 1.1) {
      return { ascent: os2.typoAscender, descent: os2.typoDescender };
    }
  }
  return { ascent: fk.ascent, descent: fk.descent };
}

function loadFontBytes(file) {
  return fetch('fonts/' + file)
    .then(function (res) {
      if (!res.ok) throw new Error('status ' + res.status);
      return res.arrayBuffer().then(function (ab) { return new Uint8Array(ab); });
    })
    .catch(function () {
      // file:// で開いた場合はここに来る。base64版を読む。
      return loadScriptOnce('fonts/' + file + '.b64.js').then(function () {
        var b64 = (window.__FONT_B64 || {})[file];
        if (!b64) throw new Error('フォントを読み込めませんでした: ' + file);
        return base64ToBytes(b64);
      });
    });
}

var _scriptCache = {};
function loadScriptOnce(src) {
  if (_scriptCache[src]) return _scriptCache[src];
  _scriptCache[src] = new Promise(function (resolve, reject) {
    var s = document.createElement('script');
    s.src = src;
    s.onload = function () { resolve(); };
    s.onerror = function () { reject(new Error('読み込めません: ' + src)); };
    document.head.appendChild(s);
  });
  return _scriptCache[src];
}

function base64ToBytes(b64) {
  var bin = atob(b64);
  var bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
