/* 封筒定義とテンプレートの登録先。
   data/ 配下のファイルはここで定義した ENVELOPE() / TEMPLATE() を呼ぶので、
   index.html では必ずこのファイルを先に読み込むこと。 */

window.App = window.App || {};

App.envelopes = {};   // id -> 封筒定義
App.templates = {};   // id -> 初期配置テンプレート

/** 封筒定義を登録する(data/envelopes/*.js から呼ばれる) */
function ENVELOPE(def) {
  App.envelopes[def.id] = def;
}

/** 初期配置テンプレートを登録する(data/templates/*.js から呼ばれる) */
function TEMPLATE(def) {
  App.templates[def.id] = def;
}
