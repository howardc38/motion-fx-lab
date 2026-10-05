#!/usr/bin/env python3
"""Export licensed OpenType outlines for deterministic 3D and canvas typography.
Usage: python3 tools/build-cjk-font.py FONT.ttf --text '流動光影' --output assets/type/motion-cjk.json
Requires fonttools (see tools/requirements-fonts.txt). Keep the input font licence.
"""
import argparse,json
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
p=argparse.ArgumentParser();p.add_argument('font');p.add_argument('--text',default='流動光影文字世界水形態設計ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.');p.add_argument('--output',default='assets/type/motion-cjk.json');a=p.parse_args()
f=TTFont(a.font)
if 'fvar' in f:
 from fontTools.varLib.instancer import instantiateVariableFont
 f=instantiateVariableFont(f,{'wght':850},inplace=True)
glyphs=f.getGlyphSet();mapping=f.getBestCmap();out={}
for char in sorted(set(a.text)):
 if ord(char) not in mapping: raise ValueError('Font has no glyph for '+char)
 name=mapping[ord(char)];pen=SVGPathPen(glyphs);glyphs[name].draw(pen);out[char]={'path':pen.getCommands(),'advance':f['hmtx'][name][0]}
Path(a.output).parent.mkdir(parents=True,exist_ok=True)
Path(a.output).write_text(json.dumps({'family':'Noto Sans TC','unitsPerEm':f['head'].unitsPerEm,'glyphs':out},ensure_ascii=False,separators=(',',':'))+'\n')
print(f'Exported {len(out)} glyphs to {a.output}')
