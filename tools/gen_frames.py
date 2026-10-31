"""Genererar spegelramarna och stansar ut hålet i mitten.

Modellen ritar mitten i en platt signalfärg. Hålet hittas med flood fill från bildens mitt, så
grönt i själva ramen (blad, slime) lämnas i fred. Geometrin hamnar i public/img/frames.json.

Originalen sparas i assets-src/, så att stansningen kan köras om utan ny debitering:
  python3 tools/gen_frames.py          # genererar bara det som saknas
  python3 tools/gen_frames.py --recut  # stansar om befintliga original
"""
import base64, json, os, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets-src" / "frames"
OUT = ROOT / "public" / "img"
MODEL = "bytedance-seed/seedream-5-0-pro"
MAGENTA, GREEN = (255, 0, 255), (0, 255, 0)

SHAPE = ("Seen perfectly straight on, flat and symmetrical, filling the whole image edge to edge. "
         "The frame is a border roughly one eighth of the image wide on every side. "
         "The entire inside of the frame is one flat solid pure {name} color, {hex}, with no texture, no shading, no reflection. "
         "No text, no logo, nothing outside the frame.")
EVIL = ("A nightmarish antique mirror frame carved from black wood and yellowed bone: human skulls at the four corners, "
        "ribs and finger bones woven into the sides, thorns and dead roots, dark dried blood dripping from the inner edge, "
        "cracked gilding. Moody dark horror film lighting. ")
KIND = ("A cheerful chunky children's Halloween picture frame in a warm hand-painted storybook style: happy smiling pumpkins at the "
        "four corners, cute friendly little ghosts, small smiling bats, stars, candy and lollipops, orange, purple and warm yellow. "
        "Friendly and funny, nothing scary. ")

FRAMES = [
    ("evil-portrait", EVIL, MAGENTA, "magenta", "#FF00FF", "3:4"),
    ("evil-landscape", EVIL, MAGENTA, "magenta", "#FF00FF", "4:3"),
    ("kind-portrait", KIND, GREEN, "green", "#00FF00", "3:4"),
    ("kind-landscape", KIND, GREEN, "green", "#00FF00", "4:3"),
]


def generate(name, style, _key, color, hex_, aspect):
    path = SRC / f"{name}.jpg"
    if path.exists():
        return path
    body = {"model": MODEL, "modalities": ["image"], "image_config": {"aspect_ratio": aspect},
            "messages": [{"role": "user", "content": [{"type": "text", "text": style + SHAPE.format(name=color, hex=hex_)}]}]}
    req = urllib.request.Request("https://openrouter.ai/api/v1/chat/completions", data=json.dumps(body).encode(),
                                 headers={"Authorization": f"Bearer {os.environ['OPENROUTER_API_KEY']}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=200) as r:
        data = json.loads(r.read())
    url = data["choices"][0]["message"]["images"][0]["image_url"]["url"]
    path.write_bytes(base64.b64decode(url.split(",", 1)[1]))
    print("genererad", path.name, data.get("usage", {}).get("cost"))
    return path


def small_holes(mask, limit):
    """Sant för öar i masken som är mindre än limit pixlar."""
    islands, n = ndimage.label(mask)
    sizes = ndimage.sum(mask, islands, range(1, n + 1))
    return np.isin(islands, 1 + np.where(np.asarray(sizes) < limit)[0])


def cut(path, key, aspect):
    img = Image.open(path).convert("RGB")
    if max(img.size) > 1600:  # räcker till 4K-laptopar, och håller nere filstorleken för mobilen
        img.thumbnail((1600, 1600), Image.LANCZOS)
    rgb = np.asarray(img).astype(np.int32)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h, w = g.shape

    # Färgton, inte avstånd: modellen målar signalfärgen mörkare och randig än den ombedda.
    chroma = np.minimum(r, b) - g if key == MAGENTA else g - np.maximum(r, b)
    labels, _ = ndimage.label(chroma > 60)
    centre = labels[h // 2, w // 2]
    if centre == 0:
        raise SystemExit(f"{path.name}: mitten är inte signalfärgen")
    hole = labels == centre
    hole |= small_holes(~hole, w * h * 0.0004)
    hole |= (chroma > 60) & ndimage.binary_dilation(hole, iterations=w // 40)  # fickorna mellan bloddropparna
    hole = ndimage.binary_dilation(hole, iterations=max(2, w // 600))

    # Tvättar bort signalfärgen som smittat kanterna, till exempel på bloddropparna.
    near = ndimage.binary_dilation(hole, iterations=max(6, w // 150))
    spill = np.clip(chroma, 0, None) * near
    clean = rgb.copy()
    if key == MAGENTA:
        clean[..., 0] -= spill
        clean[..., 2] -= spill
    else:
        clean[..., 1] -= spill

    # Den onda ramens svarta ytterkant blir genomskinlig, så att siluetten smälter in i sidan.
    outside = np.zeros_like(hole)
    if key == MAGENTA:
        dark, _ = ndimage.label(rgb.max(axis=2) < 30)
        edge = np.unique(np.concatenate([dark[0], dark[-1], dark[:, 0], dark[:, -1]]))
        outside = np.isin(dark, edge[edge > 0])

    solid = ~outside
    ys, xs = np.where(solid)
    ratio_wh = w / h
    bw, bh = xs.max() + 1 - xs.min(), ys.max() + 1 - ys.min()
    cw = max(bw, bh * ratio_wh)
    ch = cw / ratio_wh
    left = int(max(0, min(w - cw, (xs.min() + xs.max()) / 2 - cw / 2)))
    top = int(max(0, min(h - ch, (ys.min() + ys.max()) / 2 - ch / 2)))
    right, bottom = left + int(cw), top + int(ch)

    keep = (~hole & ~outside).astype(np.uint8) * 255
    alpha = Image.fromarray(keep).filter(ImageFilter.GaussianBlur(1.4)).crop((left, top, right, bottom))
    out = Image.fromarray(np.clip(clean, 0, 255).astype(np.uint8)).crop((left, top, right, bottom))
    out.putalpha(alpha)
    out.save(OUT / f"frame-{path.stem}.webp", quality=88, method=6)

    hole = hole[top:bottom, left:right]
    h, w = hole.shape
    ys, xs = np.where(hole)
    x0, x1, y0, y1 = xs.min() / w, (xs.max() + 1) / w, ys.min() / h, (ys.max() + 1) / h
    # Glaset är exakt 3:4 eller 4:3 och täcker hela hålet. Ramen får överlappa glaset, aldrig tvärtom.
    ratio = (3 / 4 if aspect == "3:4" else 4 / 3) * (h / w)
    gw, gh = x1 - x0, y1 - y0
    if gw / gh < ratio:
        gw = gh * ratio
    else:
        gh = gw / ratio
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    print(f"{path.stem}: {w}x{h}, hål {100 * hole.mean():.0f} % av ytan, glas {gw:.2f}x{gh:.2f}")
    return {"aspect": aspect, "ratio": w / h, "x": cx - gw / 2, "y": cy - gh / 2, "w": gw, "h": gh}


def main():
    SRC.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    if "--recut" not in sys.argv:
        with ThreadPoolExecutor(2) as ex:
            list(ex.map(lambda f: generate(*f), FRAMES))
    geometry = {f[0]: cut(SRC / f"{f[0]}.jpg", f[2], f[5]) for f in FRAMES}
    (OUT / "frames.json").write_text(json.dumps(geometry, indent=2))


if __name__ == "__main__":
    main()
