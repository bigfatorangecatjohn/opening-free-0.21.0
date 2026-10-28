# -*- coding: utf-8 -*-
"""Render the boot-sequence voice lines to playable WAV files.

Two engines, picked per language because no single open model wins all three:

    zh, en -> Kokoro-82M (Apache-2.0).  zh voice zf_xiaoyi, en voice af_heart.
    ru     -> Silero v5_5_ru (CC BY-NC-SA).  voices baya / kseniya / xenia.

Checkpoints are not fetched from HuggingFace here: tools\\fetch-models.py puts
them in .models\\, and this script redirects the libraries' download helper to
that directory. That keeps the libraries' caches (which need delete rights
the sandbox withholds) out of the picture entirely.

Usage (interpreter = the venv built for this workspace):

    .venv-tts\\Scripts\\python.exe tools\\make-samples.py
    .venv-tts\\Scripts\\python.exe tools\\make-samples.py --ru-voice kseniya

Output lands in samples\\:

    samples\\wav\\<lang>-<n>-<slug>.wav   one file per line
    samples\\<lang>-full.wav              the six lines back to back, 0.45 s apart
"""

import argparse
import os
import sys
import wave

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(HERE, "samples")
WAV_DIR = os.path.join(OUT_DIR, "wav")
MODEL_DIR = os.path.join(HERE, ".models")
KOKORO_DIR = os.path.join(MODEL_DIR, "kokoro")
SILERO_DIR = os.path.join(MODEL_DIR, "silero")
SILERO_FILE = "v5_5_ru.pt"
GAP_SECONDS = 0.45

# Delivery speed per language. The operator asked for the Chinese voice at
# 1.15x; the other two stay natural until he says otherwise.
SPEED = {"zh": 1.15, "en": 1.0, "ru": 1.0}

# The lines are the contract with client.js SEQ: five access steps, then the
# closing salute in that language's own voice.
LINES = {
    "zh": {
        "voice": "zf_xiaoyi",
        "kokoro_lang": "z",
        "text": [
            "需要访问许可",
            "身份资料确认",
            "接受访问需求",
            "开始读取权限",
            "读取完毕，核验通过",
            "欢迎回来，指挥员",
        ],
        "slug": [
            "access",
            "identity",
            "accepted",
            "reading",
            "verified",
            "welcome",
        ],
    },
    "en": {
        "voice": "af_heart",
        "kokoro_lang": "a",
        "text": [
            "Access permission required.",
            "Identity verification.",
            "Access request accepted.",
            "Permission read started.",
            "Read complete. Verified.",
            "Welcome back, commander.",
        ],
        "slug": [
            "access",
            "identity",
            "accepted",
            "reading",
            "verified",
            "welcome",
        ],
    },
    "ru": {
        "voice": "baya",
        "text": [
            "Требуется разрешение на доступ.",
            "Проверка личности.",
            "Запрос на доступ принят.",
            "Начинаю чтение прав.",
            "Чтение завершено. Проверено.",
            "Добро пожаловать, товарищ.",
        ],
        "slug": [
            "access",
            "identity",
            "accepted",
            "reading",
            "verified",
            "welcome",
        ],
    },
}


def ensure_dirs():
    for path in (OUT_DIR, WAV_DIR):
        if not os.path.isdir(path):
            os.makedirs(path)


