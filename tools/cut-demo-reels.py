#!/usr/bin/env python
"""Build the two four-language demo reels from the raw screen captures.

The raw takes in demo/ are 2560x1538 gdigrab recordings of the DSH window:
they contain the host menu bar (top ~46 px), the desktop pet and its toast
(top-right), a floating toolbar (bottom-right) and one extra pixel row of the
app shell at the very bottom.  Every take is trimmed to exactly the animation
window and re-muxed with the matching master track, then the four languages are
concatenated with hard cuts in a single pass.

Alignment: the short cut's progress label prints round(t / span * 100), so a
frame timestamp T plus its percentage p gives the wall-clock time of t = 0 as
start = T - p * span.  The numbers below were read from the raw takes at
T = 2.0 s (short) and T = 6.0 / 14.0 s (full); they are per-take constants.

Usage:
    .venv-tts\\Scripts\\python.exe tools\\cut-demo-reels.py short
    .venv-tts\\Scripts\\python.exe tools\\cut-demo-reels.py full
    .venv-tts\\Scripts\\python.exe tools\\cut-demo-reels.py both
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FFMPEG = ROOT / ".tmp" / "ffmpeg" / "ffmpeg-9.0.2-essentials_build" / "bin" / "ffmpeg.exe"
ASSETS = ROOT / "plugin" / "dsh-opening" / "assets"

# 2560x1538 capture -> clean, centred 1880x1480 stage.  The right edge
# stops before the pet toast that pops up after every reload (~x=2238).
CROP_W, CROP_H, CROP_X, CROP_Y = 1880, 1480, 340, 46
# Flat cover for the floating toolbar in the bottom-right corner (its "S" glyph
# starts around x=2110); the colour was sampled from the surrounding stage.
COVER_X, COVER_Y, COVER_W, COVER_H = 2080, 1448, 160, 84
COVER_COLOR = "0xF6F8FA"
FPS = 30

REELS = {
    "short": {
        "out": "dsh-opening-demo-short.mp4",
        "suffix": "-short",
        "fade": 0.28,
        # wall-clock position of animation t = 0 in each raw take
        # (2026-10-29 18:47 takes; from the progress label read at T = 2.0 s)
        "start": {"zh": 0.095, "en": 0.471, "ru": 0.245, "ja": 0.172},
    },
    "full": {
        "out": "dsh-opening-demo.mp4",
        "suffix": "",
        "fade": 0.52,
        # 2026-10-29 18:49 takes; fitted to the 1% steps of the progress label
        # (percent read at T = 8.0 s, lattice fit 10 s, residual ~18 ms)
        "start": {"zh": 0.194, "en": 0.172, "ru": 0.289, "ja": -0.105},
    },
}

ORDER = ["zh", "en", "ru", "ja"]


def run(cmd: list[str]) -> None:
    result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if result.returncode != 0:
        sys.stderr.write(result.stderr[-5000:])
        raise SystemExit("ffmpeg failed")


def cue_total(key: str) -> float:
    data = json.loads((ASSETS / f"boot-{key}.sequence.json").read_text(encoding="utf-8"))
    return float(data["total"])


def build_reel(name: str) -> None:
    reel = REELS[name]
    print(f"[{name}]")
    inputs: list[str] = []
    chains: list[str] = []
    pads: list[str] = []
    for index, lang in enumerate(ORDER):
        key = f"{lang}{reel['suffix']}"
        span = round(cue_total(key) - reel["fade"], 3)
        start = reel["start"][lang]
        v0 = max(0.0, start)
        a0 = max(0.0, -start)
        dur = round(span - a0, 3)
        raw = ROOT / "demo" / f"raw-{key}.mp4"
        track = ASSETS / f"boot-{key}.ogg"
        for path in (raw, track):
            if not path.exists():
                raise SystemExit(f"missing input: {path}")
        inputs += ["-ss", f"{v0:.3f}", "-t", f"{dur:.3f}", "-i", str(raw)]
        inputs += ["-i", str(track)]
        vi, ai = index * 2, index * 2 + 1
        chains.append(
            f"[{vi}:v]drawbox=x={COVER_X}:y={COVER_Y}:w={COVER_W}:h={COVER_H}:color={COVER_COLOR}@1:t=fill,"
            f"crop={CROP_W}:{CROP_H}:{CROP_X}:{CROP_Y},fps={FPS},setsar=1,setpts=PTS-STARTPTS,format=yuv420p[v{index}]"
        )
        chains.append(
            f"[{ai}:a]atrim=start={a0:.3f}:duration={dur:.3f},"
            f"asetpts=PTS-STARTPTS,afade=t=out:st={max(0.0, dur - 0.1):.3f}:d=0.1[a{index}]"
        )
        pads.append(f"[v{index}][a{index}]")
        print(f"  {key}: {dur:.3f}s (video from {v0:.3f}, audio from {a0:.3f})")

    graph = ";".join(chains) + ";" + "".join(pads) + f"concat=n={len(ORDER)}:v=1:a=1[v][a]"
    out = ROOT / "demo" / reel["out"]
    cmd = [
        str(FFMPEG), "-hide_banner", "-loglevel", "error", "-y", *inputs,
        "-filter_complex", graph,
        "-map", "[v]", "-map", "[a]",
        "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-profile:v", "high",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
        "-movflags", "+faststart", str(out),
    ]
    run(cmd)
    print(f"  -> {out.relative_to(ROOT)} ({out.stat().st_size / 1024 / 1024:.1f} MiB)")


def main() -> None:
    which = sys.argv[1] if len(sys.argv) > 1 else "both"
    names = ["short", "full"] if which == "both" else [which]
    for name in names:
        if name not in REELS:
            raise SystemExit(f"unknown reel: {name}")
        build_reel(name)


if __name__ == "__main__":
    main()
