/* 差し込みデータ(宛名の一覧)の読み込み。
   CSV(UTF-8 / BOM付き / Shift_JIS)と Excel(.xlsx)に対応する。

   読んだデータはブラウザの中だけに置き、保存もどこかへの送信もしない。
   (宛名は企業の個人情報なので、localStorage にも残さない。開き直したら読み直す) */

App.data = {
  fileName: '',
  sheetNames: [],
  sheetIndex: 0,
  columns: [],
  records: [],      // [{列名: 値, ...}, ...]
  selected: [],     // records と同じ長さの true/false
  previewIndex: 0,
  _raw: null,       // xlsx のシート切り替え用に元のバイト列を持っておく

  loaded: function () { return this.records.length > 0; },

  /** いまプレビューしている1件(データ未読み込みなら null) */
  current: function () {
    if (!this.records.length) return null;
    return this.records[Math.min(this.previewIndex, this.records.length - 1)];
  },

  selectedRecords: function () {
    var recs = [];
    for (var i = 0; i < this.records.length; i++) {
      if (this.selected[i]) recs.push(this.records[i]);
    }
    return recs;
  },

  selectedCount: function () {
    return this.selected.filter(Boolean).length;
  },

  setAll: function (on) {
    for (var i = 0; i < this.selected.length; i++) this.selected[i] = on;
  },

  clear: function () {
    this.fileName = '';
    this.sheetNames = [];
    this.sheetIndex = 0;
    this.columns = [];
    this.records = [];
    this.selected = [];
    this.previewIndex = 0;
    this._raw = null;
  },

  /** ファイルを読む。戻り値は Promise */
  load: function (file) {
    var self = this;
    return file.arrayBuffer().then(function (ab) {
      var bytes = new Uint8Array(ab);
      self.fileName = file.name;
      if (/\.xlsx?$/i.test(file.name)) {
        self._raw = bytes;
        var wb = XLSX.read(bytes, { type: 'array' });
        self.sheetNames = wb.SheetNames.slice();
        self.sheetIndex = 0;
        self._useSheet(wb, 0);
      } else {
        self._raw = null;
        self.sheetNames = [];
        var rows = parseCsv(decodeBytes(bytes));
        self._setRows(rows);
      }
      return self.records.length;
    });
  },

  /** コピーして貼り付けた表を読む(Googleスプレッドシートからのコピーはタブ区切り) */
  loadFromText: function (text, name) {
    if (!text || !text.trim()) throw new Error('中身が空です');
    var head = text.split('\n')[0];
    var rows = (head.indexOf('\t') >= 0) ? parseTsv(text) : parseCsv(text);
    this.fileName = name || '貼り付けた表';
    this.sheetNames = [];
    this._raw = null;
    this._setRows(rows);
    if (!this.records.length) throw new Error('見出し行とデータ行が読み取れませんでした');
    return this.records.length;
  },

  /** 「ウェブに公開」したスプレッドシートのURLから読む。
     ブラウザの制限(CORS)で読めないことがあるので、そのときは貼り付けを案内する */
  loadFromUrl: function (url) {
    var self = this;
    var csvUrl = toCsvUrl(url);
    return fetch(csvUrl).then(function (res) {
      if (!res.ok) throw new Error('status ' + res.status);
      return res.text();
    }).then(function (t) {
      if (/^\s*<(!doctype|html)/i.test(t)) throw new Error('html');
      return self.loadFromText(t, 'スプレッドシート');
    }).catch(function () {
      throw new Error('URLからは読めませんでした。シートが「ウェブに公開」されていないか、'
        + 'ブラウザが他サイトの読み込みを止めています。'
        + 'スプレッドシートで見出し行ごと範囲をコピーして「貼り付けて読む」を使うのが確実です。');
    });
  },

  /** Excelのシートを切り替える */
  useSheet: function (index) {
    if (!this._raw) return;
    var wb = XLSX.read(this._raw, { type: 'array' });
    this.sheetIndex = index;
    this._useSheet(wb, index);
  },

  _useSheet: function (wb, index) {
    var ws = wb.Sheets[wb.SheetNames[index]];
    var rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
    this._setRows(rows);
  },

  _setRows: function (rows) {
    // 最初の「中身のある行」を見出しとして扱う
    var head = -1;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].some(function (c) { return String(c).trim() !== ''; })) { head = i; break; }
    }
    if (head < 0) { this.columns = []; this.records = []; this.selected = []; return; }

    this.columns = rows[head].map(function (c, i) {
      var name = String(c).trim();
      return name || ('列' + (i + 1));
    });

    var recs = [];
    for (var r = head + 1; r < rows.length; r++) {
      var row = rows[r];
      if (!row || !row.some(function (c) { return String(c).trim() !== ''; })) continue;  // 空行は飛ばす
      var obj = {};
      for (var c2 = 0; c2 < this.columns.length; c2++) {
        obj[this.columns[c2]] = String(row[c2] === undefined ? '' : row[c2]).trim();
      }
      recs.push(obj);
    }
    this.records = recs;
    this.selected = recs.map(function () { return true; });
    this.previewIndex = 0;
  },

  /** 一覧に出すときの見出し(会社名などがあればそれを使う) */
  labelOf: function (rec) {
    var keys = ['宛名を1行にしたもの', '会社名', '宛名', '氏名', '名前'];
    for (var i = 0; i < keys.length; i++) {
      if (rec[keys[i]]) return rec[keys[i]];
    }
    return rec[this.columns[0]] || '(空)';
  }
};

