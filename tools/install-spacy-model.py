# -*- coding: utf-8 -*-
"""Install the spaCy English model without pip.

misaki's English G2P needs `en_core_web_sm`, and spacy raises E050 (not a
download) when it is missing. pip cannot be used here for two reasons the
sandbox creates: it unpacks with delete-on-close into a directory that denies
deletion, and the GitHub release redirect is flaky through the local proxy.

A model wheel is just a zip of a package directory, so this script downloads
it with urllib (retrying, checking Content-Length) and extracts it straight
into the venv's site-packages.

    .venv-tts\\Scripts\\python.exe tools\\install-spacy-model.py
"""

import os
import sys
import urllib.request
import zipfile

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE_PACKAGES = os.path.join(HERE, ".venv-tts", "Lib", "site-packages")
WHEEL_DIR = os.path.join(HERE, ".models", "wheels")

WHEELS = [
    (
        "en_core_web_sm-3.8.0-py3-none-any.whl",
        "https://github.com/explosion/spacy-models/releases/download/"
        "en_core_web_sm-3.8.0/en_core_web_sm-3.8.0-py3-none-any.whl",
    ),
]


def log(message):
    print(message, flush=True)


def fetch(name, url, retries=5):
    target = os.path.join(WHEEL_DIR, name)
    if os.path.isfile(target) and os.path.getsize(target) > 8 * 1024 * 1024:
        log("have   %s (%.1f MiB)" % (name, os.path.getsize(target) / 1048576.0))
        return target
    os.makedirs(WHEEL_DIR, exist_ok=True)
    for attempt in range(1, retries + 1):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "dsh-opening/1.0"})
            with urllib.request.urlopen(request, timeout=120) as response:
                total = int(response.headers.get("Content-Length") or 0)
                written = 0
                with open(target, "wb") as handle:
                    while True:
                        block = response.read(1024 * 256)
                        if not block:
                            break
                        handle.write(block)
                        written += len(block)
            size = os.path.getsize(target)
            if total and written < total:
                raise IOError("truncated: %d of %d bytes" % (written, total))
            if not zipfile.is_zipfile(target):
                raise IOError("not a zip file (got %d bytes)" % size)
            log("ok     %s (%.1f MiB)" % (name, size / 1048576.0))
            return target
        except Exception as error:  # noqa: BLE001 - report and retry
            log("retry  %d/%d %s: %s: %s" % (attempt, retries, name, type(error).__name__, error))
    return None


def extract(wheel_path):
    with zipfile.ZipFile(wheel_path) as archive:
        names = archive.namelist()
        package = sorted({name.split("/")[0] for name in names if "/" in name})
        installed = [name for name in package if os.path.isdir(os.path.join(SITE_PACKAGES, name))]
        if installed and any(name.startswith("en_core_web_sm") for name in installed):
            log("present in site-packages: %s" % ", ".join(installed))
            return True
        log("extracting %d entries -> %s" % (len(names), SITE_PACKAGES))
        archive.extractall(SITE_PACKAGES)
    return True


def verify():
    import spacy

    nlp = spacy.load("en_core_web_sm")
    doc = nlp("Access permission required.")
    log("verify spacy.load('en_core_web_sm') -> %d tokens" % len(doc))
    return True


def main():
    if not os.path.isdir(SITE_PACKAGES):
        log("no venv at %s" % SITE_PACKAGES)
        return 1
    for name, url in WHEELS:
        path = fetch(name, url)
        if not path:
            log("FAILED to download %s" % name)
            return 1
        extract(path)
    verify()
    log("done")
    return 0


if __name__ == "__main__":
    sys.exit(main())
