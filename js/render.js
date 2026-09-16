/* 封筒と要素をSVGで描く。
   SVGの座標系をそのまま mm にしてある(viewBox="0 0 幅mm 高さmm")ので、
   画面に描く数値と印刷する数値が同じになる。拡大率はSVGの表示サイズだけで変える。 */

var SVGNS = 'http://www.w3.org/2000/svg';

function svg(tag, attrs, text) {
  var n = document.createElementNS(SVGNS, tag);
  for (var k in attrs) { if (attrs[k] !== undefined && attrs[k] !== null) n.setAttribute(k, attrs[k]); }
  if (text !== undefined) n.textContent = text;
  return n;
}

App.render = function () {
  var env = App.store.envelope();
  if (!env) return;
  var wrap = document.getElementById('canvasWrap');
  var W = env.size_mm.w, H = env.size_mm.h;
  var zoom = App.state.zoom;

  var root = svg('svg', {
    viewBox: '0 0 ' + W + ' ' + H,
    width: Math.round(W * zoom),
    height: Math.round(H * zoom)
  });
  root.id = 'sheet';

  // 封筒そのもの
  root.appendChild(svg('rect', { x: 0, y: 0, width: W, height: H, class: 'sv-envelope' }));

  // 下敷き(実物のスキャン画像)。封筒の上・ガイドの下に敷く
  if (App.underlay && App.underlay.loaded()) {
    var u = App.underlay.geom();
    var im = svg('image', {
      x: u.x, y: u.y, width: u.w, height: u.h,
      opacity: u.opacity,
      preserveAspectRatio: 'none',
      style: u.adjust ? 'cursor:move' : 'pointer-events:none'
    });
    im.setAttributeNS('http://www.w3.org/1999/xlink', 'href', App.underlay.img.src);
    im.setAttribute('href', App.underlay.img.src);
    if (u.adjust && App.ui && App.ui.attachUnderlayDrag) App.ui.attachUnderlayDrag(im);
    root.appendChild(im);
  }

  if (App.state.showGuides) {
    // 印刷可能範囲
    var pa = env.printable_area;
    if (pa) {
      root.appendChild(svg('rect', { x: pa.x, y: pa.y, width: pa.w, height: pa.h, class: 'sv-printable' }));
    }
    // 差出人など、封筒に最初から刷ってある部分
    // avoid:false のもの(地紋など、上に文字を置いてよいもの)は薄い枠だけにする
    (env.preprinted || []).forEach(function (p) {
      var cls = (p.avoid === false) ? 'sv-watermark' : 'sv-preprinted';
      root.appendChild(svg('rect', { x: p.x, y: p.y, width: p.w, height: p.h, class: cls }));
      root.appendChild(svg('text', { x: p.x + 1.5, y: p.y + 4, class: 'sv-guide-label' }, p.name || ''));
    });
  }

  // 窓(実物に開いている穴なので、ガイド表示を切っても描く)
  (env.windows || []).forEach(function (w) {
    root.appendChild(svg('rect', { x: w.x, y: w.y, width: w.w, height: w.h, rx: 2, class: 'sv-window' }));
    var m = w.safe_margin_mm || 0;
    if (m > 0 && App.state.showGuides) {
      root.appendChild(svg('rect', {
        x: w.x + m, y: w.y + m, width: w.w - m * 2, height: w.h - m * 2, class: 'sv-window-safe'
      }));
    }
    if (App.state.showGuides) {
      root.appendChild(svg('text', { x: w.x + 1.5, y: w.y + 4, class: 'sv-guide-label' }, w.name || '窓'));
    }
  });

  // 要素(ズレ補正ぶんをまとめて動かす)
  var off = App.store.offset();
  var layer = svg('g', { transform: 'translate(' + (off.dx || 0) + ',' + (off.dy || 0) + ')' });
  App.store.elements().forEach(function (el) {
    layer.appendChild(renderElement(el));
  });
  root.appendChild(layer);

  wrap.innerHTML = '';
  wrap.appendChild(root);
  return root;
};

function renderElement(el) {
  var g = svg('g', { class: 'sv-el', 'data-id': el.id });
  var on = (App.state.selectedId === el.id);

  // 図形(速達の赤線など)は塗るだけ
  if (el.type === 'rect') {
    g.appendChild(svg('rect', {
      x: el.x, y: el.y, width: el.w, height: el.h, fill: el.color || '#d40000'
    }));
    if (on) {
      g.appendChild(svg('rect', {
        x: el.x - 1, y: el.y - 1, width: el.w + 2, height: el.h + 2, class: 'sv-elbox on'
      }));
    }
    if (App.ui && App.ui.attachDrag) App.ui.attachDrag(g, el);
    return g;
  }

  // 枠(点線)。選択中は青くする
  g.appendChild(svg('rect', {
    x: el.x, y: el.y, width: el.w, height: el.h,
    class: 'sv-elbox' + (on ? ' on' : '')
  }));

  // 差し込みデータを読んでいれば、いま選んでいる1件を当てはめて表示する
  var lay = App.layout.build(el, App.data.current());
  var f = App.fonts.get(el.font);
  var family = f ? f.def.family : 'sans-serif';
  var sizeMm = App.ptToMm(lay.sizePt);

  lay.lines.forEach(function (ln) {
    if (!ln.text) return;
    g.appendChild(svg('text', {
      x: ln.x,
      y: ln.baselineY,
      'font-family': family,
      'font-size': sizeMm,
      fill: el.color || '#111111'
    }, ln.text));
  });

  // 当たり判定を枠全体に広げる(文字の無い所をつかんでも動かせるように)
  g.appendChild(svg('rect', {
    x: el.x, y: el.y, width: el.w, height: el.h, fill: 'transparent'
  }));

  if (App.ui && App.ui.attachDrag) App.ui.attachDrag(g, el);
  return g;
}

/** 画面のマウス座標を封筒上の mm に直す */
App.clientToMm = function (evt) {
  var sheet = document.getElementById('sheet');
  var pt = sheet.createSVGPoint();
  pt.x = evt.clientX;
  pt.y = evt.clientY;
  var p = pt.matrixTransform(sheet.getScreenCTM().inverse());
  return { x: p.x, y: p.y };
};
