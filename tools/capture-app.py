"""Record the live DSH window once per language.

The plugin bundle is rebuilt with `--force <lang>` before each take (the shipped
build keeps honouring the operator's own choice), the window is restored and
raised, ffmpeg grabs that rectangle for 24 s, and a Ctrl+R lands ~1.4 s in so the
sequence plays from the top inside the capture.

Usage:
    .venv-tts\\Scripts\\python.exe tools\\capture-app.py            # zh,en,ru,ja
    .venv-tts\\Scripts\\python.exe tools\\capture-app.py zh ja      # a subset

Output: demo\\raw-<lang>.mp4 (silent, 30 fps, window rectangle only).
"""

import ctypes
import ctypes.wintypes as wintypes
import os
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FFMPEG = os.path.join(ROOT, '.tmp', 'ffmpeg', 'ffmpeg-9.0.2-essentials_build', 'bin', 'ffmpeg.exe')
DEMO = os.path.join(ROOT, 'demo')
LANGS = ['zh', 'en', 'ru', 'ja']
LEAD = 1.4
SECONDS = float(os.environ.get('CAPTURE_SECONDS', '24.0'))

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32

try:
    ctypes.windll.shcore.SetProcessDpiAwareness(2)
except Exception:
    try:
        user32.SetProcessDPIAware()
    except Exception:
        pass

EnumWindowsProc = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)


def find_window(fragment='DeepSeek Harness'):
    found = []

    def callback(hwnd, _param):
        length = user32.GetWindowTextLengthW(hwnd)
        if length <= 0:
            return True
        buffer = ctypes.create_unicode_buffer(length + 2)
        user32.GetWindowTextW(hwnd, buffer, length + 2)
        title = buffer.value
        if fragment.lower() in title.lower() and user32.IsWindowVisible(hwnd):
            found.append((hwnd, title))
        return True

    user32.EnumWindows(EnumWindowsProc(callback), 0)
    return found[0] if found else (None, '')


def window_rect(hwnd):
    rect = wintypes.RECT()
    user32.GetWindowRect(hwnd, ctypes.byref(rect))
    return rect.left, rect.top, rect.right, rect.bottom


def bring_to_front(hwnd):
    """Raise the window for real; SetForegroundWindow alone is refused by Windows."""
    VK_MENU, KEYEVENTF_KEYUP = 0x12, 0x0002
    if user32.IsIconic(hwnd):
        user32.ShowWindow(hwnd, 9)  # SW_RESTORE
        time.sleep(0.8)
    for attempt in range(6):
        user32.SwitchToThisWindow(hwnd, True)
        # A synthetic Alt tap makes this process the last input owner, which is
        # what the foreground lock actually checks.
        user32.keybd_event(VK_MENU, 0, 0, 0)
        user32.SetForegroundWindow(hwnd)
        user32.keybd_event(VK_MENU, 0, KEYEVENTF_KEYUP, 0)
        time.sleep(0.35)
        if user32.GetForegroundWindow() == hwnd:
            return True
        user32.ShowWindow(hwnd, 5)  # SW_SHOW
        time.sleep(0.2)
    return False


def press_ctrl_r():
    VK_CONTROL, VK_R, KEYEVENTF_KEYUP = 0x11, 0x52, 0x0002
    user32.keybd_event(VK_CONTROL, 0, 0, 0)
    user32.keybd_event(VK_R, 0, 0, 0)
    time.sleep(0.05)
    user32.keybd_event(VK_R, 0, KEYEVENTF_KEYUP, 0)
    user32.keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0)


def build(force_lang):
    result = subprocess.run(
        ['node', 'tools/build-client.mjs', '--force', force_lang],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding='utf-8',
        errors='replace',
    )
    if result.returncode != 0:
        raise SystemExit('build failed for %s:\n%s' % (force_lang, result.stdout))
    first = result.stdout.strip().splitlines()[0]
    print('  build: ' + first, flush=True)


def capture(force_lang):
    hwnd, title = find_window()
    if not hwnd:
        raise SystemExit('the DSH window is not reachable; restore it first')
    if not bring_to_front(hwnd):
        raise SystemExit('could not raise the DSH window to the foreground; bring it up and retry')
    print('  foreground ok', flush=True)

    screen_w = user32.GetSystemMetrics(0)
    screen_h = user32.GetSystemMetrics(1)
    left, top, right, bottom = window_rect(hwnd)
    left, top = max(0, left), max(0, top)
    right, bottom = min(screen_w, right), min(screen_h, bottom)
    width, height = right - left, bottom - top
    if width < 320 or height < 240:
        raise SystemExit('window rect looks wrong: %s' % ((left, top, right, bottom),))

    # gdigrab wants even dimensions for yuv420p.
    width -= width % 2
    height -= height % 2
    print('  window: %dx%d at (%d,%d) "%s"' % (width, height, left, top, title), flush=True)

    out = os.path.join(DEMO, 'raw-%s.mp4' % force_lang)
    command = [
        FFMPEG, '-hide_banner', '-loglevel', 'error', '-y',
        '-f', 'gdigrab', '-framerate', '30', '-draw_mouse', '0',
        '-offset_x', str(left), '-offset_y', str(top),
        '-video_size', '%dx%d' % (width, height),
        '-t', str(SECONDS), '-i', 'desktop',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18',
        '-pix_fmt', 'yuv420p', '-an', out,
    ]
    recorder = subprocess.Popen(command, cwd=ROOT)
    time.sleep(LEAD)

    if user32.GetForegroundWindow() != hwnd:
        user32.SetForegroundWindow(hwnd)
        time.sleep(0.2)
    press_ctrl_r()
    print('  refreshed; capturing %.0fs' % SECONDS, flush=True)

    recorder.wait()
    size = os.path.getsize(out) if os.path.exists(out) else 0
    print('  -> %s (%d bytes)' % (os.path.relpath(out, ROOT), size), flush=True)


def main(argv):
    langs = [part.strip() for part in argv if part.strip()] or LANGS
    os.makedirs(DEMO, exist_ok=True)
    for lang in langs:
        if lang not in LANGS and not lang.endswith('-short'):
            raise SystemExit('unknown language ' + lang)
        print('=== %s ===' % lang, flush=True)
        build(lang)
        capture(lang)
    print('done', flush=True)


if __name__ == '__main__':
    main(sys.argv[1:])
