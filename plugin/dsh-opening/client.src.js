/**
 * @local/dsh-opening — Client half.
 *
 * Registers one entry into `shell.overlay` (a frame-wide, click-through layer)
 * and plays the boot sequence there: the whale mark surfaces and sinks back
 * into the dark, twin broken rings turn behind it, a particle field breathes,
 * five access-protocol steps type themselves out one at a time, then a salute
 * in the same language, then everything dissolves.
 *
 * The voice is a pre-rendered track. `tools\build-client.mjs` inlines it as a
 * data URI at the top of the generated client.js together with the matching
 * timeline and the mark, so the browser needs no host route and the visuals
 * always follow the audio the file actually carries.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-opening',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useRef } = React;

    const NS = 'dsh-opening';

    /** Text projected where the slot owner draws a label. */
    const DICT = {
      zh: { word: '开机序列' },
      en: { word: 'BOOT SEQUENCE' },
    };

    /**
     * Fallback timeline, used only when the file is loaded without a build.
     * A real build overwrites this from assets/boot-<lang>.sequence.json.
     */
    const FALLBACK_CUE = {
      lang: 'zh',
      total: 18,
      leadIn: 2.6,
      fadeOut: 0.52,
      mark: { at: 1.02, dur: 1.58 },
      steps: [
        { at: 2.6, end: 3.9, text: { zh: '需要访问许可', en: 'ACCESS PERMISSION REQUIRED', ru: 'ТРЕБУЕТСЯ ДОСТУП' } },
        { at: 4.9, end: 6.1, text: { zh: '身份资料确认', en: 'IDENTITY VERIFICATION', ru: 'ПРОВЕРКА ЛИЧНОСТИ' } },
        { at: 7.3, end: 8.5, text: { zh: '接受访问需求', en: 'ACCESS REQUEST ACCEPTED', ru: 'ДОСТУП ПРИНЯТ' } },
        { at: 9.7, end: 10.9, text: { zh: '开始读取权限', en: 'PERMISSION READ STARTED', ru: 'ЧТЕНИЕ ПРАВ' } },
        { at: 12.2, end: 13.6, text: { zh: '读取完毕 · 核验通过', en: 'READ COMPLETE · VERIFIED', ru: 'ПРОВЕРЕНО' } },
      ],
      salute: { lang: 'zh', at: 15.5, end: 16.7, text: '欢迎回来，指挥员' },
    };

    const MARK = window.__DSH_OPENING_MARK__ || '';
    const SET =
      Array.isArray(window.__DSH_OPENING_SET__) && window.__DSH_OPENING_SET__.length
        ? window.__DSH_OPENING_SET__
        : [{ lang: 'zh', track: '', cue: FALLBACK_CUE }];

    const CYCLE_KEY = 'dsh-opening:cycle.v2';

    /** Each page load plays the next language of the set, so all of them get seen. */
    function pickSet() {
      let index = 0;
      try {
        const stored = parseInt(window.localStorage.getItem(CYCLE_KEY) || '0', 10);
        index = Number.isFinite(stored) ? Math.abs(stored) % SET.length : 0;
        window.localStorage.setItem(CYCLE_KEY, String(index + 1));
      } catch (error) {
        index = 0;
      }
      return SET[index];
    }

    const ACTIVE = pickSet();
    const CUE = ACTIVE.cue || FALLBACK_CUE;
    const TRACK = ACTIVE.track || '';
    const LANG = CUE.lang || ACTIVE.lang || 'zh';
    const SUBTITLE = LANG === 'zh' ? 'en' : LANG === 'en' ? 'zh' : 'en';
    const SALUTE = Array.isArray(CUE.salute) ? CUE.salute[0] : CUE.salute;
    const LEAD_IN = CUE.leadIn || CUE.steps[0].at;
    const LAST_STEP = CUE.steps.length - 1;
    const BADGE = LANG === 'zh' ? '中文' : LANG === 'en' ? 'EN' : 'RU';

    /** One step in the active language, with the secondary line as fallback. */
    function line(step, lang) {
      if (step.text) return step.text[lang] || step.text.en || step.text.zh || '';
      if (lang === 'zh') return step.zh || '';
      return step.en || step.zh || '';
    }

    const PALETTE = {
      stage: '#f7f8fa',
      ink: '#0b0d10',
      dim: '#5b6672',
      rule: 'rgba(11, 13, 16, 0.14)',
      accent: '#3d86c6',
      particle: '127, 182, 232',
      faint: 'rgba(11, 13, 16, 0.28)',
    };

    /* ---- helpers -------------------------------------------------------- */

    function prefersReducedMotion() {
      try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      } catch (error) {
        return false;
      }
    }

    function clamp01(value) {
      return value < 0 ? 0 : value > 1 ? 1 : value;
    }

    /** Where the sequence stands at `t` seconds into the track. */
    function stageAt(t) {
      if (t < CUE.steps[0].at) return { phase: -1, salute: false };
      if (t < SALUTE.at) {
        let phase = 0;
        for (let i = 0; i < CUE.steps.length; i++) {
          if (t >= CUE.steps[i].at) phase = i;
        }
        return { phase, salute: false };
      }
      return { phase: CUE.steps.length, salute: true };
    }

    function envelope(life) {
      const rise = Math.min(1, life / 0.18);
      const fall = life > 0.7 ? 1 - (life - 0.7) / 0.3 : 1;
      return Math.max(0, Math.min(rise, fall));
    }

    /**
     * A drifting particle field that keeps ionizing: each dot fades in with a
     * bright recombination flash, drifts, then dims out and is born somewhere
     * else. Nearby dots draw tethers between them — the 流浪地球 line work,
     * reduced to its cheapest honest version.
     */
    function makeField(canvas) {
      const ctx = canvas.getContext('2d');
      const parts = [];
      const rgb = PALETTE.particle;
      let w = 0;
      let h = 0;
      let glow = null;

      function makeGlow() {
        const size = 64;
        const sheet = document.createElement('canvas');
        sheet.width = size;
        sheet.height = size;
        const g = sheet.getContext('2d');
        const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        grad.addColorStop(0, 'rgba(127, 182, 232, 0.9)');
        grad.addColorStop(0.34, 'rgba(127, 182, 232, 0.26)');
        grad.addColorStop(1, 'rgba(127, 182, 232, 0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, size, size);
        return sheet;
      }

      function spawn(seeded) {
        return {
          x: Math.random(),
          y: Math.random(),
          vx: (Math.random() - 0.5) * 0.00006,
          vy: (Math.random() - 0.5) * 0.00006,
          r: 0.5 + Math.random() * 1.4,
          a: 0.22 + Math.random() * 0.52,
          life: seeded ? Math.random() : 0,
          span: 2.6 + Math.random() * 4.2,
        };
      }

      function resize() {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        w = canvas.clientWidth || window.innerWidth;
        h = canvas.clientHeight || window.innerHeight;
        canvas.width = Math.max(1, Math.round(w * dpr));
        canvas.height = Math.max(1, Math.round(h * dpr));
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        glow = glow || makeGlow();
        const want = Math.max(24, Math.min(88, Math.round((w * h) / 26000)));
        while (parts.length < want) parts.push(spawn(true));
        parts.length = want;
      }

      function frame(dt, finale) {
        ctx.clearRect(0, 0, w, h);

        for (let i = 0; i < parts.length; i++) {
          const q = parts[i];
          q.life += dt / 1000 / q.span;
          q.x += q.vx * dt;
          q.y += q.vy * dt;
          if (q.life >= 1) {
            const next = spawn(false);
            q.x = next.x;
            q.y = next.y;
            q.vx = next.vx;
            q.vy = next.vy;
            q.r = next.r;
            q.a = next.a;
            q.span = next.span;
            q.life = 0;
            continue;
          }
          if (q.x < -0.02) q.x = 1.02;
          else if (q.x > 1.02) q.x = -0.02;
          if (q.y < -0.02) q.y = 1.02;
          else if (q.y > 1.02) q.y = -0.02;
        }

        // ignition glow: additive, so crossings brighten each other
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < parts.length; i++) {
          const q = parts[i];
          const e = envelope(q.life);
          if (e <= 0.001) continue;
          const px = q.x * w;
          const py = q.y * h;
          const reach = (7 + 13 * e) * (1 + 0.5 * finale);
          ctx.globalAlpha = e * 0.5;
          ctx.drawImage(glow, px - reach, py - reach, reach * 2, reach * 2);

          if (q.life < 0.16) {
            const spark = 1 - q.life / 0.16;
            ctx.globalAlpha = spark * 0.85;
            ctx.strokeStyle = 'rgba(226, 242, 255, 0.95)';
            ctx.lineWidth = 0.9;
            const arm = 4 + 11 * spark;
            ctx.beginPath();
            ctx.moveTo(px - arm, py);
            ctx.lineTo(px + arm, py);
            ctx.moveTo(px, py - arm);
            ctx.lineTo(px, py + arm);
            ctx.stroke();
          }
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;

        const span = 104 + finale * 150;
        ctx.lineWidth = 0.6;
        for (let i = 0; i < parts.length; i++) {
          const a = parts[i];
          const ea = envelope(a.life);
          if (ea <= 0.05) continue;
          const ax = a.x * w;
          const ay = a.y * h;
          for (let j = i + 1; j < parts.length; j++) {
            const b = parts[j];
            const dx = ax - b.x * w;
            const dy = ay - b.y * h;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d > span) continue;
            const alpha = (1 - d / span) * 0.2 * ea * envelope(b.life);
            ctx.strokeStyle = 'rgba(61, 134, 198, ' + alpha.toFixed(3) + ')';
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(b.x * w, b.y * h);
            ctx.stroke();
          }
        }

        for (let i = 0; i < parts.length; i++) {
          const q = parts[i];
          const e = envelope(q.life);
          if (e <= 0.01) continue;
          ctx.beginPath();
          ctx.arc(q.x * w, q.y * h, q.r, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(' + rgb + ', ' + (q.a * e).toFixed(3) + ')';
          ctx.fill();
        }
      }

      return { resize, frame };
    }

    /* ---- styles --------------------------------------------------------- */

    const CSS = `
.dshop-root {
  position: fixed;
  inset: 0;
  z-index: 2147483;
  overflow: hidden;
  pointer-events: none;
  background:
    radial-gradient(ellipse 58% 52% at 50% 46%, rgba(255, 255, 255, 0.92) 0%, rgba(247, 248, 250, 0) 62%),
    var(--dshop-stage);
  color: var(--dshop-ink);
  font-family: "Segoe UI", "Microsoft YaHei", -apple-system, system-ui, sans-serif;
  opacity: 1;
  transition:
    opacity var(--dshop-fade) cubic-bezier(0.4, 0, 0.2, 1),
    transform var(--dshop-fade) cubic-bezier(0.4, 0, 0.2, 1);
  -webkit-font-smoothing: antialiased;
}
.dshop-root.is-leaving { opacity: 0; transform: scale(1.012); }

.dshop-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}

/* A sheet of paper, not a flat fill: grain gives the white some tooth. */
.dshop-grain {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.05;
  mix-blend-mode: multiply;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E");
  background-size: 180px 180px;
  animation: dshop-soft-in 1.5s ease 0.15s both;
}

.dshop-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(
    ellipse 78% 70% at 50% 50%,
    rgba(11, 13, 16, 0) 50%,
    rgba(11, 13, 16, 0.07) 100%
  );
  animation: dshop-fade 1.8s ease both;
}

.dshop-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(to right, var(--dshop-rule) 1px, transparent 1px),
    linear-gradient(to bottom, var(--dshop-rule) 1px, transparent 1px);
  background-size: 64px 64px;
  background-position: center;
  opacity: 0.42;
  -webkit-mask-image: radial-gradient(ellipse 70% 62% at 50% 50%, #000 22%, transparent 74%);
  mask-image: radial-gradient(ellipse 70% 62% at 50% 50%, #000 22%, transparent 74%);
}

.dshop-rings {
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(93vmin, 900px);
  height: min(93vmin, 900px);
  transform: translate(-50%, -50%);
  overflow: visible;
}
.dshop-ring circle {
  fill: none;
  stroke: var(--dshop-rule);
  stroke-linecap: round;
}
.dshop-ring { transform-box: fill-box; transform-origin: center; }
.dshop-ring.a { filter: drop-shadow(0 0 7px rgba(61, 134, 198, 0.2)); }
.dshop-ring.d { animation: dshop-spin-rev 88s linear infinite; }
.dshop-ring.d circle { stroke: rgba(11, 13, 16, 0.2); stroke-width: 0.9; stroke-dasharray: 1 5.4; }
.dshop-ring.a { animation: dshop-spin 30s linear infinite; }
.dshop-ring.a circle { stroke: rgba(61, 134, 198, 0.42); stroke-width: 1.1; stroke-dasharray: 300 190; }
.dshop-ring.b { animation: dshop-spin-rev 19s linear infinite; }
.dshop-ring.b circle { stroke: rgba(11, 13, 16, 0.34); stroke-width: 1.7; stroke-dasharray: 150 233; }
.dshop-ring.c { animation: dshop-spin 55s linear infinite; }
.dshop-ring.c circle { stroke: rgba(11, 13, 16, 0.16); stroke-width: 1; stroke-dasharray: 3 27; }

.dshop-rings { animation: dshop-soft-in 1.2s cubic-bezier(0.2, 0.72, 0.2, 1) 0.04s both; }

.dshop-mark {
  position: absolute;
  left: 50%;
  top: 50%;
  width: clamp(84px, 10.5vmin, 128px);
  height: auto;
  transform: translate(-50%, -50%);
  opacity: 0;
  animation: dshop-mark var(--dshop-mark-dur) cubic-bezier(0.33, 0, 0.2, 1) var(--dshop-mark-delay) both;
  filter: drop-shadow(0 10px 26px rgba(11, 13, 16, 0.16));
}

.dshop-tick {
  animation: dshop-shell 0.9s cubic-bezier(0.2, 0.72, 0.2, 1) 0.22s both;
  position: absolute;
  width: 18px;
  height: 18px;
  border: 1px solid var(--dshop-ink);
  opacity: 0.5;
}
.dshop-tick.tl { top: 18px; left: 18px; border-right: 0; border-bottom: 0; }
.dshop-tick.tr { top: 18px; right: 18px; border-left: 0; border-bottom: 0; }
.dshop-tick.bl { bottom: 18px; left: 18px; border-right: 0; border-top: 0; }
.dshop-tick.br { bottom: 18px; right: 18px; border-left: 0; border-top: 0; }

.dshop-topbar {
  animation: dshop-shell 0.9s cubic-bezier(0.2, 0.72, 0.2, 1) 0.14s both;
  position: absolute;
  top: 26px;
  left: 34px;
  right: 34px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.34em;
  text-transform: uppercase;
  color: var(--dshop-dim);
}

.dshop-lang {
  border: 1px solid var(--dshop-rule);
  border-radius: 2px;
  padding: 1px 5px;
  letter-spacing: 0.14em;
  color: var(--dshop-ink);
}

.dshop-counter {
  color: var(--dshop-accent);
  letter-spacing: 0.24em;
}

.dshop-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 0 8vw;
}

.dshop-root.is-ru .dshop-zh { font-size: clamp(19px, 2.5vw, 33px); letter-spacing: 0.1em; }

.dshop-zh {
  text-wrap: balance;
  max-width: 62vmin;
  font-size: clamp(22px, 3.1vw, 40px);
  font-weight: 500;
  letter-spacing: 0.16em;
  line-height: 1.25;
  animation: dshop-rise 0.42s cubic-bezier(0.2, 0.72, 0.2, 1) both;
}

.dshop-en {
  margin-top: 14px;
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: clamp(9px, 0.95vw, 11.5px);
  letter-spacing: 0.4em;
  text-transform: uppercase;
  color: var(--dshop-dim);
  animation: dshop-rise 0.42s cubic-bezier(0.2, 0.72, 0.2, 1) 0.05s both;
}

.dshop-caret {
  display: inline-block;
  width: 0.5em;
  height: 0.92em;
  margin-left: 0.34em;
  vertical-align: -0.08em;
  background: var(--dshop-accent);
  animation: dshop-blink 1.05s steps(1, end) infinite;
}

.dshop-salute {
  animation: dshop-rise 0.66s cubic-bezier(0.2, 0.72, 0.2, 1) both;
  text-align: center;
}
.dshop-salute-lead {
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: clamp(12px, 1.35vw, 16px);
  letter-spacing: 0.42em;
  text-transform: uppercase;
  color: var(--dshop-dim);
  animation: dshop-rise 0.6s cubic-bezier(0.2, 0.72, 0.2, 1) both;
}
.dshop-salute-rule {
  width: clamp(46px, 7vw, 96px);
  height: 1px;
  margin: 15px auto 0;
  background: linear-gradient(
    to right,
    rgba(11, 13, 16, 0) 0%,
    rgba(11, 13, 16, 0.34) 50%,
    rgba(11, 13, 16, 0) 100%
  );
  animation: dshop-fade 0.9s ease 0.24s both;
}
.dshop-salute-name {
  margin-top: 13px;
  font-size: clamp(28px, 4.2vw, 54px);
  font-weight: 500;
  letter-spacing: 0.2em;
  animation: dshop-rise 0.7s cubic-bezier(0.2, 0.72, 0.2, 1) 0.12s both;
}
.dshop-salute.ru .dshop-salute-name,
.dshop-salute.en .dshop-salute-name {
  font-size: clamp(24px, 3.4vw, 42px);
  letter-spacing: 0.12em;
}
.dshop-salute.zh { font-size: clamp(26px, 3.6vw, 46px); font-weight: 500; }

.dshop-log {
  position: absolute;
  left: 34px;
  bottom: 62px;
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: 10.5px;
  letter-spacing: 0.1em;
  color: var(--dshop-dim);
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.dshop-logrow {
  display: flex;
  align-items: baseline;
  gap: 9px;
  animation: dshop-fade 0.4s ease both;
}
.dshop-logrow em {
  font-style: normal;
  color: rgba(11, 13, 16, 0.3);
  letter-spacing: 0.06em;
}
.dshop-logrow i {
  font-style: normal;
  color: var(--dshop-accent);
  font-size: 9px;
}
.dshop-logrow b {
  font-weight: 400;
  color: rgba(11, 13, 16, 0.26);
  letter-spacing: 0.06em;
}

.dshop-progress {
  animation: dshop-shell 1s cubic-bezier(0.2, 0.72, 0.2, 1) 0.26s both;
  position: absolute;
  left: 34px;
  right: 34px;
  bottom: 34px;
  height: 1px;
  background: var(--dshop-rule);
}
.dshop-progress::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: -8px;
  height: 5px;
  opacity: 0.6;
  background-image: repeating-linear-gradient(
    to right,
    rgba(11, 13, 16, 0.26) 0 1px,
    transparent 1px 4%
  );
}
.dshop-progress i {
  display: block;
  height: 1px;
  background: linear-gradient(to right, rgba(11, 13, 16, 0.45), var(--dshop-ink));
  transform: scaleX(0);
  transform-origin: left center;
  will-change: transform;
}
.dshop-progress b {
  position: absolute;
  top: 0;
  left: 0;
  width: 5px;
  height: 5px;
  margin: -2px 0 0 -2px;
  border-radius: 50%;
  background: var(--dshop-accent);
  box-shadow: 0 0 7px rgba(61, 134, 198, 0.6);
  will-change: left;
}

@keyframes dshop-rise {
  from { opacity: 0; transform: translateY(9px); filter: blur(2px); }
  to { opacity: 1; transform: translateY(0); filter: blur(0); }
}
@keyframes dshop-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes dshop-soft-in {
  from { opacity: 0; }
}
@keyframes dshop-shell {
  from { opacity: 0; transform: translateY(4px); }
  to { transform: translateY(0); }
}
@keyframes dshop-blink {
  0%, 55% { opacity: 1; }
  56%, 100% { opacity: 0.12; }
}
@keyframes dshop-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes dshop-spin-rev {
  from { transform: rotate(0deg); }
  to { transform: rotate(-360deg); }
}
@keyframes dshop-mark {
  0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.93); filter: blur(7px) drop-shadow(0 10px 26px rgba(11, 13, 16, 0.12)); }
  26%  { opacity: 1; transform: translate(-50%, -50%) scale(1); filter: blur(0) drop-shadow(0 10px 26px rgba(11, 13, 16, 0.18)); }
  64%  { opacity: 1; transform: translate(-50%, -50%) scale(1.015); filter: blur(0) drop-shadow(0 10px 26px rgba(11, 13, 16, 0.18)); }
  100% { opacity: 0; transform: translate(-50%, -54%) scale(1.05); filter: blur(5px) drop-shadow(0 10px 26px rgba(11, 13, 16, 0.1)); }
}

@media (prefers-reduced-motion: reduce) {
  .dshop-root, .dshop-root * { animation: none !important; transition: opacity 0.2s linear !important; }
  .dshop-mark { opacity: 0; }
}
`;

    /* ---- component ------------------------------------------------------ */

    function Rings() {
      return h(
        'svg',
        { className: 'dshop-rings', viewBox: '0 0 200 200', 'aria-hidden': 'true' },
        h('g', { className: 'dshop-ring c' }, h('circle', { cx: 100, cy: 100, r: 95 })),
        h('g', { className: 'dshop-ring a' }, h('circle', { cx: 100, cy: 100, r: 83 })),
        h('g', { className: 'dshop-ring b' }, h('circle', { cx: 100, cy: 100, r: 71 })),
        h('g', { className: 'dshop-ring d' }, h('circle', { cx: 100, cy: 100, r: 64 })),
      );
    }

    function Stage() {
      const [phase, setPhase] = useState(-1);
      const [salute, setSalute] = useState(false);
      const [leaving, setLeaving] = useState(false);
      const [gone, setGone] = useState(false);
      const canvasRef = useRef(null);
      const counterRef = useRef(null);
      const progressRef = useRef(null);
      const headRef = useRef(null);

      useEffect(() => {
        if (prefersReducedMotion()) {
          setGone(true);
          return undefined;
        }

        let disposed = false;
        let ending = false;
        let raf = 0;
        const timers = new Set();
        let phaseRef = -1;
        let saluteRef = false;

        const later = (fn, ms) => {
          const id = setTimeout(() => {
            timers.delete(id);
            if (!disposed) fn();
          }, ms);
          timers.add(id);
        };

        const canvas = canvasRef.current;
        const field = canvas ? makeField(canvas) : null;
        if (field) {
          field.resize();
          window.addEventListener('resize', field.resize);
        }

        const startedAt = window.performance.now();
        let track = null;
        if (TRACK) {
          track = new Audio(TRACK);
          track.preload = 'auto';
          track.volume = 0.95;
          const playAttempt = track.play();
          if (playAttempt && typeof playAttempt.catch === 'function') {
            playAttempt.catch(() => {
              /* autoplay blocked: the sequence carries on silently */
            });
          }
        }

        const clock = () => {
          if (track && !track.paused && track.currentTime > 0) return track.currentTime;
          return (window.performance.now() - startedAt) / 1000;
        };

        const end = () => {
          if (ending || disposed) return;
          ending = true;
          try {
            if (track) {
              track.pause();
              track.currentTime = 0;
            }
          } catch (error) {
            /* nothing to stop */
          }
          setLeaving(true);
          later(() => setGone(true), CUE.fadeOut * 1000 + 80);
        };

        let lastFrame = 0;
        const tick = (ts) => {
          if (disposed) return;
          const now = typeof ts === 'number' ? ts : window.performance.now();
          const dt = lastFrame ? Math.min(50, now - lastFrame) : 16;
          lastFrame = now;

          const t = clock();
          if (field) field.frame(dt, clamp01((t - SALUTE.at + 1.6) / 6));

          const spot = stageAt(t);
          if (spot.phase !== phaseRef) {
            phaseRef = spot.phase;
            setPhase(spot.phase);
          }
          if (spot.salute !== saluteRef) {
            saluteRef = spot.salute;
            setSalute(spot.salute);
          }

          if (counterRef.current) {
            const counter = (Math.floor(t * 37.3) % 0xffff).toString(16).toUpperCase();
            counterRef.current.textContent = ('0000' + counter).slice(-4);
          }
          const progress = clamp01(t / CUE.total);
          if (progressRef.current) {
            progressRef.current.style.transform = 'scaleX(' + progress.toFixed(4) + ')';
          }
          if (headRef.current) {
            headRef.current.style.left = (progress * 100).toFixed(3) + '%';
          }

          if (t >= CUE.total) {
            end();
            return;
          }
          raf = window.requestAnimationFrame(tick);
        };

        const onSkip = () => end();

        window.addEventListener('pointerdown', onSkip, true);
        window.addEventListener('keydown', onSkip, true);
        raf = window.requestAnimationFrame(tick);

        return () => {
          disposed = true;
          if (raf) window.cancelAnimationFrame(raf);
          timers.forEach((id) => clearTimeout(id));
          timers.clear();
          if (field) window.removeEventListener('resize', field.resize);
          window.removeEventListener('pointerdown', onSkip, true);
          window.removeEventListener('keydown', onSkip, true);
          try {
            if (track) {
              track.pause();
              track.removeAttribute('src');
            }
          } catch (error) {
            /* the element is already gone */
          }
        };
      }, []);

      if (gone) return null;

      const step = phase >= 0 && phase <= LAST_STEP ? CUE.steps[phase] : null;
      const seen = CUE.steps.slice(0, Math.max(0, Math.min(phase + 1, CUE.steps.length)));
      const leadIn = phase === -1;

      return h(
        'div',
        {
          className: 'dshop-root' + (leaving ? ' is-leaving' : '') + (LANG === 'ru' ? ' is-ru' : ''),
          style: {
            '--dshop-stage': PALETTE.stage,
            '--dshop-ink': PALETTE.ink,
            '--dshop-dim': PALETTE.dim,
            '--dshop-faint': PALETTE.faint,
            '--dshop-rule': PALETTE.rule,
            '--dshop-accent': PALETTE.accent,
            '--dshop-fade': CUE.fadeOut + 's',
            '--dshop-lead': LEAD_IN + 's',
            '--dshop-mark-dur': (CUE.mark ? CUE.mark.dur : 1.2) + 's',
            '--dshop-mark-delay': (CUE.mark ? CUE.mark.at : 1.4) + 's',
          },
        },
        h('style', { key: 'css' }, CSS),
        h('canvas', { key: 'field', ref: canvasRef, className: 'dshop-canvas' }),
        h(Rings, { key: 'rings' }),
        h('div', { key: 'grid', className: 'dshop-grid' }),
        h('div', { key: 'grain', className: 'dshop-grain' }),
        h('div', { key: 'vignette', className: 'dshop-vignette' }),
        h('div', { key: 'tl', className: 'dshop-tick tl' }),
        h('div', { key: 'tr', className: 'dshop-tick tr' }),
        h('div', { key: 'bl', className: 'dshop-tick bl' }),
        h('div', { key: 'br', className: 'dshop-tick br' }),
        h(
          'div',
          { key: 'top', className: 'dshop-topbar' },
          h('span', null, 'DSH · ACCESS CONTROL'),
          h('span', { className: 'dshop-lang' }, BADGE),
          h('span', { ref: counterRef, className: 'dshop-counter' }, '0000'),
          h('span', null, 'BOOT SEQUENCE'),
        ),
        leadIn && MARK
          ? h('img', { key: 'mark', className: 'dshop-mark', src: MARK, alt: '' })
          : null,
        h(
          'div',
          { key: 'center', className: 'dshop-center' },
          salute
            ? h(
                'div',
                { className: 'dshop-salute ' + (SALUTE.lang || 'zh'), key: 'salute' },
                Array.isArray(SALUTE.lines) && SALUTE.lines.length === 2
                  ? [
                      h('div', { key: 'lead', className: 'dshop-salute-lead' }, SALUTE.lines[0]),
                      h('div', { key: 'rule', className: 'dshop-salute-rule' }),
                      h('div', { key: 'name', className: 'dshop-salute-name' }, SALUTE.lines[1]),
                    ]
                  : SALUTE.text,
              )
            : step
              ? h(
                  'div',
                  { key: 'step-' + phase },
                  h(
                    'div',
                    { className: 'dshop-zh' },
                    line(step, LANG),
                    h('span', { className: 'dshop-caret' }),
                  ),
                  h('div', { className: 'dshop-en' }, line(step, SUBTITLE)),
                )
              : null,
        ),
        h(
          'div',
          { key: 'log', className: 'dshop-log' },
          seen.map((row, i) =>
            h(
              'div',
              { key: 'log-' + i, className: 'dshop-logrow' },
              h('em', null, ('0' + (i + 1)).slice(-2)),
              h('i', null, '✓'),
              h('span', null, line(row, LANG)),
              h('b', null, row.at.toFixed(2) + 's'),
            ),
          ),
        ),
        h(
          'div',
          { key: 'bar', className: 'dshop-progress' },
          h('i', { ref: progressRef }),
          h('b', { ref: headRef }),
        ),
      );
    }

    function apply(ctx) {
      ctx.effect(
        () => ctx.locale.register(NS, { zh: DICT.zh, en: DICT.en }),
        'dsh-opening: dictionaries',
      );
      const t = ctx.locale.bind(NS);
      ctx.slots.inject('shell.overlay', () =>
        ctx.slots.register(
          {
            name: 'shell.overlay',
            id: 'dsh-opening',
            order: -1000,
            label: () => t('word'),
          },
          () => h(Stage, null),
        ),
      );
    }

    return { inject: ['slots', 'locale'], apply };
  },
});
