# CJK outlines

`motion-cjk.json` contains 50 vector glyphs from Noto Sans TC, weight 850, under
SIL OFL 1.1. The complete upstream notice is in `OFL.txt`. These paths are shared
by real extruded meshes and Canvas particle/contour masks. They do not depend on
a system font or remote font loading. Unsupported text fails with a rebuild hint.

Included: `流動光影文字世界水形態設計`, uppercase A–Z, digits 0–9 and a full stop.
Normal rendering needs only the checked-in JSON. To change the supported set:

```sh
python3 -m venv /tmp/motion-fonts
/tmp/motion-fonts/bin/pip install -r tools/requirements-fonts.txt
# Obtain NotoSansTC[wght].ttf from https://github.com/google/fonts/tree/main/ofl/notosanstc
/tmp/motion-fonts/bin/python tools/build-cjk-font.py /path/to/NotoSansTC.ttf \
  --text '流動光影文字世界水形態設計ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.'
```

`--text` replaces the supported set. Include glyphs needed by existing films.
The exporter instantiates the variable font at weight 850 and retains the original
units and advance widths. Keep the font's licence with any replacement asset.
