/* アプリの状態と保存。
   状態は「封筒ごとの配置」を持つ。封筒を切り替えても、それぞれの配置が残る。
   ブラウザを閉じても消えないように localStorage に自動保存する。 */

var STORAGE_KEY = 'iyakusai-envelope/v1';

App.state = {
  envelopeId: null,
  zoom: 3,            // 1mm を何ピクセルで描くか
  showGuides: true,
  selectedId: null,
  byEnvelope: {}      // envelopeId -> { elements: [], offset: {dx, dy} }
};

App.store = {
  /** いま選ばれている封筒の定義 */
  envelope: function () {
    return App.envelopes[App.state.envelopeId];
  },

  /** いま選ばれている封筒の配置 */
  layout: function () {
    var id = App.state.envelopeId;
    if (!App.state.byEnvelope[id]) {
      App.state.byEnvelope[id] = { elements: [], offset: { dx: 0, dy: 0 } };
    }
    return App.state.byEnvelope[id];
  },

  elements: function () { return this.layout().elements; },

  selected: function () {
    var id = App.state.selectedId;
    return this.elements().filter(function (e) { return e.id === id; })[0] || null;
  },

  select: function (id) {
    App.state.selectedId = id;
    this.save();
  },

  /** 封筒を切り替える。初めての封筒なら初期テンプレートを入れる */
  setEnvelope: function (envelopeId) {
    App.state.envelopeId = envelopeId;
    App.state.selectedId = null;
    if (!App.state.byEnvelope[envelopeId]) {
      var tpl = null;
      for (var k in App.templates) {
        if (App.templates[k].envelope === envelopeId) { tpl = App.templates[k]; break; }
      }
      App.state.byEnvelope[envelopeId] = {
        elements: tpl ? JSON.parse(JSON.stringify(tpl.elements)) : [],
        offset: { dx: 0, dy: 0 }
      };
    }
    this.save();
  },

  addText: function () {
    var env = this.envelope();
    var el = {
      id: 'el' + Date.now().toString(36),
      name: '新しいテキスト',
      type: 'text',
      x: Math.round(env.size_mm.w * 0.5),
      y: Math.round(env.size_mm.h * 0.4),
      w: Math.min(80, env.size_mm.w * 0.4),
      h: 30,
      align: 'left',
      valign: 'top',
      font: 'regular',
      size_pt: 14,
      min_size_pt: 10,
      line_height: 1.4,
      in_window: null,
      content: 'ここに文字を入れる'
    };
    this.elements().push(el);
    App.state.selectedId = el.id;
    this.save();
    return el;
  },

  /** 速達の赤線を足す。
      日本郵便のきまりでは 縦長の郵便物=右上部 / 横長の郵便物=右側部 に赤い線を入れる。
      (2026-08に長3で一度まちがえた。長3窓付は差出人が横書きで左下にあるので横長扱い) */
  addExpressMark: function () {
    var env = this.envelope();
    var W = env.size_mm.w, H = env.size_mm.h;
    var pa = env.printable_area || { x: 5, y: 5, w: W - 10, h: H - 10 };
    var yoko = W > H;   // 横長で使う封筒か
    var el = {
      id: 'el' + Date.now().toString(36),
      name: '速達の赤線',
      type: 'rect',
      color: '#d40000',
      x: 0, y: 0, w: 0, h: 0
    };
    if (yoko) {
      // 右側部 = 右端に縦の赤線
      el.w = 6; el.h = 45;
      el.x = Math.min(W - 14, pa.x + pa.w - el.w - 1);
      el.y = (H - el.h) / 2;
    } else {
      // 右上部 = 右上に横の赤線
      el.w = 45; el.h = 6;
      el.x = Math.min(W - 60, pa.x + pa.w - el.w - 1);
      el.y = Math.max(10, pa.y + 2);
    }
    this.elements().push(el);
    App.state.selectedId = el.id;
    this.save();
    return el;
  },

  remove: function (id) {
    var els = this.elements();
    for (var i = 0; i < els.length; i++) {
      if (els[i].id === id) { els.splice(i, 1); break; }
    }
    if (App.state.selectedId === id) App.state.selectedId = null;
    this.save();
  },

  offset: function () { return this.layout().offset; },

  /** 配置をテンプレートとして書き出す(委員の間で受け渡しする用) */
  exportTemplate: function () {
    var env = this.envelope();
    return {
      id: env.id + '-' + new Date().toISOString().slice(0, 10).replace(/-/g, ''),
      name: env.name + ' の配置',
      envelope: env.id,
      offset_mm: this.offset(),
      elements: this.elements()
    };
  },

  /** 書き出したテンプレートを読み込む */
  importTemplate: function (tpl) {
    if (!tpl || !tpl.envelope || !tpl.elements) throw new Error('テンプレートの形式が違います');
    if (!App.envelopes[tpl.envelope]) throw new Error('この封筒の定義がありません: ' + tpl.envelope);
    App.state.envelopeId = tpl.envelope;
    App.state.byEnvelope[tpl.envelope] = {
      elements: JSON.parse(JSON.stringify(tpl.elements)),
      offset: tpl.offset_mm || { dx: 0, dy: 0 }
    };
    App.state.selectedId = null;
    this.save();
  },

  save: function () {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(App.state));
    } catch (e) {
      // プライベートウィンドウなどで保存できないことがある。動作自体は続ける。
    }
  },

  restore: function () {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      var s = JSON.parse(raw);
      if (!s || !s.envelopeId || !App.envelopes[s.envelopeId]) return false;
      App.state = Object.assign(App.state, s);
      return true;
    } catch (e) {
      return false;
    }
  }
};
