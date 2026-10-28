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
      steps: [
        { at: 2.6, end: 3.9, zh: '需要访问许可', en: 'ACCESS PERMISSION REQUIRED' },
        { at: 4.7, end: 6.0, zh: '身份资料确认', en: 'IDENTITY VERIFICATION' },
        { at: 6.8, end: 8.1, zh: '接受访问需求', en: 'ACCESS REQUEST ACCEPTED' },
        { at: 8.9, end: 10.2, zh: '开始读取权限', en: 'PERMISSION READ STARTED' },
        { at: 11.0, end: 12.4, zh: '读取完毕 · 核验通过', en: 'READ COMPLETE · VERIFIED' },
      ],
      salute: { lang: 'zh', at: 13.3, end: 14.8, text: '欢迎回来，指挥员' },
    };

    const CUE = window.__DSH_OPENING_CUE__ || FALLBACK_CUE;
    const TRACK = window.__DSH_OPENING_TRACK__ || '';
    const MARK = window.__DSH_OPENING_MARK__ || '';
    const SALUTE = Array.isArray(CUE.salute) ? CUE.salute[0] : CUE.salute;
    const LEAD_IN = CUE.leadIn || CUE.steps[0].at;
    const LAST_STEP = CUE.steps.length - 1;

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

    /**
     * A drifting particle field with proximity links — the 流浪地球 line work,
     * reduced to its cheapest honest version: dots that draw their own tethers.
     * All state lives in this closure; the caller resizes and draws.
     */
    function makeField(canvas) {
      const ctx = canvas.getContext('2d');
      const parts = [];
      const rgb = PALETTE.particle;
      let w = 0;
      let h = 0;

      function spawn() {
        return {
          x: Math.random(),
          y: Math.random(),
          vx: (Math.random() - 0.5) * 0.000045,
          vy: (Math.random() - 0.5) * 0.000045,
          r: 0.55 + Math.random() * 1.75,
          a: 0.12 + Math.random() * 0.46,
        };
      }

      function resize() {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        w = canvas.clientWidth || window.innerWidth;
        h = canvas.clientHeight || window.innerHeight;
        canvas.width = Math.max(1, Math.round(w * dpr));
        canvas.height = Math.max(1, Math.round(h * dpr));
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const want = Math.max(24, Math.min(88, Math.round((w * h) / 26000)));
        while (parts.length < want) parts.push(spawn());
        parts.length = want;
      }

      function frame(dt, glow) {
        ctx.clearRect(0, 0, w, h);
        for (let i = 0; i < parts.length; i++) {
          const q = parts[i];
          q.x += q.vx * dt;
          q.y += q.vy * dt;
          if (q.x < -0.02) q.x = 1.02;
          else if (q.x > 1.02) q.x = -0.02;
          if (q.y < -0.02) q.y = 1.02;
          else if (q.y > 1.02) q.y = -0.02;
        }

        const reach = 104 + glow * 150;
        ctx.lineWidth = 0.6;
        for (let i = 0; i < parts.length; i++) {
          const a = parts[i];
          const ax = a.x * w;
          const ay = a.y * h;
          for (let j = i + 1; j < parts.length; j++) {
            const b = parts[j];
            const dx = ax - b.x * w;
            const dy = ay - b.y * h;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d > reach) continue;
            const alpha = (1 - d / reach) * 0.2;
            ctx.strokeStyle = 'rgba(61, 134, 198, ' + alpha.toFixed(3) + ')';
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(b.x * w, b.y * h);
            ctx.stroke();
          }
        }

        for (let i = 0; i < parts.length; i++) {
          const q = parts[i];
          ctx.beginPath();
          ctx.arc(q.x * w, q.y * h, q.r, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(' + rgb + ', ' + q.a.toFixed(3) + ')';
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
  transition: opacity var(--dshop-fade) cubic-bezier(0.4, 0, 0.2, 1);
  -webkit-font-smoothing: antialiased;
}
.dshop-root.is-leaving { opacity: 0; }

.dshop-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
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
  width: min(76vmin, 720px);
  height: min(76vmin, 720px);
  transform: translate(-50%, -50%);
  overflow: visible;
}
.dshop-ring circle {
  fill: none;
  stroke: var(--dshop-rule);
  stroke-linecap: round;
}
.dshop-ring { transform-box: fill-box; transform-origin: center; }
.dshop-ring.a { animation: dshop-spin 52s linear infinite; }
.dshop-ring.a circle { stroke: rgba(61, 134, 198, 0.42); stroke-width: 1.1; stroke-dasharray: 300 190; }
.dshop-ring.b { animation: dshop-spin-rev 34s linear infinite; }
.dshop-ring.b circle { stroke: rgba(11, 13, 16, 0.34); stroke-width: 1.7; stroke-dasharray: 150 233; }
.dshop-ring.c { animation: dshop-spin 96s linear infinite; }
.dshop-ring.c circle { stroke: rgba(11, 13, 16, 0.16); stroke-width: 1; stroke-dasharray: 3 27; }

.dshop-mark {
  position: absolute;
  left: 50%;
  top: 50%;
  width: clamp(84px, 10.5vmin, 128px);
  height: auto;
  transform: translate(-50%, -50%);
  opacity: 0;
  animation: dshop-mark var(--dshop-lead) cubic-bezier(0.33, 0, 0.2, 1) both;
  filter: drop-shadow(0 10px 26px rgba(11, 13, 16, 0.16));
}

.dshop-tick {
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

.dshop-zh {
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
  letter-spacing: 0.18em;
}
.dshop-salute.zh { font-size: clamp(26px, 3.6vw, 46px); font-weight: 500; }
.dshop-salute.en,
.dshop-salute.ru {
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: clamp(13px, 1.5vw, 18px);
  letter-spacing: 0.3em;
  text-transform: uppercase;
}

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
.dshop-logrow i {
  font-style: normal;
  color: var(--dshop-accent);
  font-size: 9px;
}

.dshop-progress {
  position: absolute;
  left: 34px;
  right: 34px;
  bottom: 34px;
  height: 1px;
  background: var(--dshop-rule);
}
.dshop-progress i {
  display: block;
  height: 1px;
  background: var(--dshop-ink);
  transform: scaleX(0);
  transform-origin: left center;
  will-change: transform;
}

@keyframes dshop-rise {
  from { opacity: 0; transform: translateY(9px); filter: blur(2px); }
  to { opacity: 1; transform: translateY(0); filter: blur(0); }
}
@keyframes dshop-fade {
  from { opacity: 0; }
  to { opacity: 1; }
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
        h('g', { className: 'dshop-ring c' }, h('circle', { cx: 100, cy: 100, r: 92 })),
        h('g', { className: 'dshop-ring a' }, h('circle', { cx: 100, cy: 100, r: 78 })),
        h('g', { className: 'dshop-ring b' }, h('circle', { cx: 100, cy: 100, r: 61 })),
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
          if (progressRef.current) {
            progressRef.current.style.transform =
              'scaleX(' + clamp01(t / CUE.total).toFixed(4) + ')';
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
          className: 'dshop-root' + (leaving ? ' is-leaving' : ''),
          style: {
            '--dshop-stage': PALETTE.stage,
            '--dshop-ink': PALETTE.ink,
            '--dshop-dim': PALETTE.dim,
            '--dshop-faint': PALETTE.faint,
            '--dshop-rule': PALETTE.rule,
            '--dshop-accent': PALETTE.accent,
            '--dshop-fade': CUE.fadeOut + 's',
            '--dshop-lead': LEAD_IN + 's',
          },
        },
        h('style', { key: 'css' }, CSS),
        h('canvas', { key: 'field', ref: canvasRef, className: 'dshop-canvas' }),
        h(Rings, { key: 'rings' }),
        h('div', { key: 'grid', className: 'dshop-grid' }),
        h('div', { key: 'tl', className: 'dshop-tick tl' }),
        h('div', { key: 'tr', className: 'dshop-tick tr' }),
        h('div', { key: 'bl', className: 'dshop-tick bl' }),
        h('div', { key: 'br', className: 'dshop-tick br' }),
        h(
          'div',
          { key: 'top', className: 'dshop-topbar' },
          h('span', null, 'DSH · ACCESS CONTROL'),
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
                SALUTE.text,
              )
            : step
              ? h(
                  'div',
                  { key: 'step-' + phase },
                  h(
                    'div',
                    { className: 'dshop-zh' },
                    step.zh,
                    h('span', { className: 'dshop-caret' }),
                  ),
                  h('div', { className: 'dshop-en' }, step.en),
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
              h('i', null, '✓'),
              h('span', null, row.zh),
            ),
          ),
        ),
        h('div', { key: 'bar', className: 'dshop-progress' }, h('i', { ref: progressRef })),
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