def write_wav(path, samples, sample_rate):
    """Write float samples as 16-bit mono PCM, normalised to ~-1 dBFS."""
    import numpy as np

    data = np.asarray(samples, dtype=np.float32).reshape(-1)
    peak = float(np.max(np.abs(data))) if data.size else 0.0
    if peak > 0:
        data = data / peak * 0.89
    pcm = np.clip(data, -1.0, 1.0)
    pcm = (pcm * 32767.0).astype(np.int16)
    with wave.open(path, "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(int(sample_rate))
        handle.writeframes(pcm.tobytes())


def concat(parts, sample_rate):
    """Join segments with a short silence between them."""
    import numpy as np

    gap = np.zeros(int(round(GAP_SECONDS * sample_rate)), dtype=np.float32)
    pieces = []
    for index, part in enumerate(parts):
        if index:
            pieces.append(gap)
        pieces.append(np.asarray(part, dtype=np.float32).reshape(-1))
    return np.concatenate(pieces) if pieces else np.zeros(0, dtype=np.float32)


# Mechanical colour, 0..1. 0.5 is the level the operator settled on: the source
# voice stays intelligible, but the timbre picks up the terminal's ring, grit
# and band limit. Everything here is numpy, because the venv has no scipy.
MECH_LEVEL = 0.5


def trim(pcm, sample_rate, threshold=0.005, keep=0.02):
    """Drop leading/trailing silence so steps butt together predictably."""
    import numpy as np

    data = np.asarray(pcm, dtype=np.float32).reshape(-1)
    if data.size == 0:
        return data
    loud = np.nonzero(np.abs(data) > threshold)[0]
    if loud.size == 0:
        return data
    pad = int(round(keep * sample_rate))
    start = max(0, int(loud[0]) - pad)
    end = min(data.size, int(loud[-1]) + pad)
    return data[start:end]


def band_limit(pcm, sample_rate, low=150.0, high=6400.0):
    """Zero-phase high/low shelf pair done in the frequency domain."""
    import numpy as np

    data = np.asarray(pcm, dtype=np.float32).reshape(-1)
    size = data.size
    if size < 64:
        return data
    pad = 1024
    padded = np.concatenate([np.zeros(pad, dtype=np.float32), data, np.zeros(pad, dtype=np.float32)])
    spectrum = np.fft.rfft(padded)
    freqs = np.fft.rfftfreq(padded.size, 1.0 / float(sample_rate))
    gain = np.clip((freqs - low * 0.55) / (low * 0.55), 0.0, 1.0)
    gain = gain * np.clip((high * 1.45 - freqs) / (high * 0.45), 0.0, 1.0)
    filtered = np.fft.irfft(spectrum * gain, n=padded.size)
    return filtered[pad:pad + size].astype(np.float32)


def sample_hold(pcm, factor):
    """Hold every `factor` samples: the cheap, honest kind of grit."""
    import numpy as np

    data = np.asarray(pcm, dtype=np.float32).reshape(-1)
    if factor <= 1 or data.size == 0:
        return data
    index = (np.arange(data.size) // factor) * factor
    return data[np.clip(index, 0, data.size - 1)]


def quantize(pcm, bits):
    import numpy as np

    levels = float(1 << (bits - 1))
    return (np.round(np.asarray(pcm, dtype=np.float32) * levels) / levels).astype(np.float32)


def mech(pcm, sample_rate, level=MECH_LEVEL):
    """Bake the synthetic-terminal timbre in. level 0 leaves the voice alone."""
    import numpy as np

    data = trim(pcm, sample_rate)
    if level <= 0 or data.size == 0:
        return data
    strength = float(max(0.0, min(1.0, level)))

    out = band_limit(data, sample_rate)
    time = np.arange(out.size, dtype=np.float32) / float(sample_rate)
    depth = 0.30 * strength
    out = out * (1.0 - depth + depth * np.cos(2.0 * np.pi * 97.0 * time))
    out = sample_hold(out, int(round(1.0 + 2.0 * strength)))
    out = quantize(out, int(round(16.0 - 6.0 * strength)))

    edge = min(out.size, int(round(0.006 * sample_rate)))
    if edge > 1:
        ramp = np.linspace(0.0, 1.0, edge, dtype=np.float32)
        out[:edge] *= ramp
        out[-edge:] *= ramp[::-1]
    peak = float(np.max(np.abs(out))) if out.size else 0.0
    if peak > 0:
        out = out / peak * 0.89
    return out.astype(np.float32)


def patch_local_models():
    """Point huggingface_hub's download helper at .models\\kokoro."""
    import huggingface_hub

    def local_hub_download(*args, **kwargs):
        filename = kwargs.get("filename")
        if filename is None and len(args) >= 2:
            filename = args[1]
        if not filename:
            raise ValueError("cannot resolve a model file without a filename")
        path = os.path.join(KOKORO_DIR, str(filename).replace("/", os.sep))
        if not os.path.isfile(path):
            raise FileNotFoundError("missing checkpoint: %s (run tools\\fetch-models.py)" % path)
        return path

    huggingface_hub.hf_hub_download = local_hub_download
    for module_name in ("kokoro.model", "kokoro.pipeline"):
        module = __import__(module_name, fromlist=["hf_hub_download"])
        if hasattr(module, "hf_hub_download"):
            module.hf_hub_download = local_hub_download


def kokoro_lines(lang, texts, speed=1.0):
    """Yield (samples, sample_rate) for each text using Kokoro."""
    import numpy as np

    patch_local_models()
    from kokoro import KPipeline

    spec = LINES[lang]
    pipeline = KPipeline(lang_code=spec["kokoro_lang"], repo_id="hexgrad/Kokoro-82M")
    for text in texts:
        chunks = []
        sample_rate = 24000
        for _gs, _ps, audio in pipeline(text, voice=spec["voice"], speed=speed):
            array = audio.detach().cpu().numpy() if hasattr(audio, "detach") else np.asarray(audio)
            chunks.append(np.asarray(array, dtype=np.float32).reshape(-1))
        yield (np.concatenate(chunks) if chunks else np.zeros(0, dtype=np.float32), sample_rate)


def silero_model():
    """Load the packaged Silero model without torch.hub's downloader."""
    import torch

    path = os.path.join(SILERO_DIR, SILERO_FILE)
    if not os.path.isfile(path):
        raise FileNotFoundError("missing checkpoint: %s (run tools\\fetch-models.py)" % path)
    importer = torch.package.PackageImporter(path)
    model = importer.load_pickle("tts_models", "model")
    model.to(torch.device("cpu"))
    return model


def silero_lines(lang, texts, voice, model):
    """Yield (samples, sample_rate) for each text using Silero."""
    import numpy as np

    for text in texts:
        audio = model.apply_tts(text=text, speaker=voice, sample_rate=48000)
        array = audio.detach().cpu().numpy() if hasattr(audio, "detach") else np.asarray(audio)
        yield (np.asarray(array, dtype=np.float32).reshape(-1), 48000)


def main(argv):
    parser = argparse.ArgumentParser(description="Render boot-sequence voice samples.")
    parser.add_argument("--langs", default="zh,en,ru", help="comma separated: zh,en,ru")
    parser.add_argument("--ru-voice", default="baya", help="baya | kseniya | xenia | aidar | eugene")
    parser.add_argument("--mech", type=float, default=MECH_LEVEL, help="mechanical amount, 0..1")
    parser.add_argument("--speed-zh", type=float, default=SPEED["zh"])
    parser.add_argument("--speed-en", type=float, default=SPEED["en"])
    parser.add_argument("--speed-ru", type=float, default=SPEED["ru"])
    args = parser.parse_args(argv)

    SPEED["zh"] = args.speed_zh
    SPEED["en"] = args.speed_en
    SPEED["ru"] = args.speed_ru

    langs = [part.strip() for part in args.langs.split(",") if part.strip()]
    ensure_dirs()

    failures = []
    for lang in langs:
        if lang not in LINES:
            failures.append("%s: unknown language" % lang)
            continue
        spec = LINES[lang]
        print("\n=== %s (%s) ===" % (lang, args.ru_voice if lang == "ru" else spec["voice"]), flush=True)
        try:
            if lang == "ru":
                rendered = list(silero_lines(lang, spec["text"], args.ru_voice, silero_model()))
            else:
                rendered = list(kokoro_lines(lang, spec["text"], SPEED[lang]))
        except Exception as error:  # noqa: BLE001 - report and continue
            failures.append("%s: %s: %s" % (lang, type(error).__name__, error))
            continue

        pieces = []
        sample_rate = 24000
        for index, (samples, rate) in enumerate(rendered):
            sample_rate = rate
            samples = mech(samples, rate, args.mech)
            slug = spec["slug"][index]
            path = os.path.join(WAV_DIR, "%s-%d-%s.wav" % (lang, index + 1, slug))
            write_wav(path, samples, rate)
            seconds = len(samples) / float(rate) if rate else 0.0
            print("  %-34s %5.2f s" % (os.path.basename(path), seconds), flush=True)
            pieces.append(samples)
        full = concat(pieces, sample_rate)
        full_path = os.path.join(OUT_DIR, "%s-full.wav" % lang)
        write_wav(full_path, full, sample_rate)
        print("  -> %s  (%.2f s)" % (full_path, len(full) / float(sample_rate)), flush=True)

    if failures:
        print("\nFAILED:")
        for line in failures:
            print("  " + line)
        return 1
    print("\nall good")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
