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

# The short cut keeps the same opening chimes and the same whale, drops the
# five access steps, and lets the closing welcome speak straight after the ring.
SHORT_LEAD = 2.20
SHORT_TAIL = 0.28
SHORT_MARK_DUR = 1.14

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


TOP_HZ = {"zh": 4000.0, "en": 4600.0, "ru": 4600.0, "ja": 5200.0}

CHORDS = (
    (110.00, 164.81, 261.63, 329.63),   # Am
    (87.31, 174.61, 261.63, 349.23),    # F
    (130.81, 196.00, 329.63, 392.00),   # C
    (98.00, 146.83, 246.94, 293.66),    # G
)

NOTE_HZ = (1760.00, 1318.51, 1760.00, 1318.51)  # A6 / E6, a fourth apart
NOTE_AT = (0.08, 0.30, 0.52, 0.74)
MARK_AT = 1.06


def chime(rate, freq, dur=0.62, decay=4.6, gain=0.16):
    """One light droplet: higher, shorter and quieter than the first pass.

    "Soft but brisk" is a balance between level and tail: the strike is quiet
    (0.16, down from 0.20) while the decay is cut short (0.62 s, decay 4.6) so
    the note blooms and clears instead of hanging. The octave goes 0.09 -> 0.22
    for sparkle, but nothing above the octave is added, so the 3 kHz band that
    made the earlier triad harsh stays empty.
    """
    count = int(round(rate * dur))
    t = np.arange(count, dtype=np.float64) / rate
    attack = np.minimum(1.0, t / 0.006)
    glide = 1.0 + 0.026 * np.exp(-t / 0.04)
    phase = 2.0 * np.pi * freq * glide * t
    body = np.sin(phase) * np.exp(-decay * t)
    octave = 0.22 * np.sin(2.0 * phase) * np.exp(-decay * 1.7 * t)
    return ((body + octave) * attack * gain).astype(np.float32)


def water_swell(rate, length, level=0.010):
    """A soft filtered-noise wash under the drops: water flowing, not hiss."""
    rng = np.random.default_rng(7)
    count = int(round(rate * length))
    noise = rng.standard_normal(count).astype(np.float32)
    shaped = make_samples.band_limit(noise, rate, 900.0, 3400.0)
    t = np.arange(count, dtype=np.float64) / rate
    env = np.clip(t / 0.40, 0.0, 1.0) * np.clip((length - t) / 1.20, 0.0, 1.0)
    return (shaped * env * level).astype(np.float32)


def chimes(rate, length, gain=0.20):
    """Four alternating drops laid into a lead-in of `length` seconds."""
    buffer = np.zeros(int(round(rate * length)), dtype=np.float32)
    for freq, at in zip(NOTE_HZ, NOTE_AT):
        one = chime(rate, freq, gain=gain)
        start = int(round(rate * at))
        stop = min(buffer.size, start + one.size)
        if stop > start:
            buffer[start:stop] += one[: stop - start]
    return buffer + water_swell(rate, length)


# What the screen shows. Spoken text stays sentence case (a TTS engine reads
# ALL CAPS as initialisms), while the stage prints the military house style:
# every word capitalised, and the closing salute in full caps.
DISPLAY_STEPS = {
    "zh": ["需要访问许可", "身份资料确认", "接收访问需求", "开始读取权限", "读取完毕，核验通过"],
    "en": ["Access Permission Required", "Identity Verification",
           "Access Request Received", "Permission Read Started",
           "Read Complete · Verified"],
    "ru": ["Требуется Разрешение На Доступ", "Подтверждение Личности",
           "Запрос На Доступ Принят", "Начато Чтение Прав",
           "Чтение Завершено. Проверка Пройдена"],
    "ja": ["アクセス許可が必要です", "ご身分の確認", "アクセス要求を承りました",
           "権限の読み取りを開始", "読み取り完了 · 確認済み"],
}

DISPLAY_SALUTE = {
    "zh": "欢迎回来，指挥员",
    "en": "WELCOME BACK, COMMANDER",
    "ru": "ДОБРО ПОЖАЛОВАТЬ, ТОВАРИЩ",
    "ja": "おかえりなさいませ、ご主人様",
}


