/* 画面まわり: 要素一覧・プロパティ編集・ドラッグ・点検の表示。 */

App.ui = {
  /** 画面を描き直す。
      panel:true … 右のプロパティ欄も作り直す(文字を入力している最中は作り直さない)
      data:true  … 差し込みデータの一覧も作り直す */
  refresh: function (opt) {
    opt = opt || {};
    App.render();
    this.buildList();
    if (opt.panel) this.buildPanel();
    if (opt.data) this.buildDataPanel(); else this.updateRecordNav();
    this.runChecks();
  },

  /* ---- 要素一覧 ---- */
  buildList: function () {
    var ul = document.getElementById('elementList');
    ul.innerHTML = '';
    var els = App.store.elements();
    if (!els.length) {
      ul.innerHTML = '<li class="muted">まだ何もありません。「テキストを追加」から作ってください。</li>';
      return;
    }
    els.forEach(function (el) {
      var li = document.createElement('li');
      if (el.id === App.state.selectedId) li.className = 'on';
      var name = document.createElement('span');
      name.className = 'name';
      name.textContent = el.name || '(名前なし)';
      li.appendChild(name);

      var del = document.createElement('button');
      del.textContent = '削除';
      del.addEventListener('click', function (ev) {
        ev.stopPropagation();
        if (!confirm('「' + (el.name || '') + '」を削除します。よろしいですか?')) return;
        App.store.remove(el.id);
        App.ui.refresh({ panel: true });
      });
      li.appendChild(del);

      li.addEventListener('click', function () {
        App.store.select(el.id);
        App.ui.refresh({ panel: true });
      });
      ul.appendChild(li);
    });
  },

  /* ---- プロパティ ---- */
  buildPanel: function () {
    var body = document.getElementById('propBody');
    var el = App.store.selected();
    body.innerHTML = '';
    this._contentTextarea = null;
    if (!el) {
      body.innerHTML = '<p class="muted">要素を選ぶとここで編集できます。</p>';
      return;
    }
    var env = App.store.envelope();

    function field(labelText, node) {
      var d = document.createElement('div');
      d.className = 'field';
      var l = document.createElement('label');
      l.textContent = labelText;
      d.appendChild(l);
      d.appendChild(node);
      body.appendChild(d);
      return node;
    }

    function onEdit(prop, node, cast) {
      node.addEventListener('input', function () {
        var v = cast ? cast(node.value) : node.value;
        if (cast && isNaN(v)) return;
        el[prop] = v;
        App.store.save();
        App.ui.refresh({ panel: false });
      });
    }

    // 名前
    var nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = el.name || '';
    nameInput.style.width = '100%';
    field('名前(一覧での表示)', nameInput);
    nameInput.addEventListener('input', function () {
      el.name = nameInput.value;
      App.store.save();
      App.ui.buildList();
    });

    // 図形(速達の赤線など)は、位置・大きさ・色だけ
    if (el.type === 'rect') {
      var rpos = document.createElement('div');
      rpos.className = 'row';
      [['x', '左から'], ['y', '上から'], ['w', '幅'], ['h', '高さ']].forEach(function (p) {
        var lab = document.createElement('label');
        lab.textContent = p[1];
        var inp = document.createElement('input');
        inp.type = 'number'; inp.step = '0.5'; inp.value = el[p[0]];
        inp.style.width = '64px';
        lab.appendChild(inp);
        lab.appendChild(document.createTextNode('mm'));
        rpos.appendChild(lab);
        onEdit(p[0], inp, parseFloat);
      });
      field('位置と大きさ(封筒の左上からのmm)', rpos);

      var colorInput = document.createElement('input');
      colorInput.type = 'text';
      colorInput.value = el.color || '#d40000';
      colorInput.style.width = '120px';
      field('色(#rrggbb)', colorInput);
      onEdit('color', colorInput);

      var note = document.createElement('p');
      note.className = 'muted small';
      note.textContent = '速達の赤線は、縦長の郵便物なら右上部、横長なら右側部に入れるきまりです。';
      body.appendChild(note);
      return;
    }

    // 内容
    var ta = document.createElement('textarea');
    ta.rows = 5;
    ta.value = el.content || '';
    field('文字(改行はそのまま反映されます。{{列名}} は差し込みデータで置き換わります)', ta);
    onEdit('content', ta);
    this._contentTextarea = ta;   // 列名ボタンからの差し込み先

    // 位置とサイズ
    var pos = document.createElement('div');
    pos.className = 'row';
    [['x', '左から'], ['y', '上から'], ['w', '幅'], ['h', '高さ']].forEach(function (p) {
      var lab = document.createElement('label');
      lab.textContent = p[1];
      var inp = document.createElement('input');
      inp.type = 'number';
      inp.step = '0.5';
      inp.value = el[p[0]];
      inp.style.width = '64px';
      lab.appendChild(inp);
      lab.appendChild(document.createTextNode('mm'));
      pos.appendChild(lab);
      onEdit(p[0], inp, parseFloat);
    });
    field('位置と枠の大きさ(封筒の左上からのmm)', pos);

    // 文字の設定
    var fontRow = document.createElement('div');
    fontRow.className = 'row';

    var fsel = document.createElement('select');
    App.fonts.defs.forEach(function (d) {
      var o = document.createElement('option');
      o.value = d.id; o.textContent = d.label;
      if (el.font === d.id) o.selected = true;
      fsel.appendChild(o);
    });
    var fl = document.createElement('label'); fl.textContent = '書体'; fl.appendChild(fsel);
    fontRow.appendChild(fl);
    onEdit('font', fsel);

    [['size_pt', '大きさ', '0.5'], ['min_size_pt', '最小', '0.5'], ['line_height', '行間', '0.05']].forEach(function (p) {
      var lab = document.createElement('label');
      lab.textContent = p[1];
      var inp = document.createElement('input');
      inp.type = 'number'; inp.step = p[2]; inp.value = el[p[0]];
      inp.style.width = '62px';
      lab.appendChild(inp);
      fontRow.appendChild(lab);
      onEdit(p[0], inp, parseFloat);
    });
    field('文字(大きさはpt。枠に入らなければ最小まで自動で縮みます)', fontRow);

    // 揃え
    var alignRow = document.createElement('div');
    alignRow.className = 'row';
    var asel = document.createElement('select');
    [['left', '左'], ['center', '中央'], ['right', '右']].forEach(function (a) {
      var o = document.createElement('option'); o.value = a[0]; o.textContent = a[1];
      if (el.align === a[0]) o.selected = true;
      asel.appendChild(o);
    });
    var al = document.createElement('label'); al.textContent = '横'; al.appendChild(asel);
    alignRow.appendChild(al);
    onEdit('align', asel);

    var vsel = document.createElement('select');
    [['top', '上'], ['middle', '中央'], ['bottom', '下']].forEach(function (a) {
      var o = document.createElement('option'); o.value = a[0]; o.textContent = a[1];
      if (el.valign === a[0]) o.selected = true;
      vsel.appendChild(o);
    });
    var vl = document.createElement('label'); vl.textContent = '縦'; vl.appendChild(vsel);
    alignRow.appendChild(vl);
    onEdit('valign', vsel);
    field('枠の中での揃え', alignRow);

    // 窓に出すかどうか
    if ((env.windows || []).length) {
      var wsel = document.createElement('select');
      var none = document.createElement('option');
      none.value = ''; none.textContent = '窓に出さない(封筒に直接印刷)';
      wsel.appendChild(none);
      env.windows.forEach(function (w) {
        var o = document.createElement('option');
        o.value = w.id; o.textContent = (w.name || w.id) + ' に出す';
        if (el.in_window === w.id) o.selected = true;
        wsel.appendChild(o);
      });
      wsel.style.width = '100%';
      field('窓との関係(「窓に出す」にすると窓からはみ出さないか点検します)', wsel);
      wsel.addEventListener('change', function () {
        el.in_window = wsel.value || null;
        App.store.save();
        App.ui.refresh({ panel: false });
      });
    }
  },

  /* ---- ドラッグ ---- */
  attachDrag: function (g, el) {
    g.addEventListener('pointerdown', function (ev) {
      if (ev.button !== 0) return;
      ev.preventDefault();
      var start = App.clientToMm(ev);
      var ox = el.x, oy = el.y;
      var moved = false;

      App.store.select(el.id);
      App.ui.refresh({ panel: true });

      function move(e2) {
        var now = App.clientToMm(e2);
        var dx = now.x - start.x, dy = now.y - start.y;
        // 0.5mm刻みに吸着。Altを押している間は自由に動かせる
        var step = e2.altKey ? 0.1 : 0.5;
        el.x = Math.round((ox + dx) / step) * step;
        el.y = Math.round((oy + dy) / step) * step;
        moved = true;
        App.render();
      }
      function up() {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
        if (moved) {
          App.store.save();
          App.ui.refresh({ panel: true });
        }
      }
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
    });
  },

  /* ---- 差し込みデータ ---- */
  buildDataPanel: function () {
    var d = App.data;
    var info = document.getElementById('dataInfo');
    var chips = document.getElementById('columnChips');
    var list = document.getElementById('recordList');
    var sheetRow = document.getElementById('sheetRow');

    chips.innerHTML = '';
    list.innerHTML = '';
    sheetRow.innerHTML = '';
    sheetRow.hidden = true;
    document.getElementById('btnClearData').hidden = !d.loaded();
    document.getElementById('dataButtons').hidden = !d.loaded();
    document.getElementById('recordNav').hidden = !d.loaded();

    if (!d.loaded()) {
      info.innerHTML = '文字の中に <code>{{会社名}}</code> のように書いておくと、1件ずつ置き換わります。';
      return;
    }

    var used = App.store.elements().some(function (el) {
      return App.placeholdersIn(el.content || '').length > 0;
    });
    info.textContent = d.fileName + ' / ' + d.records.length + '件。' + (used
      ? '下の列名を押すと、選んでいる要素の文字に差し込み欄が入ります。'
      : 'まだ差し込み欄がありません。「要素」で宛名を選び、下の列名を押してください。');

    // Excelでシートが複数あるときは選べるようにする
    if (d.sheetNames.length > 1) {
      sheetRow.hidden = false;
      var lab = document.createElement('label');
      lab.textContent = 'シート';
      var sel = document.createElement('select');
      d.sheetNames.forEach(function (n, i) {
        var o = document.createElement('option');
        o.value = i; o.textContent = n;
        if (i === d.sheetIndex) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener('change', function () {
        d.useSheet(parseInt(sel.value, 10));
        App.ui.refresh({ panel: false, data: true });
      });
      sheetRow.appendChild(lab);
      sheetRow.appendChild(sel);
    }

    // 列名のボタン
    d.columns.forEach(function (col) {
      var b = document.createElement('button');
      b.textContent = col;
      b.title = '{{' + col + '}} を差し込む';
      b.addEventListener('click', function () { App.ui.insertPlaceholder(col); });
      chips.appendChild(b);
    });

    // 1件ずつの一覧(チェックを外した件は刷らない)
    d.records.forEach(function (rec, i) {
      var li = document.createElement('li');
      li.dataset.index = i;
      if (i === d.previewIndex) li.className = 'on';

      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!d.selected[i];
      cb.addEventListener('change', function () {
        d.selected[i] = cb.checked;
        App.ui.updateRecordNav();
        App.ui.runChecks();
      });
      li.appendChild(cb);

      var no = document.createElement('span');
      no.className = 'rno';
      no.textContent = (i + 1) + '.';
      li.appendChild(no);

      var name = document.createElement('span');
      name.className = 'rlabel';
      name.textContent = d.labelOf(rec);
      name.addEventListener('click', function () {
        d.previewIndex = i;
        App.ui.refresh({ panel: false, data: true });
      });
      li.appendChild(name);

      list.appendChild(li);
    });

    this.updateRecordNav();
  },

  updateRecordNav: function () {
    var d = App.data;
    var lab = document.getElementById('recLabel');
    if (!d.loaded()) { lab.textContent = ''; return; }
    var rec = d.current();
    lab.textContent = (d.previewIndex + 1) + ' / ' + d.records.length + '件目：' +
      d.labelOf(rec) + '（印刷する件数 ' + d.selectedCount() + '）';
  },

  /** 列名のボタンを押したとき、文字の入力欄に {{列名}} を差し込む */
  insertPlaceholder: function (col) {
    var el = App.store.selected();
    var ta = this._contentTextarea;
    if (!el || !ta) {
      this.toast('先に「要素」から、差し込みたいテキストを選んでください', true);
      return;
    }
    var ins = '{{' + col + '}}';
    var s = ta.selectionStart || 0, e = ta.selectionEnd || 0;
    ta.value = ta.value.slice(0, s) + ins + ta.value.slice(e);
    ta.selectionStart = ta.selectionEnd = s + ins.length;
    ta.focus();
    el.content = ta.value;
    App.store.save();
    this.refresh({ panel: false });
  },

  /* ---- 点検 ---- */

  /** 1件ぶんの点検。record が null なら差し込み無しの状態で見る */
  checkRecord: function (record) {
    var env = App.store.envelope();
    var off = App.store.offset();
    var msgs = [];

    App.store.elements().forEach(function (el) {
      var label = el.name || '要素';
      var box = { x: el.x + (off.dx || 0), y: el.y + (off.dy || 0), w: el.w, h: el.h };
      var lay = (el.type === 'rect') ? null : App.layout.build(el, record);
      var ink = box;
      if (lay) {
        var ib = lay.inkBox();
        ink = { x: ib.x + (off.dx || 0), y: ib.y + (off.dy || 0), w: ib.w, h: ib.h };
        // 枠に入りきらない
        if (lay.overflowW) msgs.push(label + ': 最小サイズまで縮めても幅に入りません');
        if (lay.overflowH) msgs.push(label + ': 行数が多く、枠の高さを超えています');
      }

      // 印刷可能範囲の外
      if (env.printable_area && !App.contains(env.printable_area, box)) {
        msgs.push(label + ': 印刷可能範囲からはみ出しています');
      }

      // 封筒に刷ってある部分と重なる(地紋のように上に刷ってよいものは avoid:false で除外)
      (env.preprinted || []).forEach(function (p) {
        if (p.avoid === false) return;
        if (App.overlaps(p, ink)) msgs.push(label + ': 「' + (p.name || p.id) + '」と重なっています');
      });

      // 窓との関係
      (env.windows || []).forEach(function (w) {
        var m = w.safe_margin_mm || 0;
        var safe = { x: w.x + m, y: w.y + m, w: w.w - m * 2, h: w.h - m * 2 };
        if (el.in_window === w.id) {
          if (!App.contains(safe, ink)) {
            msgs.push(label + ': 窓の安全範囲(内側' + m + 'mm)に収まっていません');
          }
        } else if (App.overlaps(w, ink)) {
          msgs.push(label + ': 窓「' + (w.name || w.id) + '」に掛かっています(窓に出さない設定です)');
        }
      });

      if (lay) {
        // フォントに無い文字
        if (lay.missing.length) {
          msgs.push(label + ': この書体に無い文字があります → ' + lay.missing.join(' '));
        }
        // 差し込みデータ側が空(宛名が欠けたまま刷る事故を防ぐ)
        if (lay.emptyFields && lay.emptyFields.length) {
          msgs.push(label + ': ' + lay.emptyFields.join('・') + ' が空です');
        }
      }
    });

    return msgs;
  },

  /** 画面に見えている1件を点検して表示する。差し込みデータがあれば残りも少し遅れて点検する */
  runChecks: function () {
    var ul = document.getElementById('checkList');
    var msgs = this.checkRecord(App.data.current());

    ul.innerHTML = '';
    if (!msgs.length) {
      var ok = document.createElement('li');
      ok.className = 'ok';
      ok.textContent = App.data.loaded()
        ? '表示中の1件は問題ありません。'
        : '問題は見つかりませんでした。';
      ul.appendChild(ok);
    } else {
      msgs.forEach(function (m) {
        var li = document.createElement('li');
        li.className = 'ng';
        li.textContent = '⚠ ' + m;
        ul.appendChild(li);
      });
    }

    this.updateWarnBadge(msgs.length, null);

    // 全件の点検は件数ぶん時間がかかるので、入力が落ち着いてから走らせる
    clearTimeout(this._batchTimer);
    if (App.data.loaded()) {
      this._batchTimer = setTimeout(function () { App.ui.runBatchChecks(); }, 400);
    }
  },

  /** 上のバーに警告の数を出す(点検欄は下にあって見落とすため) */
  updateWarnBadge: function (current, badRecords) {
    var b = document.getElementById('warnBadge');
    if (badRecords !== null && badRecords !== undefined) {
      if (badRecords > 0) {
        b.hidden = false;
        b.textContent = '⚠ ' + badRecords + '件に警告';
        return;
      }
      if (!current) { b.hidden = true; return; }
    }
    if (current > 0) {
      b.hidden = false;
      b.textContent = '⚠ 警告 ' + current + '件';
    } else if (!App.data.loaded()) {
      b.hidden = true;
    }
  },

  /** 印刷する全件を点検し、問題のある件を一覧に出す */
  runBatchChecks: function () {
    var d = App.data;
    var ul = document.getElementById('checkList');
    var listItems = document.querySelectorAll('#recordList li');
    var bad = [];

    for (var i = 0; i < d.records.length; i++) {
      if (listItems[i]) listItems[i].classList.remove('ng');
      if (!d.selected[i]) continue;
      var m = this.checkRecord(d.records[i]);
      if (m.length) {
        bad.push({ i: i, label: d.labelOf(d.records[i]), msgs: m });
        if (listItems[i]) listItems[i].classList.add('ng');
      }
    }

    var head = document.createElement('li');
    var n = d.selectedCount();
    this.updateWarnBadge(0, bad.length);
    if (!bad.length) {
      head.className = 'ok';
      head.textContent = '印刷する' + n + '件すべて問題ありません。';
      ul.appendChild(head);
      this._batchBad = 0;
      return;
    }
    head.className = 'ng';
    head.textContent = '⚠ 印刷する' + n + '件のうち ' + bad.length + '件に警告があります';
    ul.appendChild(head);

    bad.slice(0, 8).forEach(function (b) {
      var li = document.createElement('li');
      li.className = 'ng';
      li.textContent = '　' + (b.i + 1) + '. ' + b.label + ' — ' + b.msgs.join(' / ');
      ul.appendChild(li);
    });
    if (bad.length > 8) {
      var more = document.createElement('li');
      more.className = 'ng';
      more.textContent = '　…ほか ' + (bad.length - 8) + '件（一覧で赤くなっている行）';
      ul.appendChild(more);
    }
    this._batchBad = bad.length;
  },

  hasWarnings: function () {
    return document.querySelectorAll('#checkList li.ng').length > 0;
  },

  toast: function (msg, isError) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast' + (isError ? ' ng' : '');
    t.hidden = false;
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.hidden = true; }, isError ? 6000 : 3000);
  }
};
