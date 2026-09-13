"""Regenerate public/assets/og-chess.png — the link-preview card for /chess (1200×630).

Run after changing the copy or the position:  python3 scripts/og-chess.py
Same fonts, colours and frame as scripts/og-image.py. WhatsApp shows a centre crop of
wide cards (roughly x 110–1090), so everything that matters sits inside x 140–1060.
Chess glyphs come from DejaVu Sans (fc-match), which ships with most Linux systems.
"""
import re
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
BG, TEXT, MUTED, LINE, BLUE, GREEN = '#080b10', '#e9eef7', '#8996a9', '#1c2634', '#9dc2ee', '#6edaa0'
LIGHT, DARK, LAST = '#3b4759', '#263142', '#7a6538'   # the board colours used on /chess
NAME = 'SIDDHARTH RANJAN'
HEADLINE = ['CROWD', 'CHESS']
LINES = ['One shared game for everyone.', 'No two moves in a row.']
URL = 'siddharthranjan.app/chess'
# after 1.e4 e5 2.Nf3 Nc6 3.Bc4 — the bishop's move is highlighted
FEN = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R'
LAST_MOVE = ('f1', 'c4')
GLYPH = {'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'}
CSS = ('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700'
       '&family=Barlow:wght@500&display=swap')


def square(name):
    return 'abcdefgh'.index(name[0]), 8 - int(name[1])  # (column, row from the top)


with tempfile.TemporaryDirectory() as tmp:
    css = subprocess.run(['curl', '-s', '-A', 'Mozilla/4.0', CSS], capture_output=True, text=True).stdout
    urls = re.findall(r'https://[^)]+\.ttf', css)
    body_ttf, cond_ttf = Path(tmp, 'body.ttf'), Path(tmp, 'cond.ttf')
    subprocess.run(['curl', '-s', '-o', str(body_ttf), urls[0]], check=True)
    subprocess.run(['curl', '-s', '-o', str(cond_ttf), urls[-1]], check=True)
    pieces_ttf = subprocess.run(['fc-match', '-f', '%{file}', 'DejaVu Sans'], capture_output=True, text=True).stdout
    cond = lambda s: ImageFont.truetype(str(cond_ttf), s)
    body = lambda s: ImageFont.truetype(str(body_ttf), s)
    pieces = ImageFont.truetype(pieces_ttf, 42)

    img = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(img)
    d.rectangle([40, 40, W - 41, H - 41], outline=LINE, width=1)

    # left: who, what, the rule, where
    x = 140
    d.text((x, 92), NAME, font=cond(34), fill=TEXT)
    d.ellipse([x, 146, x + 11, 157], fill=GREEN)
    d.text((x + 22, 138), 'LIVE · PLAY A MOVE', font=body(20), fill=MUTED)
    y = 186
    for line in HEADLINE:
        d.text((x, y), line, font=cond(104), fill=TEXT)
        y += 100
    y += 34
    for line in LINES:
        d.text((x, y), line, font=body(26), fill=MUTED)
        y += 38
    d.text((x, 516), URL, font=body(24), fill=GREEN)  # level with the board's bottom edge

    # right: the board
    size, sq = 400, 50
    bx, by = 1060 - size, (H - size) // 2
    marked = {square(s) for s in LAST_MOVE}
    for r, row in enumerate(FEN.split('/')):
        c = 0
        for ch in row:
            if ch.isdigit():
                cols = range(c, c + int(ch))
                c += int(ch)
            else:
                cols = [c]
                c += 1
            for col in cols:
                x0, y0 = bx + col * sq, by + r * sq
                fill = LAST if (col, r) in marked else (DARK if (col + r) % 2 else LIGHT)
                d.rectangle([x0, y0, x0 + sq - 1, y0 + sq - 1], fill=fill)
                if not ch.isdigit():
                    white = ch.isupper()
                    d.text((x0 + sq / 2, y0 + sq / 2 + 2), GLYPH[ch.lower()], font=pieces, anchor='mm',
                           fill='#f5f5f5' if white else '#141414',
                           stroke_width=2, stroke_fill='#141414' if white else '#9aa4b2')
    d.rectangle([bx - 1, by - 1, bx + size, by + size], outline=LINE, width=1)

    out = 'public/assets/og-chess.png'
    img.save(out, optimize=True)
    print('wrote', out, img.size)
