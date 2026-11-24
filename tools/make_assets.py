#!/usr/bin/env python3
"""Process art, printables, icons, sound effects and a short original arrangement
of the traditional song 'De zak van Sinterklaas'."""
from __future__ import annotations

import math
import os
import random
import struct
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

ROOT = Path("/workspace/sint-speurtocht")
IMG = ROOT / "assets" / "images"
AUD = ROOT / "assets" / "audio"
PRINT = ROOT / "print"
ICONS = ROOT / "icons"
FONTS = ROOT / "fonts"
SECRET = "5122"

for p in (IMG, AUD, PRINT, ICONS):
    p.mkdir(parents=True, exist_ok=True)


def punch_background(path: Path, dest: Path, thresh: float = 26, feather: float = 14, pad: int = 16):
    im = Image.open(path).convert("RGBA")
    arr = np.array(im)
    h, w = arr.shape[:2]
    corners = np.concatenate(
        [
            arr[0:10, 0:10].reshape(-1, 4),
            arr[0:10, -10:].reshape(-1, 4),
            arr[-10:, 0:10].reshape(-1, 4),
            arr[-10:, -10:].reshape(-1, 4),
        ]
    )
    bg = np.median(corners[:, :3].astype(np.float32), axis=0)
    diff = np.linalg.norm(arr[:, :, :3].astype(np.float32) - bg, axis=2)
    alpha = np.clip((diff - thresh) / max(feather, 1), 0, 1)
    # kill near-edge leftover fringe
    arr[:, :, 3] = (alpha * 255).astype(np.uint8)
    out = Image.fromarray(arr)
    bbox = out.getbbox()
    if bbox:
        l, t, r, b = bbox
        l, t = max(0, l - pad), max(0, t - pad)
        r, b = min(w, r + pad), min(h, b + pad)
        out = out.crop((l, t, r, b))
    dest.parent.mkdir(parents=True, exist_ok=True)
    out.save(dest, "PNG", optimize=True)
    print(f"  punched {dest.name} {out.size}")
    return out


def webp(im_or_path, dest: Path, quality=82, max_side=1600):
    im = im_or_path if isinstance(im_or_path, Image.Image) else Image.open(im_or_path)
    im = im.convert("RGBA") if dest.suffix == ".webp" else im
    w, h = im.size
    if max(w, h) > max_side:
        im = ImageOps.contain(im, (max_side, max_side), Image.Resampling.LANCZOS)
    if dest.suffix == ".webp":
        im.save(dest, "WEBP", quality=quality, method=6)
    else:
        im.save(dest)
    print(f"  webp {dest.name} {im.size} {dest.stat().st_size}")
    return dest


