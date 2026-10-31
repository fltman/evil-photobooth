"""Bildsamling av testkörningar, så att bygget går att följa i progress/.
Kör: python3 tools/contact-sheet.py <ut.jpg> <rubrik> <bild|etikett> [bild|etikett ...]"""
import sys
from PIL import Image, ImageDraw, ImageFont

CELL_W, CELL_H, GAP, LABEL, HEAD = 340, 454, 16, 52, 70
out, title, *items = sys.argv[1:]
cols = min(5, len(items))
rows = -(-len(items) // cols)
W = cols * CELL_W + (cols + 1) * GAP
H = HEAD + rows * (CELL_H + LABEL + GAP) + GAP

sheet = Image.new("RGB", (W, H), (14, 10, 12))
draw = ImageDraw.Draw(sheet)
font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Georgia.ttf", 22)
big = ImageFont.truetype("/System/Library/Fonts/Supplemental/Georgia.ttf", 34)
draw.text((GAP, 18), title, fill=(232, 220, 200), font=big)

for i, item in enumerate(items):
    path, label = item.split("|", 1)
    x = GAP + (i % cols) * (CELL_W + GAP)
    y = HEAD + (i // cols) * (CELL_H + LABEL + GAP)
    img = Image.open(path).convert("RGB")
    img.thumbnail((CELL_W, CELL_H))
    sheet.paste(img, (x + (CELL_W - img.width) // 2, y))
    draw.text((x, y + CELL_H + 12), label, fill=(200, 170, 150), font=font)

sheet.save(out, quality=90)
print(out, sheet.size)
