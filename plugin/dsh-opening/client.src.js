/**
 * @local/dsh-opening — Client half.
 *
 * Registers one entry into `shell.overlay` (a frame-wide, click-through layer)
 * and plays the boot sequence there: a particle field, five access-protocol
 * steps spoken in Chinese, then a salute in Russian, Chinese and English.
 *
 * The voice is a pre-rendered track. `tools\build-client.mjs` inlines it as a
 * data URI at the top of the generated client.js, so the browser needs no host
 * route and the animation never depends on the HTTP server being present. CUE
 * below is the track's own timeline, so the visuals follow the audio.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-opening',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useRef } = React;

    const NS = 'dsh-opening';
    const TRACK = window.__DSH_OPENING_TRACK__ || '/dsh-opening/asset/boot.wav';

    /** Text projected where the slot owner draws a label. */
    const DICT = {
      zh: { word: '开机序列' },
      en: { word: 'BOOT SEQUENCE' },
    };

    /**
     * The audio timeline, copied from assets/boot.sequence.json.
     * Times are seconds from the moment the track starts.
     */
    const CUE = {
      total: 17.99,
      steps: [
        { at: 0.9, end: 1.98, zh: '需要访问许可', en: 'ACCESS PERMISSION REQUIRED' },
        { at: 2.6, end: 3.76, zh: '身份资料确认', en: 'IDENTITY VERIFICATION' },
        { at: 4.38, end: 5.54, zh: '接受访问需求', en: 'ACCESS REQUEST ACCEPTED' },
        { at: 6.16, end: 7.28, zh: '开始读取权限', en: 'PERMISSION READ STARTED' },
        { at: 7.9, end: 9.38, zh: '读取完毕 · 核验通过', en: 'READ COMPLETE · VERIFIED' },
      ],
      finale: [
        { lang: 'ru', at: 10.28, end: 12.09, text: 'ДОБРО ПОЖАЛОВАТЬ, ТОВАРИЩ' },
        { lang: 'zh', at: 12.64, end: 14.05, text: '欢迎回来，指挥员' },
        { lang: 'en', at: 14.6, end: 15.94, text: 'WELCOME BACK, COMMANDER' },
      ],
      fadeOut: 0.52,
    };

    const FINALE_AT = CUE.finale[0].at;
    const LAST_STEP = CUE.steps.length - 1;

    const PALETTE = {
      stage: '#f7f8fa',
      ink: '#0b0d10',
      dim: '#5b6672',
      rule: 'rgba(11, 13, 16, 0.14)',
      accent: '#3d86c6',
      particle: '127, 182, 232',
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
      if (t < CUE.steps[0].at) return { phase: -1, active: -1 };
      if (t < FINALE_AT) {
        let phase = 0;
        for (let i = 0; i < CUE.steps.length; i++) {
          if (t >= CUE.steps[i].at) phase = i;
        }
        return { phase, active: -1 };
      }
      let active = -1;
      for (let i = 0; i < CUE.finale.length; i++) {
        if (t >= CUE.finale[i].at) active = i;
      }
      return { phase: CUE.steps.length, active };
    }

    /**
     * A drifting particle field with proximity links — the 流浪地球 line work,
     * reduced to its cheapest honest version: dots that tethers draw themselves
     * between. All state lives in this closure; the caller resizes and draws.
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
          a: 0.14 + Math.random() * 0.52,
        };
      }

      function resize() {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        w = canvas.clientWidth || window.innerWidth;
        h = canvas.clientHeight || window.innerHeight;
        canvas.width = Math.max(1, Math.round(w * dpr));
        canvas.height = Math.max(1, Math.round(h * dpr));
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const want = Math.max(24, Math.min(92, Math.round((w * h) / 24000)));
        while (parts.length < want) parts.push(spawn());
        parts.length = want;
      }

      function frame(dt, finale) {
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

        const reach = 110 + finale * 160;
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
            const alpha = (1 - d / reach) * 0.22;
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
  background: var(--dshop-stage);
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
  opacity: 0.5;
  -webkit-mask-image: radial-gradient(ellipse 72% 64% at 50% 50%, #000 26%, transparent 76%);
  mask-image: radial-gradient(ellipse 72% 64% at 50% 50%, #000 26%, transparent 76%);
}

.dshop-tick {
  position: absolute;
  width: 18px;
  height: 18px;
  border: 1px solid var(--dshop-ink);
  opacity: 0.55;
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

.dshop-finale { display: flex; flex-direction: column; align-items: center; gap: 16px; }
.dshop-finale div {
  transition: opacity 0.32s ease, color 0.32s ease, letter-spacing 0.32s ease;
}
.dshop-finale .f-ru,
.dshop-finale .f-en {
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: clamp(10px, 1.05vw, 13px);
  letter-spacing: 0.34em;
  color: var(--dshop-faint);
}
.dshop-finale .f-zh {
  font-size: clamp(26px, 3.6vw, 46px);
  font-weight: 500;
  letter-spacing: 0.18em;
  color: var(--dshop-faint);
}
.dshop-finale .is-live { color: var(--dshop-ink); }
.dshop-finale .is-live.f-ru,
.dshop-finale .is-live.f-en { letter-spacing: 0.42em; }
.dshop-finale .f-zh.is-live { letter-spacing: 0.24em; }

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

@media (prefers-reduced-motion: reduce) {
  .dshop-root, .dshop-root * { animation: none !important; transition: opacity 0.2s linear !important; }
}
`;

    /* ---- component ------------------------------------------------------ */

    function Stage() {
      const [phase, setPhase] = useState(-1);
      const [active, setActive] = useState(-1);
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
        let activeRef = -1;

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

        const track = new Audio(TRACK);
        track.preload = 'auto';
        track.volume = 0.95;
        const startedAt = window.performance.now();
        const playAttempt = track.play();
        if (playAttempt && typeof playAttempt.catch === 'function') {
          playAttempt.catch(() => {
            /* autoplay blocked or the asset is missing: the sequence stays silent */
          });
        }

        const clock = () => {
          if (!track.paused && track.currentTime > 0) return track.currentTime;
          return (window.performance.now() - startedAt) / 1000;
        };

        const end = () => {
          if (ending || disposed) return;
          ending = true;
          try {
            track.pause();
            track.currentTime = 0;
          } catch (error) {
            /* nothing to stop */
          }
          setLeaving(true);
          setPhase(CUE.steps.length);
          later(() => setGone(true), CUE.fadeOut * 1000 + 80);
        };

        let lastFrame = 0;
        const tick = (ts) => {
          if (disposed) return;
          const now = typeof ts === 'number' ? ts : window.performance.now();
          const dt = lastFrame ? Math.min(50, now - lastFrame) : 16;
          lastFrame = now;

          const t = clock();
          if (field) field.frame(dt, clamp01((t - FINALE_AT) / 5.5));

          const spot = stageAt(t);
          if (spot.phase !== phaseRef) {
            phaseRef = spot.phase;
            setPhase(spot.phase);
          }
          if (spot.active !== activeRef) {
            activeRef = spot.active;
            setActive(spot.active);
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
            track.pause();
            track.removeAttribute('src');
          } catch (error) {
            /* the element is already gone */
          }
        };
      }, []);

      if (gone) return null;

      const step = phase >= 0 && phase <= LAST_STEP ? CUE.steps[phase] : null;
      const inFinale = phase >= CUE.steps.length;
      const seen = CUE.steps.slice(0, Math.max(0, Math.min(phase + 1, CUE.steps.length)));

      return h(
        'div',
        {
          className: 'dshop-root' + (leaving ? ' is-leaving' : ''),
          style: {
            '--dshop-stage': PALETTE.stage,
            '--dshop-ink': PALETTE.ink,
            '--dshop-dim': PALETTE.dim,
            '--dshop-faint': 'rgba(11, 13, 16, 0.28)',
            '--dshop-rule': PALETTE.rule,
            '--dshop-accent': PALETTE.accent,
            '--dshop-fade': CUE.fadeOut + 's',
          },
        },
        h('style', { key: 'css' }, CSS),
        h('canvas', { key: 'field', ref: canvasRef, className: 'dshop-canvas' }),
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
        h(
          'div',
          { key: 'center', className: 'dshop-center' },
          inFinale
            ? h(
                'div',
                { className: 'dshop-finale', key: 'finale' },
                CUE.finale.map((line, i) =>
                  h(
                    'div',
                    {
                      key: 'f-' + line.lang,
                      className: 'f-' + line.lang + (active === i ? ' is-live' : ''),
                    },
                    line.text,
                  ),
                ),
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
