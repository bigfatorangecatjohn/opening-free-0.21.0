# -*- coding: utf-8 -*-
"""Build the one audio track the boot sequence actually plays.

One language per track: the five access-protocol steps and the closing salute
are all spoken in the same voice, because a boot sequence that starts in
Chinese and salutes in Russian reads like three different machines talking.

    lead-in -> step 1..5 (same language) -> pause -> salute (same language) -> tail

The lead-in is the silent beat where the whale mark fades in and out; the tail
is the beat where the salute stays on screen before the stage dissolves.

Pads are not hard-coded: the script measures how long the spoken lines came out
and distributes the remaining time across the gaps so every language lands on
the same `--target` (18 s by default).

Every segment is rendered with the same engines and the same mechanical colour
as tools\\make-samples.py. The resulting timeline is written next to the WAV as
.sequence.json so client.js can stay a dumb player.

Usage:

    .venv-tts\\Scripts\\python.exe tools\\build-boot-track.py --lang zh --mech 0.75
    .venv-tts\\Scripts\\python.exe tools\\build-boot-track.py --lang en --mech 0.75
    .venv-tts\\Scripts\\python.exe tools\\build-boot-track.py --lang ru --mech 0.75
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

# Fixed beats. The lead-in carries the whale mark; the tail carries the salute.
LEAD_IN = 2.60
TAIL = 1.30

# Relative widths of the gaps that eat whatever time the speech left over:
# four gaps between the steps, then one longer breath before the salute.
GAP_WEIGHTS = [1.0, 1.0, 1.0, 1.0, 1.45]


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


def seconds(block):
    return block.size / float(TARGET_RATE)


NOTE_HZ = (1046.50, 1318.51, 1567.98)  # C6 - E6 - G6, rising major triad
NOTE_AT = (0.10, 0.34, 0.58)
MARK_AT = 1.02


def chime(rate, freq, dur=0.55, decay=2.6, gain=0.30):
    """A single clean chime: sine fundamental, two faint harmonics, glassy shimmer.

    The previous prompt sat at 987 Hz with 0.35 / 0.18 partials and a 0.20 s
    tail, which read as a beeper. This one is an octave up, the partials are
    much weaker, and the tail is longer and softer, so it reads as a struck
    bell instead of an alarm.
    """
    count = int(round(rate * dur))
    t = np.arange(count, dtype=np.float64) / rate
    attack = np.minimum(1.0, t / 0.006)
    vibrato = 0.10 * np.sin(2.0 * np.pi * 5.0 * t)
    body = np.sin(2.0 * np.pi * freq * t + vibrato) * np.exp(-decay * t)
    upper = 0.16 * np.sin(2.0 * np.pi * freq * 2.004 * t) * np.exp(-decay * 2.1 * t)
    air = 0.04 * np.sin(2.0 * np.pi * freq * 3.008 * t) * np.exp(-decay * 3.4 * t)
    return ((body + upper + air) * attack * gain).astype(np.float32)


def chimes(rate, length, gain=0.30):
    """Three rising notes laid into a lead-in of `length` seconds."""
    buffer = np.zeros(int(round(rate * length)), dtype=np.float32)
    for freq, at in zip(NOTE_HZ, NOTE_AT):
        one = chime(rate, freq, gain=gain)
        start = int(round(rate * at))
        stop = min(buffer.size, start + one.size)
        if stop > start:
            buffer[start:stop] += one[: stop - start]
    return buffer


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
    parser = argparse.ArgumentParser(description="Build one boot-sequence audio track.")
    parser.add_argument("--lang", default="zh", choices=["zh", "en", "ru"])
    parser.add_argument("--mech", type=float, default=0.6)
    parser.add_argument("--speed-zh", type=float, default=make_samples.SPEED["zh"])
    parser.add_argument("--speed-en", type=float, default=make_samples.SPEED["en"])
    parser.add_argument("--speed-ru", type=float, default=make_samples.SPEED["ru"])
    parser.add_argument("--ru-voice", default="baya")
    parser.add_argument("--target", type=float, default=18.0)
    parser.add_argument("--out", default=None)
    args = parser.parse_args(argv)

    speed = {"zh": args.speed_zh, "en": args.speed_en, "ru": args.speed_ru}[args.lang]
    out = args.out or os.path.join(ASSET_DIR, "boot-%s.wav" % args.lang)
    if not os.path.isdir(ASSET_DIR):
        os.makedirs(ASSET_DIR)

    voice = Voice(args.mech, args.ru_voice)
    texts = make_samples.LINES[args.lang]["text"]
    if len(texts) < 6:
        raise SystemExit("%s needs 6 lines (5 steps + salute), found %d" % (args.lang, len(texts)))

    print("%s steps at %.2fx, mech %.2f ..." % (args.lang, speed, args.mech), flush=True)
    steps = [voice.line(args.lang, text, speed) for text in texts[:5]]
    print("salute ...", flush=True)
    salute = voice.line(args.lang, texts[5], speed)

    speech = sum(seconds(block) for block in steps) + seconds(salute)
    spare = args.target - LEAD_IN - TAIL - speech
    weight_sum = sum(GAP_WEIGHTS)
    gaps = [max(0.35, spare * weight / weight_sum) for weight in GAP_WEIGHTS] if spare > 0 else [0.35] * 5

    pieces = []
    order = []
    cursor = 0.0

    def push(block, label=None):
        nonlocal cursor
        at = cursor
        pieces.append(block)
        cursor += seconds(block)
        if label:
            order.append((label, at, seconds(block)))
        return at

    # Lead-in: three chimes, then the mark surfaces as the last one rings out.
    mark_at = MARK_AT
    mark_dur = round(LEAD_IN - mark_at, 3)
    push(chimes(TARGET_RATE, LEAD_IN), "lead")
    for index, block in enumerate(steps):
        push(block, "step%d" % (index + 1))
        push(silence(gaps[index]), "gap")
    push(salute, "salute")
    push(silence(TAIL), "tail")

    track = np.concatenate(pieces).astype(np.float32)
    total = seconds(track)

    # On-screen labels are always the bilingual pair (Chinese lead, English
    # subtitles) so the same layout works no matter which track is playing.
    display = {}
    for index in range(5):
        display["step%d" % (index + 1)] = {
            "zh": make_samples.LINES["zh"]["text"][index],
            "en": make_samples.LINES["en"]["text"][index],
        }

    cues = []
    for name, at, dur in order:
        if name in ("lead", "tail"):
            continue
        cue = {"name": name, "at": round(at, 3), "dur": round(dur, 3), "end": round(at + dur, 3)}
        if name in display:
            cue.update(display[name])
        elif name == "salute":
            cue.update({"lang": args.lang, "text": texts[5]})
        cues.append(cue)

    for cue in cues:
        if cue["name"].startswith("step"):
            index = int(cue["name"][4:]) - 1
            cue["text"] = {
                lang: make_samples.LINES[lang]["text"][index]
                for lang in ("zh", "en", "ru")
            }

    timeline = {
        "lang": args.lang,
        "sampleRate": TARGET_RATE,
        "total": round(total, 3),
        "mech": args.mech,
        "speeds": {"zh": args.speed_zh, "en": args.speed_en, "ru": args.speed_ru},
        "leadIn": round(LEAD_IN, 3),
        "tail": round(TAIL, 3),
        "gaps": [round(gap, 3) for gap in gaps],
        "mark": {"at": mark_at, "dur": mark_dur},
        "chimes": {"notes": list(NOTE_HZ), "at": list(NOTE_AT), "markAt": MARK_AT},
        "cues": cues,
    }

    make_samples.write_wav(out, track, TARGET_RATE)
    manifest = os.path.splitext(out)[0] + ".sequence.json"
    with open(manifest, "w", encoding="utf-8") as handle:
        json.dump(timeline, handle, ensure_ascii=False, indent=2)

    print("")
    print("track   : %s" % out)
    print("size    : %.1f KiB" % (os.path.getsize(out) / 1024.0))
    print("manifest: %s" % manifest)
    print("speech  : %.2f s, gaps %s" % (speech, ", ".join("%.2f" % g for g in gaps)))
    print("total   : %.2f s (target %.2f)" % (total, args.target))
    for cue in timeline["cues"]:
        print("  %-8s %6.2fs -> %6.2fs" % (cue["name"], cue["at"], cue["end"]))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
