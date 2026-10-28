"""Re-encode the four boot tracks as Ogg Vorbis so the bundle stays small.

The client inlines its audio as a data URI, so the WAV masters cost ~3.4 MB of
base64. Vorbis at q0.5 lands near 85 KB per track with no audible loss on
speech, which keeps the whole bundle under a megabyte.
"""
import os

import soundfile as sf

ASSETS = os.path.join('plugin', 'dsh-opening', 'assets')
LANGS = ('zh', 'en', 'ru', 'ja')
QUALITY = 0.5


def main():
    for lang in LANGS:
        wav = os.path.join(ASSETS, 'boot-%s.wav' % lang)
        ogg = os.path.join(ASSETS, 'boot-%s.ogg' % lang)
        if not os.path.isfile(wav):
            print('%-3s missing %s' % (lang, wav))
            continue
        samples, rate = sf.read(wav, dtype='float32')
        sf.write(ogg, samples, rate, format='OGG', subtype='VORBIS', compression_level=QUALITY)
        back, back_rate = sf.read(ogg, dtype='float32')
        print(
            '%-3s %6.1f KiB -> %6.1f KiB  %.2fs @ %d Hz (round-trip %.2fs)'
            % (
                lang,
                os.path.getsize(wav) / 1024.0,
                os.path.getsize(ogg) / 1024.0,
                len(samples) / float(rate),
                back_rate,
                len(back) / float(back_rate),
            )
        )


if __name__ == '__main__':
    main()
