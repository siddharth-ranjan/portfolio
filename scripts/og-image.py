"""Regenerate public/assets/og.png — the link-preview card (1200×630).

Run after changing the headline or the role line:  python3 scripts/og-image.py
Fetches Barlow Condensed / Barlow from Google Fonts so the card matches the site.
"""
import re
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
BG, TEXT, MUTED, LINE, BLUE, GREEN = '#080b10', '#e9eef7', '#8996a9', '#1c2634', '#9dc2ee', '#6edaa0'
HEADLINE = ['BACKENDS THAT', 'SCALE. AI THAT', 'ANSWERS.']
NAME, ROLE = 'SIDDHARTH RANJAN', 'BACKEND & AI ENGINEER · INDIA · OPEN TO ROLES'
CSS = ('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700'
       '&family=Barlow:wght@500&display=swap')

with tempfile.TemporaryDirectory() as tmp:
    css = subprocess.run(['curl', '-s', '-A', 'Mozilla/4.0', CSS], capture_output=True, text=True).stdout
    urls = re.findall(r'https://[^)]+\.ttf', css)
    body_ttf, cond_ttf = Path(tmp, 'body.ttf'), Path(tmp, 'cond.ttf')
    subprocess.run(['curl', '-s', '-o', str(body_ttf), urls[0]], check=True)
    subprocess.run(['curl', '-s', '-o', str(cond_ttf), urls[-1]], check=True)
    cond = lambda s: ImageFont.truetype(str(cond_ttf), s)
    body = lambda s: ImageFont.truetype(str(body_ttf), s)

    img = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(img)
    d.rectangle([40, 40, W - 41, H - 41], outline=LINE, width=1)
    x = 140  # inside WhatsApp's centre crop (about x 110–1090)
    d.text((x, 74), NAME, font=cond(38), fill=TEXT)
    d.ellipse([x, 132, x + 11, 143], fill=GREEN)
    d.text((x + 22, 124), ROLE, font=body(20), fill=MUTED)
    y = 186
    for line in HEADLINE:
        d.text((x, y), line, font=cond(76), fill=TEXT)
        y += 78
    # the request chain, the read stopping at the cache
    cy, bx = 556, x
    for i in range(7):
        stop = i == 5
        d.rectangle([bx, cy - 12, bx + 52, cy + 12], outline=(BLUE if stop else LINE), width=(2 if stop else 1))
        if i < 6:
            d.line([bx + 52, cy, bx + 76, cy], fill=LINE, width=1)
        bx += 76
    d.text((bx + 8, cy - 11), '200 OK · 3.9ms · cache hit', font=body(19), fill=GREEN)
    img.save('public/assets/og.png', optimize=True)
    print('wrote public/assets/og.png', img.size)
