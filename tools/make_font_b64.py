# fonts/*.ttf から fonts/*.ttf.b64.js を作り直すスクリプト。
#
# なぜ必要か:
#   index.html を file:// で直接開いたとき、ブラウザはセキュリティ上の理由で
#   ローカルの .ttf を fetch できない。そこで base64 にしてJSとして読み込む。
#   GitHub Pages など http(s) 経由で開いた場合は .ttf を直接読むのでこれは使わない。
#
# 使い方:  py tools/make_font_b64.py
# フォントを差し替えたときだけ実行すればよい。

import base64
import pathlib

FONT_DIR = pathlib.Path(__file__).resolve().parent.parent / "fonts"

HEADER = """// {name} を base64 で埋め込んだもの(index.html を file:// で直接開いたとき用)。
// 自動生成: py tools/make_font_b64.py で作り直せる。手で編集しないこと。
window.__FONT_B64 = window.__FONT_B64 || {{}};
window.__FONT_B64["{name}"] = "{b64}";
"""


def main() -> None:
    ttfs = sorted(FONT_DIR.glob("*.ttf"))
    if not ttfs:
        print("fonts/ に .ttf がありません")
        return
    for ttf in ttfs:
        b64 = base64.b64encode(ttf.read_bytes()).decode("ascii")
        out = FONT_DIR / (ttf.name + ".b64.js")
        out.write_text(HEADER.format(name=ttf.name, b64=b64), encoding="utf-8")
        print(f"{ttf.name}: {ttf.stat().st_size:,} bytes -> {out.name}: {out.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