def make_icons():
    src = Image.open(IMG / "sint-portrait.jpg").convert("RGB")
    # crop a square around the face / mitre (right-center of the 16:9 frame)
    w, h = src.size
    # Sint's face is right of center
    side = h
    left = min(w - side, int(w * 0.38))
    crop = src.crop((left, 0, left + side, h)).resize((1024, 1024), Image.Resampling.LANCZOS)
    # circular gold-rimmed icon
    def circle(size, maskable=False):
        im = crop.resize((size, size), Image.Resampling.LANCZOS)
        canv = Image.new("RGBA", (size, size), (110, 16, 28, 255))
        canv.paste(im, (0, 0))
        mask = Image.new("L", (size, size), 0)
        d = ImageDraw.Draw(mask)
        margin = 0 if maskable else int(size * 0.04)
        d.ellipse((margin, margin, size - 1 - margin, size - 1 - margin), fill=255)
        canv.putalpha(mask)
        if not maskable:
            ring = Image.new("RGBA", (size, size), (0, 0, 0, 0))
            rd = ImageDraw.Draw(ring)
            rd.ellipse((margin, margin, size - 1 - margin, size - 1 - margin), outline=(212, 160, 23, 255), width=max(3, size // 32))
            canv = Image.alpha_composite(canv, ring)
        return canv

    circle(192).save(ICONS / "icon-192.png")
    circle(512).save(ICONS / "icon-512.png")
    # maskable: full bleed
    m = crop.resize((512, 512), Image.Resampling.LANCZOS).convert("RGBA")
    bg = Image.new("RGBA", (512, 512), (110, 16, 28, 255))
    bg.paste(m, (0, 0))
    bg.save(ICONS / "icon-maskable-512.png")
    circle(180).save(ICONS / "apple-touch-icon.png")
    circle(48).save(ICONS / "favicon-48.png")
    # simple svg favicon (mitre-ish)
    (ICONS / "icon.svg").write_text(
        """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" rx="12" fill="#6e1020"/>
<polygon points="32,6 54,28 10,28" fill="#c41e3a" stroke="#d4a017" stroke-width="2"/>
<rect x="14" y="26" width="36" height="8" rx="2" fill="#c41e3a" stroke="#d4a017" stroke-width="2"/>
<rect x="29" y="10" width="6" height="16" fill="#d4a017"/>
<rect x="24" y="14" width="16" height="6" fill="#d4a017"/>
</svg>
""",
        encoding="utf-8",
    )
    print("  icons ok")


def font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size=size)


def make_secret_note():
    parchment = Image.open(IMG / "perkament.jpg").convert("RGB")
    # A6 at 300 dpi is 1240 x 1748; also a small hang-on-the-bag size
    def render(w, h, code, title_size, code_size, sub_size, out_path):
        im = parchment.resize((w, h), Image.Resampling.LANCZOS)
        d = ImageDraw.Draw(im)
        cinzel = font(FONTS / "cinzel.ttf", title_size)
        cinzel_s = font(FONTS / "cinzel.ttf", sub_size)
        # Code in big Cinzel
        title = "GEHEIME CODE"
        # center title
        tw = d.textlength(title, font=cinzel)
        d.text(((w - tw) / 2, int(h * 0.20)), title, font=cinzel, fill=(90, 20, 20))
        # decorative line
        y = int(h * 0.32)
        d.line((w * 0.22, y, w * 0.78, y), fill=(180, 130, 40), width=max(2, h // 400))
        digits = "   ".join(list(code))
        code_font = font(FONTS / "cinzel.ttf", code_size)
        cw = d.textlength(digits, font=code_font)
        d.text(((w - cw) / 2, int(h * 0.40)), digits, font=code_font, fill=(80, 16, 16))
        y2 = int(h * 0.62)
        d.line((w * 0.22, y2, w * 0.78, y2), fill=(180, 130, 40), width=max(2, h // 400))
        for i, line in enumerate(["Hang dit briefje", "aan de zak van Sint."]):
            lw = d.textlength(line, font=cinzel_s)
            d.text(((w - lw) / 2, int(h * 0.68) + i * int(sub_size * 1.45)), line, font=cinzel_s, fill=(90, 40, 30))
        im.save(out_path, "PNG", optimize=True)
        print(f"  note {out_path.name} {im.size}")

    # A6 300dpi
    render(1240, 1748, SECRET, 72, 180, 42, PRINT / "geheime-code-a6.png")
    # small hang-tag ~8x11 cm at 300dpi = 945 x 1299
    render(945, 1299, SECRET, 56, 140, 34, PRINT / "geheime-code.png")
    # even smaller preview used in-app
    render(600, 840, SECRET, 36, 88, 22, IMG / "geheime-code-kaart.png")


def make_magnet():
    s = 256
    im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # horseshoe magnet, red with silver tips
    d.rounded_rectangle((40, 30, 216, 226), radius=70, fill=(200, 32, 40), outline=(120, 16, 20), width=4)
    d.rounded_rectangle((88, 78, 168, 226), radius=40, fill=(0, 0, 0, 0))
    # punch inner by redrawing transparent? Use difference of ellipses is hard; draw two legs
    im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # left + right legs + top arc
    d.rounded_rectangle((48, 100, 108, 220), radius=16, fill=(196, 30, 38))
    d.rounded_rectangle((148, 100, 208, 220), radius=16, fill=(196, 30, 38))
    d.pieslice((48, 40, 208, 200), 180, 0, fill=(196, 30, 38))
    d.pieslice((88, 80, 168, 160), 180, 0, fill=(0, 0, 0, 0))
    # silver tips
    d.rounded_rectangle((48, 190, 108, 230), radius=10, fill=(200, 205, 215), outline=(120, 120, 130), width=2)
    d.rounded_rectangle((148, 190, 208, 230), radius=10, fill=(200, 205, 215), outline=(120, 120, 130), width=2)
    im = im.filter(ImageFilter.SMOOTH)
    im.save(IMG / "magneet.png", "PNG")
    print("  magnet")


def write_wav(path: Path, samples: np.ndarray, sr: int = 44100):
    samples = np.clip(samples, -1, 1)
    pcm = (samples * 32767).astype(np.int16)
    with wave.open(str(path), "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())
    # also mp3
    mp3 = path.with_suffix(".mp3")
    os.system(f'ffmpeg -y -i "{path}" -codec:a libmp3lame -b:a 96k "{mp3}" >/dev/null 2>&1')
    print(f"  snd {mp3.name} {mp3.stat().st_size if mp3.exists() else 0}")


def adsr(n, sr, a=0.01, d=0.08, s=0.7, r=0.12):
    env = np.ones(n, dtype=np.float32)
    na, nd, nr = int(a * sr), int(d * sr), int(r * sr)
    na, nd, nr = max(1, na), max(1, nd), max(1, nr)
    if na + nd + nr > n:
        na, nd, nr = max(1, n // 8), max(1, n // 8), max(1, n // 5)
    env[:na] = np.linspace(0, 1, na)
    env[na : na + nd] = np.linspace(1, s, nd)
    env[na + nd : max(na + nd, n - nr)] = s
    env[max(0, n - nr) :] = np.linspace(env[max(0, n - nr - 1)] if n > nr else s, 0, min(nr, n))
    return env


def osc(freq, dur, sr, kind="tri"):
    n = int(sr * dur)
    t = np.arange(n) / sr
    phase = (t * freq) % 1.0
    if kind == "tri":
        wave = 2 * np.abs(2 * phase - 1) - 1
    elif kind == "sin":
        wave = np.sin(2 * np.pi * freq * t)
    elif kind == "sq":
        wave = np.where(phase < 0.5, 1.0, -1.0)
    elif kind == "saw":
        wave = 2 * phase - 1
    else:
        wave = np.sin(2 * np.pi * freq * t)
    return wave.astype(np.float32)


def note_freq(name: str) -> float:
    if name in ("r", "rest"):
        return 0.0
    name = name.replace("♯", "#")
    acc = 0
    if len(name) >= 2 and name[1] == "#":
        letter, acc, octv = name[0], 1, int(name[2:])
    elif len(name) >= 2 and name[1] == "b":
        letter, acc, octv = name[0], -1, int(name[2:])
    else:
        letter, octv = name[0], int(name[1:])
    semis = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}[letter.upper()] + acc
    midi = (octv + 1) * 12 + semis
    return 440.0 * (2 ** ((midi - 69) / 12))


def make_sfx():
    sr = 44100
    rng = np.random.default_rng(5)

    # pepernoten rattle: many short wooden clicks + soft thud
    def click(dur=0.04, f0=900):
        n = int(sr * dur)
        noise = rng.normal(0, 1, n).astype(np.float32)
        # band-pass-ish via sine ring
        t = np.arange(n) / sr
        tone = np.sin(2 * np.pi * f0 * t) * np.exp(-t * 40)
        return (noise * 0.35 + tone * 0.8) * adsr(n, sr, 0.001, 0.01, 0.3, 0.03)

    ratt = np.zeros(int(sr * 0.7), dtype=np.float32)
    for _ in range(14):
        pos = int(rng.uniform(0, 0.55) * sr)
        c = click(rng.uniform(0.03, 0.06), rng.uniform(600, 1400)) * rng.uniform(0.4, 1)
        end = min(len(ratt), pos + len(c))
        ratt[pos:end] += c[: end - pos]
    ratt /= max(1, np.max(np.abs(ratt))) * 1.1
    write_wav(AUD / "strooi.wav", ratt, sr)

    # shutter / flash
    n = int(sr * 0.25)
    t = np.arange(n) / sr
    shut = (rng.normal(0, 1, n) * np.exp(-t * 25)).astype(np.float32)
    shut += 0.4 * np.sin(2 * np.pi * 180 * t) * np.exp(-t * 18)
    write_wav(AUD / "flits.wav", shut * 0.7, sr)

    # sparkle (polaroid)
    spark = np.zeros(int(sr * 1.1), dtype=np.float32)
    for i, f in enumerate((784, 988, 1175, 1568, 1976)):
        start = int(0.06 * i * sr)
        d = 0.45
        sig = osc(f, d, sr, "sin") * adsr(int(sr * d), sr, 0.005, 0.08, 0.4, 0.3) * (0.45 - i * 0.05)
        spark[start : start + len(sig)] += sig[: max(0, len(spark) - start)]
    write_wav(AUD / "fonkel.wav", spark, sr)

    # wrong / right
    wr = np.concatenate(
        [
            osc(220, 0.16, sr, "sq") * adsr(int(sr * 0.16), sr, 0.005, 0.04, 0.5, 0.08) * 0.25,
            osc(165, 0.28, sr, "sq") * adsr(int(sr * 0.28), sr, 0.005, 0.05, 0.4, 0.15) * 0.28,
        ]
    )
    write_wav(AUD / "fout.wav", wr, sr)
    ok = np.zeros(int(sr * 0.7), dtype=np.float32)
    for i, f in enumerate((523, 659, 784, 1046)):
        st = int(0.09 * i * sr)
        sig = osc(f, 0.28, sr, "sin") * adsr(int(sr * 0.28), sr, 0.005, 0.06, 0.5, 0.15) * 0.35
        ok[st : st + len(sig)] += sig[: max(0, len(ok) - st)]
    write_wav(AUD / "goed.wav", ok, sr)

    # button
    b = osc(660, 0.08, sr, "sin") * adsr(int(sr * 0.08), sr, 0.002, 0.02, 0.3, 0.04) * 0.3
    write_wav(AUD / "tik.wav", b, sr)

    # horse neigh: noisy falling formant + flutter
    dur = 1.6
    n = int(sr * dur)
    t = np.arange(n) / sr
    f0 = 520 * (0.55 ** t)  # falling
    vibr = 1 + 0.08 * np.sin(2 * np.pi * 18 * t)
    tone = np.sin(2 * np.pi * np.cumsum(f0 * vibr) / sr)
    tone += 0.4 * np.sin(2 * np.pi * np.cumsum(f0 * 2.1 * vibr) / sr)
    noise = rng.normal(0, 1, n)
    # flutter amplitude
    amp = (0.5 + 0.5 * np.sin(2 * np.pi * 6 * t) ** 2) * np.exp(-0.5 * t) * adsr(n, sr, 0.05, 0.15, 0.8, 0.3)
    neigh = (tone * 0.7 + noise * 0.15) * amp * 0.7
    write_wav(AUD / "hinnik.wav", neigh, sr)

    # short silent file for iOS unlock
    write_wav(AUD / "stil.wav", np.zeros(int(sr * 0.05), dtype=np.float32), sr)


def make_song():
    """Original instrumental arrangement of the traditional public-domain melody."""
    sr = 44100
    bpm = 108
    beat = 60.0 / bpm  # quarter

    # Melody transcribed from a common children's-piano setting of the folk tune
    # (public domain melody). Accompaniment is original.
    # Beats are in quarter notes. Key: centered around C/G with the characteristic F#.
    melody = [
        # De zak van Sin-ter-klaas,
        ("C5", 0.5), ("D5", 0.5), ("E5", 0.5), ("F#5", 0.5), ("G5", 1.0), ("r", 1.0),
        # Sin-ter-klaas,
        ("E5", 0.5), ("E5", 0.5), ("C5", 1.0),
        # Sin-ter-klaas,
        ("D5", 0.5), ("D5", 0.5), ("C5", 1.0),
        # de zak van Sin-ter-klaas,
        ("C5", 0.5), ("D5", 0.5), ("E5", 0.5), ("F#5", 0.5), ("G5", 1.0), ("r", 0.5),
        # o jon-gens, jon-gens wat een baas.
        ("E5", 0.5), ("E5", 0.5), ("D5", 0.5), ("D5", 0.5), ("C5", 0.5), ("D5", 0.5), ("E5", 1.0), ("r", 1.0),
        # Daar stopt hij, daar stopt hij, daar stopt hij blij van zin,
        ("G5", 0.5), ("E5", 0.5), ("C5", 1.0),
        ("G5", 0.5), ("E5", 0.5), ("C5", 1.0),
        ("G5", 0.5), ("E5", 0.5), ("F#5", 0.5), ("G5", 0.5), ("A5", 1.0), ("r", 1.0),
        # de he-le, de he-le, de he-le we-reld in.
        ("G5", 0.5), ("E5", 0.5), ("C5", 1.0),
        ("G5", 0.5), ("E5", 0.5), ("C5", 1.0),
        ("G5", 0.5), ("A5", 0.5), ("F#5", 0.5), ("D5", 0.5), ("C5", 1.0), ("r", 1.0),
        # De zak van Sin-ter-klaas, Sin-ter-klaas, Sin-ter-klaas,
        ("C5", 0.5), ("D5", 0.5), ("E5", 0.5), ("F#5", 0.5), ("G5", 1.0), ("r", 1.0),
        ("E5", 0.5), ("E5", 0.5), ("C5", 1.0),
        ("D5", 0.5), ("D5", 0.5), ("C5", 1.0),
        # de zak van Sin-ter-klaas, o jongens, jongens wat een baas.
        ("C5", 0.5), ("D5", 0.5), ("E5", 0.5), ("F#5", 0.5), ("G5", 1.0), ("r", 0.5),
        ("E5", 0.5), ("E5", 0.5), ("D5", 0.5), ("D5", 0.5), ("C5", 0.5), ("E5", 0.5), ("C5", 2.0),
    ]

    # Lyric cues (beat index from start, text)
    lyrics = [
        (0, "De zak van Sinterklaas,"),
        (4, "Sinterklaas, Sinterklaas,"),
        (8, "de zak van Sinterklaas,"),
        (13, "o jongens, jongens, 't is zo'n baas!"),
        (18, "Daar stopt hij, daar stopt hij,"),
        (22, "daar stopt hij blij van zin."),
        (26, "De hele, de hele,"),
        (30, "de hele wereld in!"),
        (34, "De zak van Sinterklaas,"),
        (38, "Sinterklaas, Sinterklaas,"),
        (42, "de zak van Sinterklaas,"),
        (47, "o jongens, jongens, 't is zo'n baas!"),
    ]

    total_beats = sum(b for _, b in melody)
    total = total_beats * beat + 1.2
    mix = np.zeros(int(sr * total) + 10, dtype=np.float32)

    def put(start_s, sig):
        a = int(start_s * sr)
        b = a + len(sig)
        if b > len(mix):
            grow = np.zeros(b + 100, dtype=np.float32)
            grow[: len(mix)] = mix
            # can't rebind easily; clip
            sig = sig[: max(0, len(mix) - a)]
            b = a + len(sig)
        mix[a:b] += sig

    # bass pattern (original): C / G / C style march, low
    tcur = 0.0
    # simple harmonic plan per 2 beats
    bass_deg = [
        "C3", "G2", "C3", "G2",
        "C3", "G2", "C3", "G2",
        "C3", "G2", "C3", "E3",
        "G2", "C3", "G2", "C3",
        "C3", "G2", "C3", "G2",
        "C3", "G2", "D3", "G2",
        "C3", "G2", "G2", "C3",
    ]
    for i, bn in enumerate(bass_deg):
        if tcur >= total_beats * beat:
            break
        dur = 2 * beat
        f = note_freq(bn)
        sig = osc(f, dur, sr, "sin") * 0.22 * adsr(int(sr * dur), sr, 0.01, 0.08, 0.7, 0.15)
        # soft fifth
        sig += osc(f * 1.5, dur, sr, "sin") * 0.08 * adsr(int(sr * dur), sr, 0.01, 0.08, 0.6, 0.15)
        put(i * dur, sig)

    # soft off-beat 'accordion' chords
    chord_map = {
        "C": ["C4", "E4", "G4"],
        "G": ["G3", "B3", "D4"],
        "D": ["D4", "F#4", "A4"],
        "F": ["F3", "A3", "C4"],
    }
    plan = "C G C G C G C G C G C C G C G C C G C G C G D G C G G C".split()
    for i, ch in enumerate(plan):
        notes = chord_map.get(ch, chord_map["C"])
        start = i * 2 * beat + beat * 0.5  # off-beat
        dur = beat * 0.9
        for nn in notes:
            sig = osc(note_freq(nn), dur, sr, "tri") * 0.08 * adsr(int(sr * dur), sr, 0.01, 0.08, 0.5, 0.2)
            put(start, sig)

    # melody: music-box / glockenspiel (sine + high partial)
    tcur = 0.0
    for name, beats in melody:
        dur = beats * beat
        if name not in ("r", "rest"):
            f = note_freq(name)
            sig = osc(f, dur + 0.05, sr, "sin") * 0.32
            sig += osc(f * 2, dur + 0.05, sr, "sin") * 0.12
            p3 = osc(f * 3, dur * 0.4, sr, "sin") * 0.04
            sig[:len(p3)] += p3
            sig *= adsr(len(sig), sr, 0.008, 0.06, 0.55, 0.25)
            put(tcur, sig)
        tcur += dur

    # light tambourine / jingle on beats 2 and 4
    rng = np.random.default_rng(2)
    beat_t = 0.0
    while beat_t < total_beats * beat:
        # downbeat soft thud
        n = int(0.08 * sr)
        thud = rng.normal(0, 1, n).astype(np.float32) * np.exp(-np.arange(n) / sr * 50) * 0.15
        thud += osc(80, 0.08, sr, "sin") * 0.1 * adsr(n, sr, 0.001, 0.02, 0.4, 0.04)
        put(beat_t, thud)
        # off-jingle
        jn = int(0.07 * sr)
        jing = np.zeros(jn, dtype=np.float32)
        for f in (2500, 3200, 4100):
            jing += osc(f, 0.07, sr, "sin") * 0.04
        jing *= adsr(jn, sr, 0.001, 0.01, 0.3, 0.04)
        put(beat_t + beat * 0.5, jing)
        beat_t += beat

    # fade out last 0.8s
    fade = int(0.8 * sr)
    mix[-fade:] *= np.linspace(1, 0, fade)
    peak = np.max(np.abs(mix)) or 1
    mix = mix / peak * 0.85
    write_wav(AUD / "zak-lied.wav", mix, sr)

    # lyric timings json for the app
    import json

    cues = [{"t": round(b * beat, 3), "text": txt} for b, txt in lyrics]
    (ROOT / "src" / "lied-cues.json").write_text(json.dumps({"bpm": bpm, "cues": cues, "duration": round(total_beats * beat, 3)}, indent=2), encoding="utf-8")
    print(f"  song {total_beats * beat:.1f}s, {len(lyrics)} cues")


def process_photos():
    punch_background(IMG / "piet-talking.jpg", IMG / "piet-talking.png", thresh=22, feather=12)
    punch_background(IMG / "piet-cold.jpg", IMG / "piet-cold.png", thresh=22, feather=12)
    punch_background(IMG / "piet-thinking.jpg", IMG / "piet-thinking.png", thresh=22, feather=12)
    punch_background(IMG / "piet-excited.jpg", IMG / "piet-excited.png", thresh=22, feather=12)
    punch_background(IMG / "sint-zak.jpg", IMG / "sint-zak.png", thresh=24, feather=16)
    punch_background(IMG / "pepernoot.jpg", IMG / "pepernoot.png", thresh=18, feather=10, pad=8)
    # compress scene photos to webp (keep jpg originals too for quality in slideshow)
    for name in (
        "sint-portrait.jpg",
        "zak-dak.jpg",
        "zak-schoorsteen.jpg",
        "zak-paard.jpg",
        "zak-stoomboot.jpg",
        "de-plek.jpg",
        "perkament.jpg",
        "oorkonde-kader.jpg",
    ):
        src = IMG / name
        if src.exists():
            webp(src, IMG / (src.stem + ".webp"), quality=80, max_side=1600)


def main():
    print("== photos ==")
    process_photos()
    print("== icons ==")
    make_icons()
    print("== magnet ==")
    make_magnet()
    print("== secret note ==")
    make_secret_note()
    print("== sfx ==")
    make_sfx()
    print("== song ==")
    make_song()
    print("done")


if __name__ == "__main__":
    main()
