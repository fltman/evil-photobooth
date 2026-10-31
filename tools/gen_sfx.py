"""Ljudeffekter via ElevenLabs Sound Effects. Samma mönster som i battlechess.

Originalen hamnar i assets-src/sfx/ med en hash av prompten i filnamnet: en befintlig fil
genereras aldrig om, så en ändrad prompt debiterar bara den effekten.
Kör: zsh -c 'source ~/.zprofile; export ELEVENLABS_API_KEY; python3 tools/gen_sfx.py [--dry]'
"""
import hashlib
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets-src", "sfx")
dry = "--dry" in sys.argv

# läge, nyckel, prompt, sekunder, loop
SFX = [
    ("evil", "enter", "Heavy ancient wooden door slowly creaking open in a stone crypt, long eerie groan, cold hollow reverb", 3.5, False),
    ("evil", "toll", "One single deep distant church bell toll, cold, long fading reverb, horror", 2.5, False),
    ("evil", "shutter", "Antique bellows camera shutter snapping with a magnesium flash powder pop and hiss", 1.2, False),
    ("evil", "heartbeat", "Slow heavy human heartbeat, deep muffled thumps, close and tense, steady rhythm", 6.0, True),
    ("evil", "whispers", "Many overlapping ghostly whispers, unintelligible breathy voices circling, close to the ear, sinister, no music", 12.0, True),
    ("evil", "rise", "Slowly rising dissonant horror strings and low rumble, tension building and building, no drums", 9.0, False),
    ("evil", "sting", "Sudden violent horror film stinger, shrieking violins stabbing with a deep impact boom and long reverb tail", 3.5, False),
    ("evil", "crack", "Old mirror glass cracking slowly, sharp splintering creaks spreading across the surface", 2.0, False),
    ("evil", "tick", "One small dry bone click, tiny and sharp, close", 0.5, False),
    ("evil", "pick", "Short ghostly female gasp inhale in an empty room, breathy, reverberant", 1.0, False),
    ("evil", "lid", "Old wooden coffin lid creaking open and settling with a dull thud", 2.0, False),
    ("evil", "growl", "Low guttural demonic growl fading away into a hollow breath", 2.5, False),
    ("kind", "enter", "Friendly magical door opening with soft twinkling chimes and a happy little whoosh, cartoon", 2.5, False),
    ("kind", "toll", "One soft wooden xylophone note, warm and playful", 0.7, False),
    ("kind", "shutter", "Cute cartoon camera click with a tiny sparkle", 1.0, False),
    ("kind", "bubbles", "Playful cartoon potion cauldron bubbling and popping gently, cheerful and funny, no voices", 10.0, True),
    ("kind", "giggles", "Tiny cartoon ghosts giggling and going woo softly, cute and friendly, children's cartoon", 8.0, True),
    ("kind", "sting", "Magical cheerful ta-da reveal, rising sparkling glissando with a bright happy chime", 2.5, False),
    ("kind", "tick", "Tiny cute wooden tok sound, soft and round", 0.5, False),
    ("kind", "pick", "Cartoon bubble pop with a small boing, cute", 0.6, False),
    ("kind", "lid", "Storybook page turning with a soft sparkle", 1.2, False),
    ("kind", "growl", "Funny cartoon slide whistle going down, oops, playful", 1.5, False),
]


def fname(mode, key, prompt, dur, loop):
    h = hashlib.sha1(f"{prompt}|{dur}|{loop}".encode()).hexdigest()[:8]
    return f"{mode}_{key}_{h}.mp3"


def main():
    os.makedirs(OUT, exist_ok=True)
    todo = [s for s in SFX if not os.path.exists(os.path.join(OUT, fname(*s[:2], *s[2:])))]
    print(f"{len(todo)} effekter att generera, {sum(s[3] for s in todo):.1f} s ljud totalt")
    if dry or not todo:
        for s in todo:
            print("  ", s[0], s[1], f"{s[3]} s", "(loop)" if s[4] else "")
        return
    from elevenlabs.client import ElevenLabs
    key = os.getenv("ELEVENLABS_API_KEY")
    if not key:
        sys.exit("ELEVENLABS_API_KEY saknas i miljön")
    client = ElevenLabs(api_key=key)
    for s in todo:
        mode, name, prompt, dur, loop = s
        dst = os.path.join(OUT, fname(mode, name, prompt, dur, loop))
        try:
            audio = client.text_to_sound_effects.convert(text=prompt, duration_seconds=dur, prompt_influence=0.55, loop=loop,
                                                         output_format="mp3_44100_128")
            data = b"".join(audio)
            with open(dst, "wb") as f:
                f.write(data)
            print("  ok", os.path.basename(dst), len(data) // 1024, "KB")
        except Exception as e:  # en misslyckad effekt ska inte stoppa resten
            print("  FEL", mode, name, e)


if __name__ == "__main__":
    main()
