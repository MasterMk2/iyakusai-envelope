/* 下敷き(実物の封筒をスキャン/撮影した画像)を封筒の下に薄く敷く。
   ツールが思っている窓や差出人の位置と、実物がどれだけ違うかを目で見比べるためのもの。
   画像は画面に映すだけで、PDFには入らない。

   画像そのものはブラウザのメモリにだけ置き、保存しない
   (スキャン画像は数MBあり localStorage に入らないため。位置と大きさだけ覚える)。 */

App.underlay = {
  img: null,        // Image オブジェクト(読み込み後)
  fileName: '',
  natural: { w: 0, h: 0 },

  /** 位置と大きさ(mm)。封筒の左上が原点 */
  geom: function () {
    var lay = App.store.layout();
    if (!lay.underlay) {
      var env = App.store.envelope();
      lay.underlay = { x: 0, y: 0, w: env.size_mm.w, h: env.size_mm.h, opacity: 0.35, adjust: false };
    }
    return lay.underlay;
  },

  loaded: function () { return !!this.img; },

  /** 画像ファイルを読む */
  load: function (file) {
    var self = this;
    return new Promise(function (resolve, reject) {
      if (/\.pdf$/i.test(file.name)) {
        reject(new Error('PDFは読めません。スキャンをPNGかJPEGで保存してから読み込んでください'));
        return;
      }
      var fr = new FileReader();
      fr.onload = function () {
        var im = new Image();
        im.onload = function () {
          self.img = im;
          self.fileName = file.name;
          self.natural = { w: im.naturalWidth, h: im.naturalHeight };
          self.fitToEnvelope();
          resolve(file.name);
        };
        im.onerror = function () { reject(new Error('画像として読めませんでした')); };
        im.src = fr.result;
      };
      fr.onerror = function () { reject(new Error('ファイルを読めませんでした')); };
      fr.readAsDataURL(file);
    });
  },

  /** 封筒いっぱいに合わせる(縦横比は保つ) */
  fitToEnvelope: function () {
    var env = App.store.envelope();
    var g = this.geom();
    var ar = this.natural.h ? this.natural.w / this.natural.h : 1;
    var W = env.size_mm.w, H = env.size_mm.h;
    if (W / H > ar) { g.h = H; g.w = H * ar; } else { g.w = W; g.h = W / ar; }
    g.x = (W - g.w) / 2;
    g.y = (H - g.h) / 2;
    App.store.save();
  },

  /** 幅を変えたら高さも縦横比どおりに動かす */
  setWidth: function (w) {
    var g = this.geom();
    var ar = this.natural.h ? this.natural.w / this.natural.h : 1;
    g.w = w;
    g.h = w / ar;
    App.store.save();
  },

  clear: function () {
    this.img = null;
    this.fileName = '';
    this.natural = { w: 0, h: 0 };
    var lay = App.store.layout();
    delete lay.underlay;
    App.store.save();
  }
};
