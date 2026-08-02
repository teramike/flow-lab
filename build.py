#!/usr/bin/env python3
"""
Bundle Flow Lab into one self-contained HTML file.

Everything gets inlined: Three.js, the mp4 muxer, the stylesheet, the six JS
modules, and the webfonts as base64 data URIs. The result opens from disk with
no server, no network, and no build step, which is the whole pitch.

    python3 build.py            writes flow-lab.html
    python3 build.py --out DIR  also copies it to DIR/index.html
"""

import base64, pathlib, re, sys, urllib.request

ROOT = pathlib.Path(__file__).parent
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

GOOGLE_FONTS = ("https://fonts.googleapis.com/css2"
                "?family=Fraunces:ital,wght@0,300;0,600;1,300;1,600"
                "&family=JetBrains+Mono:wght@400;500"
                "&family=Inter:wght@400;600&display=swap")

JS_ORDER = ["shader", "state", "render", "panels", "exports", "main"]


def read(p):
    return (ROOT / p).read_text(encoding="utf-8")


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    return urllib.request.urlopen(req).read()


def inline_fonts():
    """Latin subsets only, no italics. The full Google set is 38 faces across
    cyrillic, greek and vietnamese, which triples the bundle for nothing."""
    css = fetch(GOOGLE_FONTS).decode("utf-8")
    blocks = re.findall(r"/\*\s*([\w\-\[\]]+)\s*\*/\s*(@font-face\s*\{[^}]*\})", css)
    out, total = [], 0
    for name, block in blocks:
        if name != "latin" or "font-style: italic" in block:
            continue
        m = re.search(r"url\((https://[^)]+)\)", block)
        if not m:
            continue
        data = fetch(m.group(1))
        total += len(data)
        uri = "data:font/woff2;base64," + base64.b64encode(data).decode()
        out.append(block.replace(m.group(1), uri))
    print(f"  fonts: {len(out)} faces, {round(total/1024)} KB")
    return "\n".join(out)


def build():
    html = read("index.html")

    print("Inlining:")
    fonts_css = inline_fonts()
    style = read("css/style.css")
    print(f"  style.css: {round(len(style)/1024)} KB")

    three = (ROOT / "vendor/three.min.js").read_text(encoding="utf-8")
    muxer = (ROOT / "vendor/mp4-muxer.min.js").read_text(encoding="utf-8")
    print(f"  three.js: {round(len(three)/1024)} KB")
    print(f"  mp4-muxer: {round(len(muxer)/1024)} KB")

    app = []
    for name in JS_ORDER:
        src = read(f"js/{name}.js")
        app.append(f"/* ---- {name}.js ---- */\n{src}")
        print(f"  {name}.js: {round(len(src)/1024)} KB")
    app_js = "\n".join(app)

    # Strip every external reference, then inject the inlined equivalents.
    html = re.sub(r'\s*<link rel="preconnect"[^>]*>', "", html)
    html = re.sub(r'\s*<link href="https://fonts\.googleapis[^>]*>', "", html)
    html = re.sub(r'\s*<link rel="stylesheet" href="css/style\.css">', "", html)
    html = re.sub(r'\s*<script src="https://[^"]*"></script>', "", html)
    html = re.sub(r'\s*<script src="js/[^"]*"></script>', "", html)

    head_bundle = (
        "<style>\n" + fonts_css + "\n" + style + "\n</style>\n"
        "<script>" + three + "</script>\n"
        "<script>" + muxer + "</script>"
    )
    html = html.replace("</head>", head_bundle + "\n</head>", 1)
    html = html.replace("</body>", "<script>\n" + app_js + "\n</script>\n</body>", 1)

    # Credit, visible to anyone who opens the file in an editor.
    html = html.replace("<head>", "<head>\n<!--\n"
        "  Flow Lab, generative backgrounds in one HTML file.\n"
        "  Made by Miguel, https://x.com/teramike_\n"
        "  Free to use, no attribution required. Yours to take apart.\n"
        "-->", 1)

    out = ROOT / "flow-lab.html"
    out.write_text(html, encoding="utf-8")
    kb = round(out.stat().st_size / 1024)
    print(f"\nflow-lab.html: {kb} KB, one file, no dependencies")

    if "--out" in sys.argv:
        dest = pathlib.Path(sys.argv[sys.argv.index("--out") + 1]).expanduser()
        dest.mkdir(parents=True, exist_ok=True)
        (dest / "index.html").write_text(html, encoding="utf-8")
        print(f"copied to {dest / 'index.html'}")


if __name__ == "__main__":
    build()
