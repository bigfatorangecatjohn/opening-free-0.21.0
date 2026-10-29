"""Splice the cyber short-cut renderer into tools/build-boot-track.py.

The short cut stops being "chimes plus a welcome" and becomes a three-beat cue:
a data stream sweeps past, bursts, a whale sings while its shape assembles, and
the salute lands with the addressee held a beat longer than the rest.
"""

import io
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET = os.path.join(ROOT, 'tools', 'build-boot-track.py')

HELPERS = '''
SHORT_FLOOR = 3.00
SHORT_CEILING = 3.50
SHORT_TAIL_S = 0.28
SHORT_NAME_GAP = 0.16
SHORT_NAME_SPEED = 0.92


def stream_sweep(rate, length):
    """A blue data stream: noise whipped past the ear over a falling zap."""
    rng = np.random.default_rng(11)
    count = int(round(rate * length))
    t = np.arange(count, dtype=np.float64) / float(rate)
    noise = rng.standard_normal(count).astype(np.float32)
    bright = make_samples.band_limit(noise, rate, 1700.0, 7600.0)
    dark = make_samples.band_limit(noise, rate, 320.0, 2200.0)
    rise = np.clip(t / (length * 0.52), 0.0, 1.0) ** 2
    fall = np.clip(1.0 - (t - length * 0.58) / (length * 0.42), 0.0, 1.0)
    body = (bright * rise + dark * (1.0 - rise)) * rise * fall
    glide = 1500.0 * np.exp(-t / (length * 0.20)) + 170.0
    phase = 2.0 * np.pi * np.cumsum(glide) / rate
    zap = np.sin(phase) * np.exp(-t / (length * 0.42)) * 0.17
    return ((body * 0.44) + zap).astype(np.float32)


def burst_impact(rate):
    """The instant the stream breaks apart."""
    rng = np.random.default_rng(23)
    count = int(round(rate * 0.62))
    t = np.arange(count, dtype=np.float64) / float(rate)
    noise = make_samples.band_limit(
        rng.standard_normal(count).astype(np.float32), rate, 240.0, 8200.0)
    crack = noise * np.exp(-t / 0.055) * 0.60
    sub = np.sin(2.0 * np.pi * 56.0 * t) * np.exp(-t / 0.17) * 0.52
    return (crack + sub).astype(np.float32)


def whale_call(rate, length=0.95, f0=232.0, f1=148.0, gain=0.30):
    """A whale moan: a slow glide, two detuned partials, a wide vibrato."""
    count = int(round(rate * length))
    t = np.arange(count, dtype=np.float64) / float(rate)
    u = t / max(1e-6, length)
    glide = f0 + (f1 - f0) * (u ** 0.72)
    vibrato = 1.0 + 0.018 * np.sin(2.0 * np.pi * 5.2 * t)
    phase = 2.0 * np.pi * np.cumsum(glide * vibrato) / rate
    env = np.clip(t / 0.13, 0.0, 1.0) * np.clip((length - t) / 0.44, 0.0, 1.0) ** 1.35
    core = (np.sin(phase) + 0.34 * np.sin(2.0 * phase + 0.6)
            + 0.12 * np.sin(3.0 * phase))
    warm = make_samples.band_limit(core.astype(np.float32), rate, 90.0, 1300.0)
    return ((core * 0.52 + warm * 0.86) * env * gain).astype(np.float32)


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


def name_boom(rate, length=0.72, gain=0.42):
    """The addressee lands: a sub drop plus a filtered crack."""
    count = int(round(rate * length))
    t = np.arange(count, dtype=np.float64) / float(rate)
    drop = np.sin(2.0 * np.pi * np.cumsum(72.0 * np.exp(-t / 0.22) + 40.0) / rate)
    drop = drop * np.exp(-t / 0.26)
    return (drop * gain).astype(np.float32)


def soft_reverb(samples, rate, length=0.42, decay=7.5, wet=0.18):
    """A cheap tail: convolve with a decaying noise impulse."""
    rng = np.random.default_rng(59)
    count = int(round(rate * length))
    impulse = rng.standard_normal(count).astype(np.float32) * np.exp(-decay * np.arange(count) / rate)
    impulse = impulse / max(1e-6, float(np.abs(impulse).sum()))
    tail = np.convolve(samples.astype(np.float32), impulse).astype(np.float32)
    return (samples + wet * tail[: samples.size]).astype(np.float32)


'''

BUILDER = '''def build_short(args, salute_lead, salute_name):
    """Three beats in ~3.4 s: stream, burst + whale, rings and the salute."""
    rate = TARGET_RATE
    lead_s = seconds(salute_lead)
    name_s = seconds(salute_name)
    speech = lead_s + SHORT_NAME_GAP + name_s
    start = min(1.40, SHORT_CEILING - SHORT_TAIL_S - speech)
    start = max(1.05, start)
    total = round(start + speech + SHORT_TAIL_S, 3)
    track = np.zeros(int(round(rate * total)) + 1, dtype=np.float32)

    def put(block, at, gain=1.0):
        offset = int(round(rate * at))
        stop = min(track.size, offset + block.size)
        if stop > offset:
            track[offset:stop] += (block[: stop - offset] * gain).astype(np.float32)

    burst_at = 0.55
    whale_at = 0.60
    rings_at = 1.02
    put(stream_sweep(rate, burst_at + 0.10), 0.00)
    put(burst_impact(rate), burst_at, 0.92)
    put(whale_call(rate, 0.95), whale_at, 1.00)
    put(hologram_shimmer(rate), rings_at, 0.90)
    put(breath_hum(rate, total, gain=0.11), rings_at + 0.10, 0.90)

    salute_at = round(start, 3)
    name_at = round(start + lead_s + SHORT_NAME_GAP, 3)
    put(salute_lead, salute_at)
    put(name_boom(rate), max(0.0, name_at - 0.04), 1.0)
    put(soft_reverb(salute_name, rate), name_at)

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
        "leadIn": SHORT_CEILING,
        "tail": SHORT_TAIL_S,
        "gaps": [],
        "mark": {"at": 0.0, "dur": 0.0},
        "phases": {
            "sweep": [0.0, burst_at],
            "burst": burst_at,
            "whale": [whale_at, round(whale_at + 0.95, 3)],
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
        handle.write("\\n")

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

'''


def main():
    source = io.open(TARGET, encoding='utf-8').read()

    anchor = "# What the screen shows."
    assert source.count(anchor) == 1
    source = source.replace(anchor, HELPERS.strip('\n') + "\n\n\n" + anchor)

    start = source.index("def build_short(")
    end = source.index("\n\ndef main(argv):")
    source = source[:start] + BUILDER + source[end + 1:]

    old = """    if args.short:
        return build_short(args, salute)"""
    new = """    if args.short:
        shown_lines = split_salute(make_samples.LINES[args.lang]["text"][5], args.lang)
        lead_block = voice.line(args.lang, shown_lines[0], speed)
        name_block = voice.line(args.lang, shown_lines[1], speed * SHORT_NAME_SPEED)
        return build_short(args, lead_block, name_block)"""
    assert source.count(old) == 1
    source = source.replace(old, new)

    io.open(TARGET, 'w', encoding='utf-8', newline='\n').write(source)
    print('patched')


if __name__ == '__main__':
    main()
