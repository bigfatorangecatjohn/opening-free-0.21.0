r"""Cut the whale call out of the reference recording.

The source is the P2 (no-BGM) audio of 【4K】你听过鲸歌吗？, downloaded as an
.aac next to this repo. The call sits between 00:01 and 00:03; the slice below
takes 1.50-2.95 s, which is one complete phrase: it starts steady, swells to
its loudest point around 2.45 s, and is already decaying at the cut.

The output is a clean, band-limited mono 24 kHz master that
tools/build-boot-track.py loads and gives its cyberpunk treatment. Keeping the
two steps apart means the cut can be re-made without touching the synth chain,
and the repo only carries the 50 KB slice instead of the 10 MB download.

    .venv-tts\Scripts\python.exe tools\make-whale-call.py
"""

import importlib.util
import os
import subprocess
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SOURCE = os.path.join(ROOT, "【4K】你听过鲸歌吗？ P2 无bgm版本_544631700.aac")
OUT = os.path.join(ROOT, "samples", "boot", "whale-call-src.wav")
FFMPEG = os.path.join(
    ROOT, ".tmp", "ffmpeg", "ffmpeg-9.0.2-essentials_build", "bin", "ffmpeg.exe")

START = 1.50
LENGTH = 1.45
RATE = 24000


def load_samples_module():
    path = os.path.join(HERE, "make-samples.py")
    spec = importlib.util.spec_from_file_location("make_samples", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def decode(path, start, length, rate):
    """Decode straight to float32 mono PCM on stdout."""
    if not os.path.exists(FFMPEG):
        raise SystemExit("ffmpeg missing: %s" % FFMPEG)
    cmd = [
        FFMPEG, "-hide_banner", "-v", "error", "-ss", "%.3f" % start,
        "-t", "%.3f" % length, "-i", path, "-ac", "1", "-ar", str(rate),
        "-f", "f32le", "-"]
    raw = subprocess.run(cmd, stdout=subprocess.PIPE, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def main():
    if not os.path.exists(SOURCE):
        raise SystemExit("reference aac not found: %s" % SOURCE)
    samples = load_samples_module()
    audio = decode(SOURCE, START, LENGTH, RATE)
    audio = audio - float(audio.mean())
    # 110-3000 Hz keeps the moan and its low harmonics, drops the rumble of the
    # water and the hiss of the encode.
    audio = samples.band_limit(audio, RATE, 110.0, 3000.0)
    peak = float(np.abs(audio).max()) or 1.0
    audio = audio * (0.9 / peak)
    fade_in = int(0.02 * RATE)
    fade_out = int(0.15 * RATE)
    audio[:fade_in] *= np.linspace(0.0, 1.0, fade_in, dtype=np.float32)
    audio[-fade_out:] *= np.linspace(1.0, 0.0, fade_out, dtype=np.float32) ** 1.2
    samples.write_wav(OUT, audio.astype(np.float32), RATE)
    print("source : %s" % os.path.basename(SOURCE))
    print("slice  : %.2f s + %.2f s" % (START, LENGTH))
    print("out    : %s (%.1f KiB, %.3f s)"
          % (os.path.relpath(OUT, ROOT), os.path.getsize(OUT) / 1024.0,
             audio.size / float(RATE)))
    print("level  : peak %.3f rms %.4f" % (float(np.abs(audio).max()),
                                          float(np.sqrt(np.mean(audio * audio)))))
    return 0


if __name__ == "__main__":
    sys.exit(main())