def split_salute(text, lang):
    """Split the closing greeting into a lead line and the addressee line."""
    clean = text.strip()
    if lang == "zh":
        parts = clean.replace("，", ",").split(",")
        if len(parts) >= 2:
            return [parts[0].strip() + "，", ",".join(parts[1:]).strip()]
        return [clean, ""]
    if lang == "ja":
        cut = clean.rfind("、")
        if cut > 0:
            return [clean[: cut + 1], clean[cut + 1:].strip()]
        return [clean, ""]
    parts = clean.rsplit(" ", 1)
    if len(parts) == 2:
        return [parts[0], parts[1]]
    return [clean, ""]


def music_bed(rate, length):
    """A clean pad under the voice: sustained chords plus a soft arpeggio."""
    total = int(round(rate * length))
    t_all = np.arange(total, dtype=np.float64) / rate
    out = np.zeros(total, dtype=np.float64)
    span = length / len(CHORDS)
    fade = 1.1
    for index, chord in enumerate(CHORDS):
        start = index * span
        window = np.clip((t_all - start + fade) / (2.0 * fade), 0.0, 1.0)
        window = window * np.clip((start + span + fade - t_all) / (2.0 * fade), 0.0, 1.0)
        for freq in chord:
            tone = np.sin(2.0 * np.pi * freq * t_all)
            tone += 0.5 * np.sin(2.0 * np.pi * freq * 1.004 * t_all)
            tone += 0.22 * np.sin(2.0 * np.pi * freq * 2.0 * t_all)
            out += tone * window * 0.10

    note_index = 0
    for at in np.arange(0.55, length - 1.1, 0.45):
        chord = CHORDS[int(at // span) % len(CHORDS)]
        freq = chord[note_index % len(chord)] * 2.0
        note_index += 1
        count = int(round(rate * 0.55))
        t = np.arange(count, dtype=np.float64) / rate
        pluck = np.sin(2.0 * np.pi * freq * t) * np.exp(-6.0 * t)
        start = int(round(rate * at))
        stop = min(total, start + count)
        if stop > start:
            out[start:stop] += pluck[: stop - start] * 0.022

    bed = make_samples.band_limit(out.astype(np.float32), rate, 60.0, 2600.0)
    peak = float(np.max(np.abs(bed))) if bed.size else 0.0
    if peak > 0:
        bed = bed / peak
    return bed.astype(np.float32)


def duck_bed(voice, bed, rate, amount=0.62):
    """Pull the bed down while the voice speaks, so it never fights the words."""
    win = max(1, int(round(0.005 * rate)))
    count = voice.size // win
    if count < 4 or bed.size != voice.size:
        return bed
    blocks = np.abs(voice[: count * win]).reshape(count, win).max(axis=1)
    smooth = max(3, int(round(0.30 * rate / win)))
    kernel = np.hanning(smooth + 2)[1:-1]
    kernel = kernel / kernel.sum()
    blocks = np.convolve(blocks, kernel, mode="same")
    centers = np.arange(count) * win + win * 0.5
    env = np.interp(np.arange(voice.size), centers, blocks).astype(np.float32)
    gain = 1.0 - amount * np.clip(env / 0.55, 0.0, 1.0)
    return (bed * gain).astype(np.float32)


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
        return make_samples.mech(samples, 24000, self.mech_level, top=TOP_HZ.get(lang, 3800.0))

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
        return make_samples.mech(samples, TARGET_RATE, self.mech_level, top=TOP_HZ.get(lang, 3800.0))

    def line(self, lang, text, speed=1.0):
        if lang == "ru":
            return self.silero(lang, text)
        return self.kokoro(lang, text, speed)


def build_short(args, salute):
    """Chimes + closing welcome only. Same opening audio, same mark timing."""
    # Slice the full lead-in so the chimes are sample-identical to the long cut.
    lead = chimes(TARGET_RATE, LEAD_IN)[: int(round(TARGET_RATE * SHORT_LEAD))]
    mark_at = MARK_AT
    pieces = [lead, salute, silence(SHORT_TAIL)]
    track = np.concatenate(pieces).astype(np.float32)
    total = seconds(track)

    bed = music_bed(TARGET_RATE, total)
    track = track + 0.10 * duck_bed(track, bed, TARGET_RATE)

    salute_at = round(seconds(lead), 3)
    shown = DISPLAY_SALUTE[args.lang]
    cue = {
        "name": "salute",
        "at": salute_at,
        "dur": round(seconds(salute), 3),
        "end": round(salute_at + seconds(salute), 3),
        "lang": args.lang,
        "text": shown,
        "lines": split_salute(shown, args.lang),
    }

    timeline = {
        "lang": args.lang,
        "short": True,
        "sampleRate": TARGET_RATE,
        "total": round(total, 3),
        "mech": args.mech,
        "speeds": {"zh": args.speed_zh, "en": args.speed_en, "ru": args.speed_ru},
        "leadIn": SHORT_LEAD,
        "tail": SHORT_TAIL,
        "gaps": [],
        "mark": {"at": mark_at, "dur": SHORT_MARK_DUR},
        "chimes": {
            "notes": list(NOTE_HZ),
            "at": list(NOTE_AT),
            "markAt": MARK_AT,
            "kind": "water-drop",
        },
        "cues": [cue],
    }

    make_samples.write_wav(args.out, track, TARGET_RATE)
    manifest = os.path.splitext(args.out)[0] + ".sequence.json"
    with open(manifest, "w", encoding="utf-8") as handle:
        json.dump(timeline, handle, ensure_ascii=False, indent=2)
        handle.write("\n")

    print("track   : %s" % args.out)
    print("size    : %.1f KiB" % (os.path.getsize(args.out) / 1024.0))
    print("manifest: %s" % manifest)
    print("speech  : %.2f s" % seconds(salute))
    print("total   : %.2f s (short)" % total)
    print("  salute %.2fs -> %.2fs" % (salute_at, salute_at + seconds(salute)))
    return 0


def main(argv):
    parser = argparse.ArgumentParser(description="Build one boot-sequence audio track.")
    parser.add_argument("--lang", default="zh", choices=["zh", "en", "ru", "ja"])
    parser.add_argument("--mech", type=float, default=0.6)
    parser.add_argument("--speed-zh", type=float, default=make_samples.SPEED["zh"])
    parser.add_argument("--speed-en", type=float, default=make_samples.SPEED["en"])
    parser.add_argument("--speed-ru", type=float, default=make_samples.SPEED["ru"])
    parser.add_argument("--speed-ja", type=float, default=make_samples.SPEED["ja"])
    parser.add_argument("--ru-voice", default="baya")
    parser.add_argument("--target", type=float, default=18.0)
    parser.add_argument("--out", default=None)
    parser.add_argument(
        "--short",
        action="store_true",
        help="closing welcome only, ~3 s, same chimes and same mark",
    )
    args = parser.parse_args(argv)

    speed = {
        "zh": args.speed_zh,
        "en": args.speed_en,
        "ru": args.speed_ru,
        "ja": args.speed_ja,
    }[args.lang]
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

    if args.short:
        return build_short(args, salute)

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

    bed = music_bed(TARGET_RATE, total)
    track = track + 0.10 * duck_bed(track, bed, TARGET_RATE)

    # On-screen labels are always the bilingual pair (Chinese lead, English
    # subtitles) so the same layout works no matter which track is playing.
    display = {}
    for index in range(5):
        display["step%d" % (index + 1)] = {
            code: DISPLAY_STEPS[code][index] for code in ("zh", "en", "ru", "ja")
        }

    cues = []
    for name, at, dur in order:
        if name in ("lead", "tail"):
            continue
        cue = {"name": name, "at": round(at, 3), "dur": round(dur, 3), "end": round(at + dur, 3)}
        if name in display:
            cue.update(display[name])
        elif name == "salute":
            shown = DISPLAY_SALUTE[args.lang]
            cue.update({"lang": args.lang, "text": shown, "lines": split_salute(shown, args.lang)})
        cues.append(cue)

    for cue in cues:
        if cue["name"].startswith("step"):
            index = int(cue["name"][4:]) - 1
            cue["text"] = {code: DISPLAY_STEPS[code][index] for code in ("zh", "en", "ru", "ja")}

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
        "chimes": {"notes": list(NOTE_HZ), "at": list(NOTE_AT), "markAt": MARK_AT, "kind": "water-drop"},
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
