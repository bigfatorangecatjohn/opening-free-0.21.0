# -*- coding: utf-8 -*-
"""Build the one audio track the boot sequence actually plays.

The animation speaks Chinese; the closing salute speaks Russian, Chinese and
English in that order. So the runtime track is:

    lead-in -> zh step 1..5 -> pause -> ru salute -> zh salute -> en salute -> tail

Every segment is rendered with the same engines and the same mechanical colour
as tools\\make-samples.py, then joined with fixed pads. The resulting timeline is
written next to the WAV as .sequence.json so client.js can stay a dumb player.

Usage:

    .venv-tts\\Scripts\\python.exe tools\\build-boot-track.py
    .venv-tts\\Scripts\\python.exe tools\\build-boot-track.py --mech 0.6
"""

import argparse
import importlib.util
import json
import os
import sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

import numpy as np  # noqa: E402

ASSET_DIR = os.path.join(HERE, "plugin", "dsh-opening", "assets")
TARGET_RATE = 24000

# Pads, in seconds. The spoken lines are short (~1.1-1.8 s each); the pacing
# comes from these beats. Tuned to land the whole sequence on ~18 s.
LEAD_IN = 0.90
PAD_STEP = 0.62
PAD_BEFORE_FINALE = 0.90
PAD_FINALE_LINE = 0.55
TAIL = 1.50


def load_samples_module():
    """make-samples.py has a dash in its name, so import it by path."""
    path = os.path.join(HERE, "tools", "make-samples.py")
    spec = importlib.util.spec_from_file_location("make_samples", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


make_samples = load_samples_module()


def resample_to(samples, rate, target):
    """Cheap but clean enough: band-limit on downsample, then interpolate."""
    data = np.asarray(samples, dtype=np.float32).reshape(-1)
    rate = int(rate)
    if rate == target or data.size == 0:
        return data
    if rate > target:
        data = make_samples.band_limit(data, rate, low=60.0, high=target * 0.42)
    count = int(round(data.size * float(target) / float(rate)))
    source = np.arange(data.size, dtype=np.float64)
    target_positions = np.linspace(0.0, data.size - 1.0, count, dtype=np.float64)
    return np.interp(target_positions, source, data).astype(np.float32)


def silence(seconds):
    return np.zeros(int(round(seconds * TARGET_RATE)), dtype=np.float32)


class Voice:
    """One renderer per engine, loaded once."""

    def __init__(self, mech_level, ru_voice):
        self.mech_level = mech_level
        self.ru_voice = ru_voice
        self._pipelines = {}
        self._silero = None

    def _pipeline(self, lang_code):
        if lang_code not in self._pipelines:
            make_samples.patch_local_models()
            from kokoro import KPipeline

            self._pipelines[lang_code] = KPipeline(
                lang_code=lang_code, repo_id="hexgrad/Kokoro-82M"
            )
        return self._pipelines[lang_code]

    def kokoro(self, lang, text, speed):
        spec = make_samples.LINES[lang]
        pipeline = self._pipeline(spec["kokoro_lang"])
        chunks = []
        for _gs, _ps, audio in pipeline(text, voice=spec["voice"], speed=speed):
            array = (
                audio.detach().cpu().numpy()
                if hasattr(audio, "detach")
                else np.asarray(audio)
            )
            chunks.append(np.asarray(array, dtype=np.float32).reshape(-1))
        samples = np.concatenate(chunks) if chunks else np.zeros(0, dtype=np.float32)
        return make_samples.mech(samples, 24000, self.mech_level)

    def silero(self, lang, text):
        if self._silero is None:
            self._silero = make_samples.silero_model()
        audio = self._silero.apply_tts(
            text=text, speaker=self.ru_voice, sample_rate=48000
        )
        array = (
            audio.detach().cpu().numpy() if hasattr(audio, "detach") else np.asarray(audio)
        )
        samples = resample_to(np.asarray(array, dtype=np.float32), 48000, TARGET_RATE)
        return make_samples.mech(samples, TARGET_RATE, self.mech_level)

    def line(self, lang, text, speed=1.0):
        if lang == "ru":
            return self.silero(lang, text)
        return self.kokoro(lang, text, speed)


def main(argv):
    parser = argparse.ArgumentParser(description="Build the boot-sequence audio track.")
    parser.add_argument("--mech", type=float, default=make_samples.MECH_LEVEL)
    parser.add_argument("--speed-zh", type=float, default=make_samples.SPEED["zh"])
    parser.add_argument("--ru-voice", default="baya")
    parser.add_argument("--out", default=os.path.join(ASSET_DIR, "boot.wav"))
    args = parser.parse_args(argv)

    if not os.path.isdir(ASSET_DIR):
        os.makedirs(ASSET_DIR)

    voice = Voice(args.mech, args.ru_voice)

    print("zh steps at %.2fx, mech %.2f ..." % (args.speed_zh, args.mech), flush=True)
    zh_texts = make_samples.LINES["zh"]["text"][:5]
    steps = [voice.kokoro("zh", text, args.speed_zh) for text in zh_texts]

    print("salutes ...", flush=True)
    salutes = [
        voice.line(lang, make_samples.LINES[lang]["text"][5]) for lang in ("ru", "zh", "en")
    ]

    pieces = []
    order = []
    cursor = 0.0

    def push(block, label=None):
        nonlocal cursor
        at = cursor
        pieces.append(block)
        cursor += block.size / float(TARGET_RATE)
        if label:
            order.append((label, at, block.size / float(TARGET_RATE)))
        return at

    push(silence(LEAD_IN), "lead")
    for index, block in enumerate(steps):
        push(block, "step%d" % (index + 1))
        push(silence(PAD_BEFORE_FINALE if index == len(steps) - 1 else PAD_STEP), "pad")
    for lang, block in zip(("ru", "zh", "en"), salutes):
        push(block, "finale-" + lang)
        push(silence(PAD_FINALE_LINE), "pad")
    push(silence(TAIL), "tail")

    track = np.concatenate(pieces).astype(np.float32)
    total = track.size / float(TARGET_RATE)

    timeline = {
        "sampleRate": TARGET_RATE,
        "total": round(total, 3),
        "mech": args.mech,
        "speed": {"zh": args.speed_zh},
        "cues": [
            {"name": name, "at": round(at, 3), "dur": round(dur, 3), "end": round(at + dur, 3)}
            for name, at, dur in order
            if not name.startswith("pad") and name not in ("lead", "tail")
        ],
    }

    make_samples.write_wav(args.out, track, TARGET_RATE)
    manifest = os.path.splitext(args.out)[0] + ".sequence.json"
    with open(manifest, "w", encoding="utf-8") as handle:
        json.dump(timeline, handle, ensure_ascii=False, indent=2)

    print("")
    print("track   : %s" % args.out)
    print("size    : %.1f KiB" % (os.path.getsize(args.out) / 1024.0))
    print("manifest: %s" % manifest)
    print("total   : %.2f s" % total)
    for cue in timeline["cues"]:
        print("  %-12s %6.2fs -> %6.2fs" % (cue["name"], cue["at"], cue["end"]))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
