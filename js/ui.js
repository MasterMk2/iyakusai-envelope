/* 画面まわり: 要素一覧・プロパティ編集・ドラッグ・点検の表示。 */

App.ui = {
  /** 画面を描き直す。panel:true のときは右のプロパティ欄も作り直す(入力中は作り直さない) */
  refresh: function (opt) {
    opt = opt || {};
    App.render();
    this.buildList();
    if (opt.panel) this.buildPanel();
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

    // 内容
    var ta = document.createElement('textarea');
    ta.rows = 5;
    ta.value = el.content || '';
    field('文字(改行はそのまま反映されます)', ta);
    onEdit('content', ta);

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

  /* ---- 点検 ---- */
  runChecks: function () {
    var env = App.store.envelope();
    var off = App.store.offset();
    var ul = document.getElementById('checkList');
    var msgs = [];

    App.store.elements().forEach(function (el) {
      var lay = App.layout.build(el);
      var label = el.name || '要素';
      var box = { x: el.x + (off.dx || 0), y: el.y + (off.dy || 0), w: el.w, h: el.h };
      var ink = lay.inkBox();
      ink = { x: ink.x + (off.dx || 0), y: ink.y + (off.dy || 0), w: ink.w, h: ink.h };

      // 枠に入りきらない
      if (lay.overflowW) msgs.push(label + ': 最小サイズまで縮めても幅に入りません');
      if (lay.overflowH) msgs.push(label + ': 行数が多く、枠の高さを超えています');

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

      // フォントに無い文字
      if (lay.missing.length) {
        msgs.push(label + ': この書体に無い文字があります → ' + lay.missing.join(' '));
      }
    });

    ul.innerHTML = '';
    if (!msgs.length) {
      var ok = document.createElement('li');
      ok.className = 'ok';
      ok.textContent = '問題は見つかりませんでした。';
      ul.appendChild(ok);
      return;
    }
    msgs.forEach(function (m) {
      var li = document.createElement('li');
      li.className = 'ng';
      li.textContent = '⚠ ' + m;
      ul.appendChild(li);
    });
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
