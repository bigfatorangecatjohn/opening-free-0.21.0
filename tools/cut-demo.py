"""Cut the four raw window takes into one demo reel.

Each take starts at an arbitrary moment: the plugin's build triggers a reload and
ffmpeg is already rolling. Every track fades its whale mark in at 1.06 s, so the
largest frame-to-frame change in the first couple of seconds is that mark; that
gives the offset, and the take is cut from (mark - 1.06) for exactly 18 s.

Top 46 px go: that strip belongs to the host's menu bar, not to the sequence.
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
SECONDS = 18.0
CROP_TOP = 46


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
    window = [(t, d) for t, d in diff_series(path) if 0.3 <= t <= 2.4]
    if not window:
        raise SystemExit('no frames read from ' + path)
    best = max(window, key=lambda item: item[1])
    return best[0], best[1]


def main():
    os.makedirs(os.path.join(ROOT, 'demo'), exist_ok=True)
    segments = []
    for lang in LANGS:
        raw = os.path.join(ROOT, 'demo', 'raw-%s.mp4' % lang)
        if not os.path.exists(raw):
            raise SystemExit('missing take: ' + raw)
        t_mark, strength = mark_time(raw)
        start = max(0.0, t_mark - MARK_AT)
        print('%-3s mark at %.2fs (delta %.2f) -> cut from %.2fs' % (lang, t_mark, strength, start), flush=True)
        seg = os.path.join(ROOT, 'demo', 'seg-%s.mp4' % lang)
        audio = os.path.join(ROOT, 'plugin', 'dsh-opening', 'assets', 'boot-%s.ogg' % lang)
        command = [
            FFMPEG, '-hide_banner', '-loglevel', 'error', '-y',
            '-ss', '%.3f' % start, '-i', raw,
            '-i', audio,
            '-map', '0:v:0', '-map', '1:a:0',
            '-vf', 'crop=2240:ih-%d:0:%d' % (CROP_TOP, CROP_TOP),
            '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '30',
            '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
            '-t', '%.3f' % SECONDS, '-movflags', '+faststart',
            seg,
        ]
        subprocess.run(command, check=True)
        segments.append(seg)

    list_file = os.path.join(ROOT, 'demo', 'concat.txt')
    with open(list_file, 'w', encoding='utf-8') as handle:
        for seg in segments:
            handle.write("file '%s'\n" % seg.replace('\\', '/'))

    out = os.path.join(ROOT, 'demo', 'dsh-opening-demo.mp4')
    subprocess.run(
        [FFMPEG, '-hide_banner', '-loglevel', 'error', '-y',
         '-f', 'concat', '-safe', '0', '-i', list_file, '-c', 'copy', '-movflags', '+faststart', out],
        check=True,
    )
    info = json.loads(subprocess.run(
        [FFPROBE, '-v', 'error', '-show_format', '-show_streams', '-of', 'json', out],
        capture_output=True, text=True, encoding='utf-8', errors='replace').stdout)
    duration = float(info['format']['duration'])
    size = int(info['format']['size'])
    print('demo: %.2fs, %.1f MiB, %s' % (duration, size / 1048576.0, out), flush=True)


if __name__ == '__main__':
    main()
