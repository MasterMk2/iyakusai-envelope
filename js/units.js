/* 単位換算と文字の手当て。
   このツールの座標はすべて「封筒の左上を原点とする mm」。
   フォントサイズだけは印刷の慣習に合わせて pt を使う(1pt = 1/72インチ = 0.3528mm)。 */

App.mmToPt = function (mm) { return mm / 25.4 * 72; };
App.ptToMm = function (pt) { return pt * 25.4 / 72; };

/** 数値を小数1桁の文字列にする(画面表示用) */
App.fmt = function (n) { return (Math.round(n * 10) / 10).toString(); };

/* 同梱フォント(Zen Kaku Gothic New)に入っていない文字を、見た目がほぼ同じ字に置き換える。
   例: 全角ハイフンマイナス(－ U+FF0D)は未収録なので、マイナス記号(− U+2212)にする。
   ここに足せば他の文字も救済できる。 */
App.CHAR_SUBST = {
  '－': '−',   // U+FF0D -> U+2212
  '～': '〜'    // U+FF5E -> U+301C
};

/** 差し込みや手入力の文字を、印刷できる形に正規化する */
App.normalizeText = function (s) {
  if (!s) return '';
  var out = '';
  for (var i = 0; i < s.length; i++) {
    var ch = s[i];
    out += (App.CHAR_SUBST[ch] !== undefined) ? App.CHAR_SUBST[ch] : ch;
  }
  return out;
};

/** 矩形が矩形に完全に入っているか(mm) */
App.contains = function (outer, inner) {
  return inner.x >= outer.x &&
         inner.y >= outer.y &&
         inner.x + inner.w <= outer.x + outer.w &&
         inner.y + inner.h <= outer.y + outer.h;
};

/** 2つの矩形が重なっているか(mm) */
App.overlaps = function (a, b) {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x ||
           a.y + a.h <= b.y || b.y + b.h <= a.y);
};
