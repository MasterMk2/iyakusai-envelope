/* 起動処理とボタンの配線。 */

(function () {
  var wrap = document.getElementById('canvasWrap');
  wrap.innerHTML = '<p class="muted" style="padding:40px">フォントを読み込んでいます…</p>';

  App.fonts.loadAll().then(start).catch(function (e) {
    wrap.innerHTML = '<p style="padding:40px;color:#b91c1c">フォントを読み込めませんでした: ' +
      (e && e.message ? e.message : e) + '</p>';
  });

  function start() {
    // 封筒の選択肢を作る
    var sel = document.getElementById('envelopeSelect');
    Object.keys(App.envelopes).forEach(function (id) {
      var o = document.createElement('option');
      o.value = id;
      o.textContent = App.envelopes[id].name;
      sel.appendChild(o);
    });

    // 前回の続きから。無ければ最初の封筒
    if (!App.store.restore()) {
      App.store.setEnvelope(Object.keys(App.envelopes)[0]);
    }
    sel.value = App.state.envelopeId;
    document.getElementById('zoom').value = App.state.zoom;
    document.getElementById('showGuides').checked = App.state.showGuides;
    syncOffsetInputs();

    sel.addEventListener('change', function () {
      App.store.setEnvelope(sel.value);
      syncOffsetInputs();
      App.ui.refresh({ panel: true });
    });

    document.getElementById('zoom').addEventListener('input', function (e) {
      App.state.zoom = parseFloat(e.target.value);
      App.store.save();
      App.render();
    });

    document.getElementById('showGuides').addEventListener('change', function (e) {
      App.state.showGuides = e.target.checked;
      App.store.save();
      App.render();
    });

    document.getElementById('warnBadge').addEventListener('click', function () {
      document.getElementById('checkPanel').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    document.getElementById('btnAddText').addEventListener('click', function () {
      App.store.addText();
      App.ui.refresh({ panel: true });
    });

    ['offDx', 'offDy'].forEach(function (id) {
      document.getElementById(id).addEventListener('input', function (e) {
        var v = parseFloat(e.target.value);
        if (isNaN(v)) return;
        App.store.offset()[id === 'offDx' ? 'dx' : 'dy'] = v;
        App.store.save();
        App.ui.refresh({ panel: false });
      });
    });

    /* ---- 差し込みデータ ---- */
    var fileData = document.getElementById('fileData');
    document.getElementById('btnLoadData').addEventListener('click', function () { fileData.click(); });
    fileData.addEventListener('change', function () {
      var f = fileData.files[0];
      if (!f) return;
      App.data.load(f).then(function (n) {
        App.ui.refresh({ panel: false, data: true });
        App.ui.toast(f.name + ' から ' + n + '件を読み込みました');
      }).catch(function (e) {
        App.data.clear();
        App.ui.refresh({ panel: false, data: true });
        App.ui.toast('読み込めませんでした: ' + (e && e.message ? e.message : e), true);
      });
      fileData.value = '';
    });

    document.getElementById('btnClearData').addEventListener('click', function () {
      App.data.clear();
      App.ui.refresh({ panel: false, data: true });
    });

    document.getElementById('btnSelectAll').addEventListener('click', function () {
      App.data.setAll(true);
      App.ui.refresh({ panel: false, data: true });
    });
    document.getElementById('btnSelectNone').addEventListener('click', function () {
      App.data.setAll(false);
      App.ui.refresh({ panel: false, data: true });
    });

    document.getElementById('btnPrevRec').addEventListener('click', function () {
      if (App.data.previewIndex > 0) App.data.previewIndex--;
      App.ui.refresh({ panel: false, data: true });
    });
    document.getElementById('btnNextRec').addEventListener('click', function () {
      if (App.data.previewIndex < App.data.records.length - 1) App.data.previewIndex++;
      App.ui.refresh({ panel: false, data: true });
    });

    document.getElementById('btnSaveTpl').addEventListener('click', function () {
      var tpl = App.store.exportTemplate();
      var blob = new Blob([JSON.stringify(tpl, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = tpl.id + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      App.ui.toast('配置をファイルに保存しました');
    });

    var fileTpl = document.getElementById('fileTpl');
    document.getElementById('btnLoadTpl').addEventListener('click', function () { fileTpl.click(); });
    fileTpl.addEventListener('change', function () {
      var f = fileTpl.files[0];
      if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        try {
          App.store.importTemplate(JSON.parse(fr.result));
          document.getElementById('envelopeSelect').value = App.state.envelopeId;
          syncOffsetInputs();
          App.ui.refresh({ panel: true });
          App.ui.toast('配置を読み込みました');
        } catch (e) {
          App.ui.toast('読み込めませんでした: ' + e.message, true);
        }
      };
      fr.readAsText(f);
      fileTpl.value = '';
    });

    document.getElementById('btnPdf').addEventListener('click', function () {
      if (App.data.loaded() && App.data.selectedCount() === 0) {
        App.ui.toast('印刷する件にチェックが入っていません', true);
        return;
      }
      if (App.ui.hasWarnings() &&
          !confirm('点検で警告が出ています。このままPDFを作りますか?')) return;
      var btn = this;
      btn.disabled = true;
      App.pdf.download().then(function (name) {
        App.ui.toast(name + ' を保存しました。印刷は「実際のサイズ」で。');
      }).catch(function (e) {
        App.ui.toast('PDFを作れませんでした: ' + (e && e.message ? e.message : e), true);
      }).then(function () {
        btn.disabled = false;
      });
    });

    App.ui.refresh({ panel: true, data: true });
  }

  function syncOffsetInputs() {
    var off = App.store.offset();
    document.getElementById('offDx').value = off.dx || 0;
    document.getElementById('offDy').value = off.dy || 0;
  }
})();
