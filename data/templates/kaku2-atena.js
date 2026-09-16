// 角2に宛名を印刷するときの初期配置。
// 2026-08の手渡し3社ぶんで使った位置(宛名 x=58mm・y=118mm / 社名28pt・氏名24pt)が元になっている。
TEMPLATE({
  "id": "kaku2-atena",
  "name": "角2 / 宛名",
  "envelope": "kaku2",
  "offset_mm": { "dx": 0, "dy": 0 },
  "elements": [
    {
      "id": "jusho",
      "name": "住所",
      "type": "text",
      "x": 58, "y": 96, "w": 150, "h": 20,
      "align": "left", "valign": "top",
      "font": "regular",
      "size_pt": 14, "min_size_pt": 10, "line_height": 1.5,
      "in_window": null,
      "content": "〒930-0000\n富山県富山市○○町1丁目2-3"
    },
    {
      "id": "kaisha",
      "name": "会社名",
      "type": "text",
      "x": 58, "y": 122, "w": 150, "h": 16,
      "align": "left", "valign": "top",
      "font": "bold",
      "size_pt": 28, "min_size_pt": 16, "line_height": 1.3,
      "in_window": null,
      "content": "株式会社○○○○"
    },
    {
      "id": "shimei",
      "name": "氏名",
      "type": "text",
      "x": 58, "y": 145, "w": 150, "h": 14,
      "align": "left", "valign": "top",
      "font": "regular",
      "size_pt": 24, "min_size_pt": 14, "line_height": 1.3,
      "in_window": null,
      "content": "代表取締役　○○　○○　様"
    }
  ]
});
