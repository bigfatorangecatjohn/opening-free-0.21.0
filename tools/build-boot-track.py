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
# The long sequence now opens on the short cut's whale instead of the four
# water drops. 0.74 s keeps the whole call plus its hall tail inside LEAD_IN.
WHALE_LEAD_AT = 0.74
WHALE_LEAD_GAIN = 0.50


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


# Every language lands the salute on the same beat now, so the whale gets the
# same room to cross the frame whichever line it is announcing. The cut is as
# long as the slowest line needs and no longer: Chinese stays at 3.80 s, the
# Japanese master runs to 4.13 s, and nothing is allowed past the ceiling.
SHORT_MIN_TOTAL = 3.80
SHORT_MAX_TOTAL = 4.55
SHORT_SALUTE_AT = 1.62
SHORT_TAIL_S = 0.30
SHORT_NAME_GAP = 0.30
SHORT_LEAD_SPEED = 0.94
SHORT_NAME_SPEED = 0.84
SHORT_WHALE_LEN = 1.45  # the recorded call is 1.45 s long; see make-whale-call.py


def stream_sweep(rate, length):
    """A blue data stream: water whipped past the ear, nothing else.

    There used to be a 1500 -> 170 Hz falling zap under it. That zap was the
    "咻- biu" the user asked to take out: a rubber-band sound sitting on top of
    the water and announcing the synth, not the sea.
    """
    rng = np.random.default_rng(11)
    count = int(round(rate * length))
    t = np.arange(count, dtype=np.float64) / float(rate)
    noise = rng.standard_normal(count).astype(np.float32)
    bright = make_samples.band_limit(noise, rate, 1700.0, 7600.0)
    dark = make_samples.band_limit(noise, rate, 320.0, 2200.0)
    rise = np.clip(t / (length * 0.52), 0.0, 1.0) ** 2
    fall = np.clip(1.0 - (t - length * 0.58) / (length * 0.42), 0.0, 1.0)
    body = (bright * rise + dark * (1.0 - rise)) * rise * fall
    return (body * 0.52).astype(np.float32)


def sub_swell(rate, length=1.15):
    """A bed, not a hit: the low end that takes over when the stream breaks.

    The burst used to have an impact (noise crack + 56 Hz thump) and the user
    asked for the "啪" to go. What is left here has no transient at all: a
    smoothstep rise of 0.32 s, a slow pitch lift from 37 to 47 Hz, and two
    slightly detuned saws that beat against each other so the drone sounds
    like a machine idling rather than a drum.
    """
    count = int(round(rate * length))
    t = np.arange(count, dtype=np.float64) / float(rate)
    u = t / float(length)

    rise = np.clip(t / 0.18, 0.0, 1.0)
    rise = rise * rise * (3.0 - 2.0 * rise)
    fall = np.clip(1.0 - (t - (length - 0.55)) / 0.55, 0.0, 1.0)
    fall = fall * fall * (3.0 - 2.0 * fall)
    env = rise * fall

    f = 37.0 + 10.0 * rise
    phase = 2.0 * np.pi * np.cumsum(f) / float(rate)
    sub = np.sin(phase) * 0.90 + np.sin(phase * 2.0 + 0.7) * 0.22

    def saw(freq, offset):
        return 2.0 * (((freq * t + offset) % 1.0) - 0.5)

    pad = (saw(55.0, 0.0) + saw(55.6, 0.31)) * 0.5
    pad = make_samples.band_limit(pad.astype(np.float32), rate, 40.0, 260.0)

    air = (np.sin(2.0 * np.pi * 164.8 * t) * 0.18
           + np.sin(2.0 * np.pi * 246.9 * t + 1.3) * 0.10)
    air = air * (0.30 + 0.70 * np.exp(-(((u - 0.42) / 0.34) ** 2)))

    body = sub * 0.40 + pad * 1.55 + air * 0.09
    return (body * env).astype(np.float32)




WHALE_SRC = os.path.normpath(os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "samples", "boot",
    "whale-call-src.wav"))


