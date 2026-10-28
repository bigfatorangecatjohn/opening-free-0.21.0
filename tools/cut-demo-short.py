"""Cut the four short-cut takes into one demo reel.

Same alignment trick as the full-length reel: every short track fades its whale
mark in at 1.06 s, so the biggest frame-to-frame change in the first seconds of
a take tells where the sequence started.

Trimmed away: the host menu bar on top, the floating taskbar at the bottom, and
the right-hand band that only holds the desktop pet and its toast.
"""

import json
import os
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FFMPEG_DIR = os.path.join(ROOT, '.tmp', 'ffmpeg', 'ffmpeg-9.0.2-essentials_build', 'bin')
FFMPEG = os.path.join(FFMPEG_DIR, 'ffmpeg.exe')
FFPROBE = os.path.join(FFMPEG_DIR, 'ffprobe.exe')
LANGS = ['zh', 'en', 'ru', 'ja']
MARK_AT = 1.06
CROP_TOP = 46
CROP_BOTTOM = 98
CROP_RIGHT = 340
TAIL = 0.12


def diff_series(path):
    # Relative media paths keep the lavfi `movie=` argument free of spaces.
    relative = os.path.relpath(path, ROOT).replace('\\', '/')
    command = [
        FFPROBE, '-v', 'error',
        '-f', 'lavfi', '-i',
        'movie=%s,tblend=all_mode=difference,signalstats' % relative,
        '-show_entries', 'frame=pts_time:frame_tags=lavfi.signalstats.YAVG',
        '-of', 'csv=p=0',
    ]
    out = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, encoding='utf-8', errors='replace')
    series = []
    for line in out.stdout.splitlines():
        parts = line.split(',')
        if len(parts) < 2:
            continue
        try:
            series.append((float(parts[0]), float(parts[1])))
        except ValueError:
            continue
    return series


def mark_time(path):
    window = [(t, d) for t, d in diff_series(path) if 0.2 <= t <= 3.2]
    if not window:
        raise SystemExit('no frames read from ' + path)
    return max(window, key=lambda item: item[1])


def manifest(lang):
    path = os.path.join(ROOT, 'plugin', 'dsh-opening', 'assets', 'boot-%s-short.sequence.json' % lang)
    with open(path, encoding='utf-8') as handle:
        return json.load(handle)


def main():
    demo = os.path.join(ROOT, 'demo')
    os.makedirs(demo, exist_ok=True)
    segments = []
    for lang in LANGS:
        raw = os.path.join(demo, 'raw-%s-short.mp4' % lang)
        if not os.path.exists(raw):
            raise SystemExit('missing take: ' + raw)
        data = manifest(lang)
        mark_at = float(data.get('mark', {}).get('at', MARK_AT))
        total = float(data['total'])
        t_mark, strength = mark_time(raw)
        start = max(0.0, t_mark - mark_at)
        print('%-8s mark at %.2fs (delta %.2f) -> cut %.2fs, %.2fs long'
              % (lang, t_mark, strength, start, total), flush=True)
        seg = os.path.join(demo, 'seg-%s-short.mp4' % lang)
        audio = os.path.join(ROOT, 'plugin', 'dsh-opening', 'assets', 'boot-%s-short.ogg' % lang)
        command = [
            FFMPEG, '-hide_banner', '-loglevel', 'error', '-y',
            '-ss', '%.3f' % start, '-i', raw,
            '-i', audio,
            '-map', '0:v:0', '-map', '1:a:0',
            '-vf', 'crop=iw-%d:ih-%d-%d:0:%d' % (CROP_RIGHT, CROP_TOP, CROP_BOTTOM, CROP_TOP),
            '-t', '%.3f' % (total + TAIL),
            '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '30',
            '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart',
            seg,
        ]
        subprocess.run(command, cwd=ROOT, check=True)
        segments.append(seg)

    concat = os.path.join(demo, 'concat-short.txt')
    with open(concat, 'w', encoding='utf-8') as handle:
        for seg in segments:
            handle.write("file '%s'\n" % os.path.basename(seg))
    out = os.path.join(demo, 'dsh-opening-demo-short.mp4')
    subprocess.run([FFMPEG, '-hide_banner', '-loglevel', 'error', '-y',
                    '-f', 'concat', '-safe', '0', '-i', concat, '-c', 'copy', out],
                   cwd=demo, check=True)

    probe = subprocess.run([FFPROBE, '-v', 'error', '-show_entries', 'format=duration,size',
                            '-of', 'default=noprint_wrappers=1', out],
                           capture_output=True, text=True, encoding='utf-8', errors='replace')
    info = dict(line.split('=', 1) for line in probe.stdout.splitlines() if '=' in line)
    print('demo: %ss, %.1f MiB, %s'
          % (info.get('duration', '?'), int(info.get('size', '0')) / 1048576.0, out), flush=True)


if __name__ == '__main__':
    main()
