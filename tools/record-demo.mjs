// Record the four language passes from the running DSH web UI.
//
// Zero dependencies: Node 24 ships fetch and WebSocket, and the DevTools
// protocol is just JSON over a websocket. One segment per language, each
// trimmed to the 18 s the sequence actually runs.
//
//     node tools/record-demo.mjs
//
// Output: .tmp/rec/<lang>/  (frames), .tmp/rec/seg-<lang>.mp4, demo/… .mp4
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const CDP = process.env.CDP_URL || 'http://127.0.0.1:9333';
const APP = process.env.APP_URL || 'http://127.0.0.1:55170/';
const LANGS = ['zh', 'en', 'ru', 'ja'];
const SEGMENT_SECONDS = 18.0;
const LEAD = 0.4;
const ROOT = resolve('.tmp', 'rec');
const DEMO = resolve('demo');
const FFMPEG = process.env.FFMPEG || resolve('.tmp', 'ffmpeg', 'ffmpeg-9.0.2-essentials_build', 'bin', 'ffmpeg.exe');

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function targetSocket() {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const list = await (await fetch(CDP + '/json/list')).json();
      const page = list.find((item) => item.type === 'page');
      if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch (error) {
      /* chrome still starting */
    }
    await sleep(500);
  }
  throw new Error('no page target on ' + CDP);
}

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.next = 1;
    this.pending = new Map();
    this.handlers = new Map();
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { done, fail } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) fail(new Error(message.error.message));
        else done(message.result);
        return;
      }
      const list = this.handlers.get(message.method);
      if (list) for (const handler of list) handler(message.params);
    });
  }

  send(method, params) {
    const id = this.next++;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((done, fail) => {
      this.pending.set(id, { done, fail });
      setTimeout(() => {
        if (this.pending.delete(id)) fail(new Error(method + ' timed out'));
      }, 30000);
    });
  }

  on(method, handler) {
    if (!this.handlers.has(method)) this.handlers.set(method, []);
    this.handlers.get(method).push(handler);
  }
}

const WATCH = `(() => {
  const tick = () => {
    if (document.querySelector('.dshop-root')) {
      try { window.__dsmark(String(Date.now())); } catch (error) {}
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})()`;

async function recordSegment(cdp, lang) {
  const dir = join(ROOT, lang);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  let frames = [];
  let markerIndex = -1;
  let markerWall = 0;
  let counter = 0;

  cdp.on('Page.screencastFrame', (params) => {
    counter += 1;
    const name = String(counter).padStart(5, '0') + '.jpg';
    writeFileSync(join(dir, name), Buffer.from(params.data, 'base64'));
    frames.push(name);
    cdp.send('Page.screencastFrameAck', { sessionId: params.sessionId }).catch(() => {});
  });
  cdp.on('Runtime.bindingCalled', (params) => {
    if (params.name !== '__dsmark' || markerIndex >= 0) return;
    markerIndex = frames.length;
    markerWall = Number(params.payload) || Date.now();
  });

  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: "try { localStorage.setItem('dsh-opening:lang', '" + lang + "'); } catch (error) {}",
  });

  const started = Date.now();
  await cdp.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 82,
    maxWidth: 1600,
    maxHeight: 900,
    everyNthFrame: 2,
  });
  await cdp.send('Page.navigate', { url: APP });
  await cdp.send('Runtime.evaluate', { expression: WATCH, awaitPromise: false });

  const deadline = Date.now() + 25000;
  while (markerIndex < 0 && Date.now() < deadline) await sleep(120);
  if (markerIndex < 0) throw new Error(lang + ': the overlay never appeared');

  const until = markerWall + (SEGMENT_SECONDS + LEAD) * 1000;
  while (Date.now() < until) await sleep(120);
  const elapsed = (Date.now() - started) / 1000;

  await cdp.send('Page.stopScreencast');
  const fps = Math.max(10, Math.min(60, frames.length / elapsed));
  console.log(
    '  ' + lang + ': ' + frames.length + ' frames in ' + elapsed.toFixed(1) + ' s (' +
      fps.toFixed(1) + ' fps), overlay at frame ' + (markerIndex + 1),
  );
  return { lang, dir, markerIndex, fps };
}

function encodeSegment(segment) {
  const out = join(ROOT, 'seg-' + segment.lang + '.mp4');
  const audio = join('plugin', 'dsh-opening', 'assets', 'boot-' + segment.lang + '.wav');
  const list = join(segment.dir, 'frames.txt');
  const files = readdirSync(segment.dir).filter((name) => name.endsWith('.jpg')).sort();
  const kept = files.slice(Math.max(0, segment.markerIndex - 1));
  const duration = (1 / segment.fps).toFixed(4);
  writeFileSync(
    list,
    kept.map((name) => "file '" + name + "'\nduration " + duration).join('\n') +
      "\nfile '" + kept[kept.length - 1] + "'\nduration " + duration + '\n',
    'utf8',
  );

  const args = [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'concat', '-safe', '0', '-i', list,
    '-i', audio,
    '-map', '0:v', '-map', '1:a',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-r', '30', '-c:a', 'aac', '-b:a', '192k',
    '-t', String(SEGMENT_SECONDS), '-movflags', '+faststart',
    out,
  ];
  const result = spawnSync(FFMPEG, args, { stdio: 'inherit', cwd: process.cwd() });
  if (result.status !== 0) throw new Error('ffmpeg failed for ' + segment.lang);
  return out;
}

async function main() {
  mkdirSync(ROOT, { recursive: true });
  mkdirSync(DEMO, { recursive: true });

  const ws = new WebSocket(await targetSocket());
  await new Promise((done, fail) => {
    ws.addEventListener('open', done, { once: true });
    ws.addEventListener('error', fail, { once: true });
  });
  const cdp = new Cdp(ws);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Runtime.addBinding', { name: '__dsmark' });

  const segments = [];
  for (const lang of LANGS) {
    console.log('recording ' + lang + ' ...');
    segments.push(await recordSegment(cdp, lang));
  }
  ws.close();

  const files = [];
  for (const segment of segments) {
    console.log('encoding ' + segment.lang + ' ...');
    files.push(encodeSegment(segment));
  }

  const listPath = join(ROOT, 'concat.txt');
  writeFileSync(listPath, files.map((file) => "file '" + file.replace(/\\/g, '/') + "'").join('\n'), 'utf8');
  const finalFile = join(DEMO, 'dsh-opening-demo.mp4');
  const result = spawnSync(
    FFMPEG,
    ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listPath,
     '-c', 'copy', '-movflags', '+faststart', finalFile],
    { stdio: 'inherit' },
  );
  if (result.status !== 0) throw new Error('concat failed');
  console.log('wrote ' + finalFile);
}

await main();
