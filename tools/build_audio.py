"""Bygger public/audio/ av originalen i assets-src/, utan att röra dem och utan att debitera något.

Engångsljud toppnormeras, loopar och musik nivåjusteras på medelnivå (en linjär förstärkning,
så att loopskarven inte förstörs). Den inbördes mixen görs sedan i public/js/app.js.
Kör: python3 tools/build_audio.py
"""
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SFX = ROOT / "assets-src" / "sfx"
MUSIC = ROOT / "assets-src" / "music"
OUT = ROOT / "public" / "audio"
LOOPS = {"heartbeat", "whispers", "bubbles", "giggles"}


def levels(path):
    log = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(path), "-af", "volumedetect", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    return float(re.search(r"mean_volume: (-?[\d.]+)", log).group(1)), float(re.search(r"max_volume: (-?[\d.]+)", log).group(1))


def encode(src, dst, gain, extra=()):
    dst.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(src), "-af", f"volume={gain:.2f}dB",
                    *extra, "-codec:a", "libmp3lame", "-b:a", "128k", str(dst)], check=True)


for src in sorted(SFX.glob("*.mp3")):
    mode, key, _ = src.stem.split("_")
    mean, peak = levels(src)
    gain = min(-20 - mean, -1 - peak) if key in LOOPS else -2 - peak
    encode(src, OUT / mode / f"{key}.mp3", gain)
    print(f"{mode}/{key}: medel {mean} dB, topp {peak} dB, {gain:+.1f} dB")

for mode in ("evil", "kind"):
    src = next(iter(sorted(MUSIC.glob(f"{mode}.*"))), None)
    if not src:
        print(f"{mode}: musik saknas ännu")
        continue
    mean, peak = levels(src)
    gain = min(-20 - mean, -1 - peak)
    encode(src, OUT / mode / "music.mp3", gain)
    print(f"{mode}/music: medel {mean} dB, topp {peak} dB, {gain:+.1f} dB")