def load_whale_source(rate, length):
    """Read the recorded call (tools/make-whale-call.py) at the boot rate."""
    import wave

    if not os.path.exists(WHALE_SRC):
        raise SystemExit(
            "missing whale sample: %s (run tools/make-whale-call.py)"
            % WHALE_SRC)
    with wave.open(WHALE_SRC, "rb") as handle:
        if handle.getsampwidth() != 2:
            raise SystemExit("whale sample must be 16-bit pcm: %s" % WHALE_SRC)
        src_rate = handle.getframerate()
        channels = handle.getnchannels()
        raw = handle.readframes(handle.getnframes())
    data = np.frombuffer(raw, dtype="<i2").astype(np.float32) / 32768.0
    if channels > 1:
        data = data.reshape(-1, channels).mean(axis=1)
    if src_rate != rate and data.size > 1:
        want = max(2, int(round(data.size * rate / float(src_rate))))
        data = np.interp(np.linspace(0.0, data.size - 1.0, want),
                         np.arange(data.size), data).astype(np.float32)
    want = int(round(rate * length))
    if data.size >= want:
        return data[:want]
    return np.pad(data, (0, want - data.size))


def whale_call(rate, length=SHORT_WHALE_LEN, gain=0.80):
    """The recorded call, run through a cyberpunk treatment chain.

    The animal itself is samples/boot/whale-call-src.wav: 1.60-2.65 s of the
    reference recording, which is one whole phrase. Everything below is what
    turns a field recording into something that belongs to this boot sequence:

    * the band is split three ways (dark / mid / bright) and recombined under a
      moving mask, so the tone brightens as it passes the middle of the call,
      like a scanner light running over it;
    * a sample-hold + 7-bit quantise layer adds digital grit, aliasing and all;
    * a 173 Hz ring modulation lays metallic sidebands around the body without
      moving its pitch, which is the part that reads as "synthetic" rather than
      "sea";
    * a 46 Hz sub rises and falls with the phrase and a dark hall tail seats it
      in the room.
    """
    count = int(round(rate * length))
    src = load_whale_source(rate, length)
    t = np.arange(count, dtype=np.float64) / float(rate)
    u = t / max(count - 1, 1)

    # The phrase dips about 6 dB before its swell, which makes the call sound
    # late under the visuals. A 40 % compression (exponent 0.6 over a 150 ms
    # envelope) lifts the head without flattening the swell itself.
    span = max(1, int(round(rate * 0.15)))
    kernel = np.ones(span, dtype=np.float64) / float(span)
    env = np.convolve(np.abs(src).astype(np.float64), kernel, mode="same")
    med = float(np.median(env[env > 1e-5])) if np.any(env > 1e-5) else 1.0
    src = (src * np.clip((med / np.maximum(env, 1e-4)) ** 0.60,
                         0.55, 2.40)).astype(np.float32)

    dark = make_samples.band_limit(src, rate, 95.0, 520.0)
    mid = make_samples.band_limit(src, rate, 260.0, 1500.0)
    bright = make_samples.band_limit(src, rate, 900.0, 3600.0)
    presence = make_samples.band_limit(src, rate, 1600.0, 4200.0)
    sweep = np.exp(-((u - 0.62) / 0.24) ** 2)
    # The recording is a low moan: almost nothing lives above 1.5 kHz, so
    # re-weighting the bands alone cannot make it brighter. Drive the body
    # through a soft saturator and keep only its top: that generates the upper
    # harmonics instead of borrowing them.
    sheen = make_samples.band_limit(
        np.tanh(src.astype(np.float64) * 3.4).astype(np.float32), rate, 1300.0, 5200.0)
    body = (dark * 0.80 + mid * 1.00
            + bright * (0.55 + 0.85 * sweep) + presence * 0.30 + sheen * 0.60)

    grit = make_samples.quantize(make_samples.sample_hold(body, 3), 7)
    grit = make_samples.band_limit(grit, rate, 320.0, 5200.0)

    ring = body * np.sin(2.0 * np.pi * 173.0 * t + 0.6)
    ring = make_samples.band_limit(ring.astype(np.float32), rate, 300.0, 4200.0)

    sub = np.sin(2.0 * np.pi * 46.0 * t) * np.clip(np.sin(np.pi * u), 0.0, 1.0) ** 1.5

    call = body * 1.00 + grit * 0.16 + ring * 0.20 + sub * 0.10

    attack = np.clip(t / 0.06, 0.0, 1.0)
    release = np.clip((1.0 - u) / 0.20, 0.0, 1.0) ** 0.9
    call = (call * attack * release * gain).astype(np.float32)
    return hall_tail(call, rate, length=1.05, decay=3.0, wet=0.30,
                     cutoff=2400.0, extra=0.40)


