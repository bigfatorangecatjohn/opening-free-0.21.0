# -*- coding: utf-8 -*-
"""Fetch the two TTS checkpoints into the workspace and stop there.

The sandbox cannot create or delete directories outside the workspace, so the
usual HuggingFace / torch.hub caches are unusable here. This script downloads
the exact files those libraries would fetch, into .models\\, using plain urllib
(which respects HTTPS_PROXY). make-samples.py then loads them from disk.

    .venv-tts\\Scripts\\python.exe tools\\fetch-models.py
    .venv-tts\\Scripts\\python.exe tools\\fetch-models.py --only kokoro
"""

import argparse
import hashlib
import os
import sys
import urllib.request

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_DIR = os.path.join(HERE, ".models")
KOKORO_DIR = os.path.join(MODEL_DIR, "kokoro")
SILERO_DIR = os.path.join(MODEL_DIR, "silero")

# hf-mirror.com serves the same resolve/ path layout as huggingface.co.
KOKORO_HOSTS = [
    "https://hf-mirror.com",
    "https://huggingface.co",
]
KORORO_REPO = "/hexgrad/Kokoro-82M/resolve/main"
KOKORO_FILES = [
    "config.json",
    "kokoro-v1_0.pth",
    "voices/af_heart.pt",
    "voices/zf_xiaoyi.pt",
]

SILERO_URLS = [
    "https://models.silero.ai/models/tts/ru/v5_5_ru.pt",
    "https://models.silero.ai/models/tts/ru/v5_4_ru.pt",
]


def log(message):
    print(message, flush=True)


def download(url, destination, retries=3, min_bytes=1024):
    """Stream one URL to disk. Skips when a plausible copy already exists."""
    if os.path.isfile(destination) and os.path.getsize(destination) >= min_bytes:
        log("  have  %s (%s)" % (os.path.basename(destination), human(os.path.getsize(destination))))
        return True
    os.makedirs(os.path.dirname(destination), exist_ok=True)
    for attempt in range(1, retries + 1):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "dsh-opening/1.0"})
            with urllib.request.urlopen(request, timeout=90) as response:
                total = int(response.headers.get("Content-Length") or 0)
                written = 0
                chunk = 1024 * 256
                with open(destination, "wb") as handle:
                    while True:
                        block = response.read(chunk)
                        if not block:
                            break
                        handle.write(block)
                        written += len(block)
                        if total and written % (8 * 1024 * 1024) < chunk:
                            log("        %5.1f%% of %s" % (100.0 * written / total, human(total)))
            size = os.path.getsize(destination)
            # A dropped connection reads as a clean EOF; only the byte count
            # tells a finished file from a truncated one.
            if total and written < total:
                raise IOError("truncated: %d of %d bytes" % (written, total))
            if size < min_bytes:
                raise IOError("suspiciously small: %d bytes" % size)
            log("  ok    %s (%s)" % (os.path.basename(destination), human(size)))
            return True
        except Exception as error:  # noqa: BLE001 - report and retry
            log("  retry %d/%d %s: %s: %s" % (attempt, retries, url, type(error).__name__, error))
    return False


def human(size):
    for unit in ("B", "KiB", "MiB", "GiB"):
        if size < 1024 or unit == "GiB":
            return "%.1f %s" % (size, unit)
        size /= 1024.0
    return "%.1f GiB" % size


def sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def fetch_kokoro():
    log("kokoro (%s)" % KOKORO_DIR)
    for name in KOKORO_FILES:
        target = os.path.join(KOKORO_DIR, name.replace("/", os.sep))
        ok = False
        for host in KOKORO_HOSTS:
            url = host + KORORO_REPO + "/" + name
            if download(url, target):
                ok = True
                break
        if not ok:
            return False
    return True


def fetch_silero():
    log("silero (%s)" % SILERO_DIR)
    for url in SILERO_URLS:
        name = url.rsplit("/", 1)[-1]
        target = os.path.join(SILERO_DIR, name)
        if download(url, target, min_bytes=32 * 1024 * 1024):
            return True
    return False


def main(argv):
    parser = argparse.ArgumentParser(description="Fetch TTS checkpoints into .models/")
    parser.add_argument("--only", default="both", choices=["both", "kokoro", "silero"])
    args = parser.parse_args(argv)

    results = {}
    if args.only in ("both", "kokoro"):
        results["kokoro"] = fetch_kokoro()
    if args.only in ("both", "silero"):
        results["silero"] = fetch_silero()

    log("")
    for root, _dirs, files in os.walk(MODEL_DIR):
        for name in sorted(files):
            path = os.path.join(root, name)
            log("%-12s %-46s %s" % (sha256(path)[:12], os.path.relpath(path, MODEL_DIR), human(os.path.getsize(path))))

    failed = [name for name, ok in results.items() if not ok]
    if failed:
        log("\nFAILED: " + ", ".join(failed))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
