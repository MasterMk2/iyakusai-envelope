// 長3窓付に宛名を直接印刷するときの初期配置。
// 2026-08の請求書発送で実際に使った位置(窓と差出人を避けた右側の帯 x=126〜222mm)が元になっている。
// 最初に開いたときだけ使われる。動かした結果はブラウザに保存される。
TEMPLATE({
  "id": "naga3-atena",
  "name": "長3窓付 / 宛名(封筒に直接印刷)",
  "envelope": "naga3-mado",
  "offset_mm": { "dx": 0, "dy": 0 },
  "elements": [
    {
      "id": "atena",
      "name": "宛名",
      "type": "text",
      "x": 126, "y": 26, "w": 96, "h": 60,
      "align": "left", "valign": "top",
      "font": "regular",
      "size_pt": 13, "min_size_pt": 9, "line_height": 1.5,
      "in_window": null,
      "content": "〒930-0000\n富山県富山市○○町1丁目2-3\n\n株式会社○○○○\n代表取締役　○○　○○　様"
    }
  ]
});