def whale_lead(rate, length=LEAD_IN, at=WHALE_LEAD_AT, gain=WHALE_LEAD_GAIN):
    """The short cut's recorded call, opening the long sequence.

    The full master used to open with four water drops. The user asked for the
    same whale the short cut sings, so the call plus its hall tail (1.45 +
    0.40 s) is laid in at 0.74 s: it ends at 2.59 s, just inside the 2.60 s
    lead-in, and hands the quiet window over to the first spoken step.
    """
    buffer = np.zeros(int(round(rate * length)), dtype=np.float32)
    call = whale_call(rate, SHORT_WHALE_LEN, gain=gain)
    start = int(round(rate * at))
    stop = min(buffer.size, start + call.size)
    if stop > start:
        buffer[start:stop] += call[: stop - start]
    return (buffer + water_swell(rate, length, level=0.012)).astype(np.float32)


def preload_ticks(rate, length=0.54, gain=0.085):
    """The bar charging: a quiet ladder of digital ticks.

    The first half second is the machine waking up, so it should sound like
    hardware counting, not like water arriving out of nowhere: eleven 12 ms
    clicks, one every 45 ms, climbing 1.18 -> 2.14 kHz, each a short sine with
    a band-passed noise snout. They stop on the burst.
    """
    count = int(round(rate * length))
    buffer = np.zeros(count, dtype=np.float32)
    rng = np.random.default_rng(97)
    for i in range(11):
        n = int(round(rate * 0.012))
        t = np.arange(n, dtype=np.float64) / float(rate)
        env = np.clip(t / 0.0008, 0.0, 1.0) * np.exp(-t / 0.0028)
        tone = np.sin(2.0 * np.pi * (1180.0 + 96.0 * i) * t) * 0.60
        snout = make_samples.band_limit(
            rng.standard_normal(n).astype(np.float32), rate, 2400.0, 7200.0) * 0.50
        one = ((tone + snout) * env).astype(np.float32)
        start = int(round(rate * (0.02 + i * 0.045)))
        stop = min(count, start + one.size)
        if stop > start:
            buffer[start:stop] += one[: stop - start]
    return (buffer * gain).astype(np.float32)


def hologram_shimmer(rate, length=0.62, gain=0.30):
    """Scattered dots finding their places: three bells and a glitter tail."""
    buffer = np.zeros(int(round(rate * length)), dtype=np.float32)
    for freq, at, level in ((1760.00, 0.00, 1.00), (2637.02, 0.07, 0.72), (3520.00, 0.15, 0.46)):
        one = chime(rate, freq, dur=0.42, decay=7.5, gain=gain * level * 0.55)
        start = int(round(rate * at))
        stop = min(buffer.size, start + one.size)
        buffer[start:stop] += one[: stop - start]
    rng = np.random.default_rng(41)
    count = buffer.size
    t = np.arange(count, dtype=np.float64) / float(rate)
    glitter = make_samples.band_limit(
        rng.standard_normal(count).astype(np.float32), rate, 2600.0, 9000.0)
    env = np.clip(t / 0.10, 0, 1) * np.exp(-t / 0.28)
    return (buffer + glitter * env * 0.045).astype(np.float32)


def breath_hum(rate, length, gain=0.10):
    """The ring's breathing tone: two low sines with a 0.32 Hz swell."""
    count = int(round(rate * length))
    t = np.arange(count, dtype=np.float64) / float(rate)
    swell = 0.62 + 0.38 * np.sin(2.0 * np.pi * 0.32 * t - 1.1)
    tone = (np.sin(2.0 * np.pi * 55.0 * t) * 0.55
            + np.sin(2.0 * np.pi * 82.5 * t) * 0.30
            + np.sin(2.0 * np.pi * 110.0 * t) * 0.12)
    fade = np.clip(t / 0.25, 0, 1) * np.clip((length - t) / 0.20, 0, 1)
    return (tone * swell * fade * gain).astype(np.float32)


def fft_convolve(signal, impulse):
    """Linear convolution through the FFT: an 88k-sample track times a 26k
    impulse is 2.3e9 multiply-adds in the time domain and milliseconds here."""
    size = signal.size + impulse.size - 1
    nfft = 1 << int(size - 1).bit_length()
    spec = np.fft.rfft(signal, nfft) * np.fft.rfft(impulse, nfft)
    return np.fft.irfft(spec, nfft)[:size].astype(np.float32)


