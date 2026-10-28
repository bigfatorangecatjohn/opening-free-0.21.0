"""One-off patch: replace the beeper with a clean chime set, add tri-lingual cue text."""
import io
import re

path = r"tools\build-boot-track.py"
src = io.open(path, encoding="utf-8").read()

start = src.index("def beep(")
end = src.index("class Voice:")
new_block = '''NOTE_HZ = (1046.50, 1318.51, 1567.98)  # C6 - E6 - G6, rising major triad
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


'''
src = src[:start] + new_block + src[end:]

old_lead = """    lead_head = silence(0.06)
    chime = beeps(TARGET_RATE)
    lead_tail = silence(max(0.0, LEAD_IN - seconds(lead_head) - seconds(chime)))
    mark_at = round(seconds(lead_head) + seconds(chime) - 0.28, 3)
    mark_dur = round(LEAD_IN - mark_at, 3)
    push(np.concatenate([lead_head, chime, lead_tail]), "lead")"""
new_lead = """    mark_at = MARK_AT
    mark_dur = round(LEAD_IN - mark_at, 3)
    push(chimes(TARGET_RATE, LEAD_IN), "lead")"""
assert old_lead in src
src = src.replace(old_lead, new_lead)

old_meta = '"beeps": {"count": 3, "gap": 0.20, "freq": 987.77},'
new_meta = '"chimes": {"notes": list(NOTE_HZ), "at": list(NOTE_AT), "markAt": MARK_AT},'
assert old_meta in src
src = src.replace(old_meta, new_meta)

anchor = "    timeline = {"
insert = '''    for cue in cues:
        if cue["name"].startswith("step"):
            index = int(cue["name"][4:]) - 1
            cue["text"] = {
                lang: make_samples.LINES[lang]["text"][index]
                for lang in ("zh", "en", "ru")
            }

'''
assert anchor in src
src = src.replace(anchor, insert + anchor, 1)

src = src.replace('default=0.75', 'default=0.6')

io.open(path, "w", encoding="utf-8", newline="\n").write(src)
print("patched", len(src))
print("beeps left:", src.count("beeps("), "chimes:", src.count("chimes("))