/** {{列名}} をデータの値に置き換える */
App.fillPlaceholders = function (s, rec) {
  if (!s) return '';
  if (!rec) return s;
  return s.replace(/\{\{\s*([^}]+?)\s*\}\}/g, function (_, key) {
    var v = rec[key];
    return (v === undefined || v === null) ? '' : String(v);
  });
};

/** 文中の {{列名}} を列挙する */
App.placeholdersIn = function (s) {
  var out = [], m, re = /\{\{\s*([^}]+?)\s*\}\}/g;
  while ((m = re.exec(s || ''))) { if (out.indexOf(m[1]) < 0) out.push(m[1]); }
  return out;
};

/* ---- CSVの読み取り ---- */

/** 文字コードを判定して文字列にする(UTF-8 / BOM付き / Shift_JIS) */
function decodeBytes(bytes) {
  if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3));
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (e) {
    // UTF-8として読めない = Excelが書き出したShift_JISのCSVとみなす
    return new TextDecoder('shift_jis').decode(bytes);
  }
}

/** タブ区切り(スプレッドシートからのコピー)の読み取り */
function parseTsv(text) {
  return text.replace(/\r\n?/g, '\n').split('\n').map(function (line) {
    return line.split('\t');
  });
}

/** スプレッドシートのURLを、CSVで取り出せるURLに直す(動作確認しやすいよう App にも出す) */
App.toCsvUrl = toCsvUrl;
function toCsvUrl(url) {
  url = (url || '').trim();
  if (/output=csv|format=csv/.test(url)) return url;            // すでにCSVのURL
  var m = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/.exec(url);
  if (!m) return url;
  var gid = (/[#&?]gid=([0-9]+)/.exec(url) || [])[1] || '0';
  return 'https://docs.google.com/spreadsheets/d/' + m[1] + '/export?format=csv&gid=' + gid;
}

/** ダブルクォート・セル内改行に対応したCSV読み取り */
function parseCsv(text) {
  var rows = [], row = [], cur = '', quoted = false;
  for (var i = 0; i < text.length; i++) {
    var c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else quoted = false;
      } else cur += c;
    } else {
      if (c === '"') quoted = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\r') { /* CRLF の CR は捨てる */ }
      else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else cur += c;
    }
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