def hall_tail(samples, rate, length=0.90, decay=4.0, wet=0.24,
              cutoff=1500.0, extra=0.0):
    """A hall that is actually audible, unlike soft_reverb.

    soft_reverb divides the impulse by its absolute SUM, which leaves a ~-55 dB
    whisper. This one normalises by energy and low-passes the impulse, so a wet
    of 0.20 lands the tail about 14 dB under the dry voice: a long, warm halo
    that reads as a big room without smearing the consonants.
    """
    rng = np.random.default_rng(59)
    count = int(round(rate * length))
    t = np.arange(count, dtype=np.float64) / float(rate)
    noise = rng.standard_normal(count) * np.exp(-decay * t)
    alpha = 1.0 - np.exp(-2.0 * np.pi * cutoff / float(rate))
    dark = np.empty(count, dtype=np.float64)
    previous = 0.0
    for index in range(count):
        previous += alpha * (noise[index] - previous)
        dark[index] = previous
    dark = dark / max(1e-9, float(np.sqrt((dark ** 2).sum())))
    tail = fft_convolve(samples.astype(np.float32), dark.astype(np.float32))
    size = samples.size + int(round(rate * extra))
    out = np.zeros(size, dtype=np.float32)
    out[: samples.size] += samples
    take = min(size, tail.size)
    out[:take] += (wet * tail[:take]).astype(np.float32)
    return out


def soft_reverb(samples, rate, length=0.42, decay=7.5, wet=0.18):
    """A cheap tail: convolve with a decaying noise impulse."""
    rng = np.random.default_rng(59)
    count = int(round(rate * length))
    impulse = rng.standard_normal(count).astype(np.float32) * np.exp(-decay * np.arange(count) / rate)
    impulse = impulse / max(1e-6, float(np.abs(impulse).sum()))
    tail = np.convolve(samples.astype(np.float32), impulse).astype(np.float32)
    return (samples + wet * tail[: samples.size]).astype(np.float32)


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


def build_short(args, salute_lead, salute_name):
    """Three beats in 3.8-4.2 s: water sweep, burst + whale, rings, the salute.

    The salute starts while the whale call is still ringing; the call is ducked
    under the voice so the two read as one cross-fade instead of a collision.
    """
    rate = TARGET_RATE
    lead_s = seconds(salute_lead)
    name_s = seconds(salute_name)
    speech = lead_s + SHORT_NAME_GAP + name_s
    # The salute lands on the same beat in every language, so the whale gets
    # the same 0.94 s to cross the frame whether the address is five Chinese
    # characters or eleven kana. A line that runs long makes the cut longer;
    # it never squeezes the beats.
    start = round(min(SHORT_SALUTE_AT, max(1.05, SHORT_MAX_TOTAL - SHORT_TAIL_S - speech)), 3)
    total = round(max(SHORT_MIN_TOTAL, start + speech + SHORT_TAIL_S), 3)
    tail = round(total - start - speech, 3)
    track = np.zeros(int(round(rate * total)) + 1, dtype=np.float32)

    def put(block, at, gain=1.0):
        offset = int(round(rate * at))
        stop = min(track.size, offset + block.size)
        if stop > offset:
            track[offset:stop] += (block[: stop - offset] * gain).astype(np.float32)

    burst_at = 0.52
    whale_at = 0.58
    rings_at = 1.06
    put(preload_ticks(rate), 0.00)
    put(stream_sweep(rate, burst_at + 0.14), 0.00)
    put(sub_swell(rate), burst_at, 0.36)

    # The call survives the voice: a 0.34 s ramp takes it down to half level
    # once the salute is in, so its own exponential decay does the rest.
    call = whale_call(rate)
    at_call = np.arange(call.size, dtype=np.float64) / float(rate) + whale_at
    duck = 1.0 - 0.38 * np.clip((at_call - (start - 0.16)) / 0.34, 0.0, 1.0)
    put((call * duck.astype(np.float32)), whale_at, 1.00)

    put(hologram_shimmer(rate), rings_at, 0.86)
    put(breath_hum(rate, max(0.4, total - rings_at), gain=0.11), rings_at + 0.10, 0.90)

    salute_at = round(start, 3)
    name_at = round(start + lead_s + SHORT_NAME_GAP, 3)
    put(hall_tail(salute_lead, rate, length=0.46, decay=6.6, wet=0.13, extra=0.20), salute_at)
    # No landing boom on the name any more: the last "blast" was the only
    # percussive thing left in a cut that is otherwise water, an animal and a
    # voice. The name arrives on its reverb alone.
    put(hall_tail(salute_name, rate, length=1.05, decay=3.6, wet=0.24, extra=0.35), name_at)

    # The reverb wants to ring past the last frame; close it with a 100 ms fade
    # so the track never ends on a cut.
    fade_n = min(track.size, int(round(rate * 0.10)))
    track[-fade_n:] *= np.linspace(1.0, 0.0, fade_n, dtype=np.float32) ** 0.8

    peak = float(np.abs(track).max()) or 1.0
    track = (track * (0.86 / peak)).astype(np.float32)

    shown = DISPLAY_SALUTE[args.lang]
    lines = split_salute(shown, args.lang)
    cue = {
        "name": "salute",
        "at": salute_at,
        "dur": round(name_at + name_s - salute_at, 3),
        "end": round(name_at + name_s, 3),
        "lang": args.lang,
        "text": shown,
        "lines": lines,
    }

    timeline = {
        "lang": args.lang,
        "short": True,
        "sampleRate": rate,
        "total": total,
        "mech": args.mech,
        "speeds": {"zh": args.speed_zh, "en": args.speed_en, "ru": args.speed_ru,
                   "ja": args.speed_ja},
        "leadIn": total,
        "tail": tail,
        "gaps": [],
        "mark": {"at": 0.0, "dur": 0.0},
        "phases": {
            "sweep": [0.0, burst_at],
            "burst": burst_at,
            "whale": [whale_at, round(whale_at + SHORT_WHALE_LEN, 3)],
            "rings": rings_at,
            "salute": salute_at,
            "name": name_at,
        },
        "speech": {"lead": round(lead_s, 3), "name": round(name_s, 3)},
        "cues": [cue],
    }

    make_samples.write_wav(args.out, track, rate)
    manifest = os.path.splitext(args.out)[0] + ".sequence.json"
    with open(manifest, "w", encoding="utf-8") as handle:
        json.dump(timeline, handle, ensure_ascii=False, indent=2)
        handle.write("\n")

    print("track   : %s" % args.out)
    print("size    : %.1f KiB" % (os.path.getsize(args.out) / 1024.0))
    print("manifest: %s" % manifest)
    print("speech  : %.2f s lead + %.2f s name" % (lead_s, name_s))
    print("total   : %.2f s (short, cyber)" % total)
    print("  sweep %.2fs | burst %.2fs | whale %.2fs | rings %.2fs"
          % (burst_at, burst_at, whale_at, rings_at))
    print("  salute %.2fs -> %.2fs, name at %.2fs"
          % (salute_at, name_at + name_s, name_at))
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
        help="the cyber cut (3.8-4.6 s): sweep, whale, rings, the salute",
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
        lines = split_salute(make_samples.LINES[args.lang]["text"][5], args.lang)
        lead_block = voice.line(args.lang, lines[0], speed * SHORT_LEAD_SPEED)
        name_block = voice.line(args.lang, lines[1], speed * SHORT_NAME_SPEED)
        for _attempt in range(3):
            lead_s, name_s = seconds(lead_block), seconds(name_block)
            speech = lead_s + SHORT_NAME_GAP + name_s
            start = max(1.05, min(SHORT_SALUTE_AT, SHORT_MAX_TOTAL - SHORT_TAIL_S - speech))
            if start + speech + SHORT_TAIL_S <= SHORT_MAX_TOTAL + 0.005:
                break
            # The name keeps its weight; the lead line absorbs the overrun.
            room = SHORT_MAX_TOTAL - start - SHORT_TAIL_S - SHORT_NAME_GAP - name_s
            if room <= 0.2:
                break
            print("%s: %.2fs over budget, tightening the lead to fit %.2fs"
                  % (args.lang, start + speech + SHORT_TAIL_S - SHORT_MAX_TOTAL, room), flush=True)
            lead_block = voice.line(args.lang, lines[0], speed * (lead_s / room))
        return build_short(args, lead_block, name_block)

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

    # Lead-in: the whale crosses the frame, then the mark surfaces as its hall
    # tail settles -- the same call the short cut opens on.
    mark_at = MARK_AT
    mark_dur = round(LEAD_IN - mark_at, 3)
    push(whale_lead(TARGET_RATE), "lead")
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
        # The long sequence plays the same three beats as the short cut, timed
        # to its own lead-in: the whale call starts at 0.74 s, the same moment
        # the stream breaks, and the rings close before step one.
        # burstPower keeps the unlock soft: this master has no impact to hit.
        "phases": {
            "sweep": [0.0, 0.78],
            "burst": 0.78,
            "whale": [0.80, 2.35],
            "rings": 1.95,
            "burstPower": 0.35,
        },
        "whale": {"at": WHALE_LEAD_AT, "length": SHORT_WHALE_LEN, "markAt": MARK_AT,
                  "kind": "recorded-call", "src": "whale-call-src.wav"},
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
