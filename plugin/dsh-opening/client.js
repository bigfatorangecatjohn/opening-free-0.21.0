/**
 * @local/dsh-opening — Client half.
 *
 * Registers one entry into `shell.overlay` (a frame-wide, click-through layer).
 * The entry is a boot sequence: it covers the frame in paper white, plays a
 * five-step access protocol over a particle field, greets the operator in
 * three languages, then dissolves and leaves nothing behind.
 *
 * Art direction lives in the SEQ table below — wording, timing, palette and
 * the voice settings are the only things that should change for a restyle.
 * The mount code below it is plumbing: it must stay inside the slot contract
 * (a fresh id, everything registered through ctx, nothing outside the slot).
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
     * Sequence parameters.
     *
     *   introMs        blank field settles before the first line
     *   steps[]        one access-protocol step: main Chinese line, English
     *                  subtitle, hold duration, and what the voice says
     *   finaleMs       the closing greeting stays up this long
     *   fadeOutMs      the stage dissolves back to the app underneath
     *   skipOnInput    any click / key press ends the sequence immediately
     *   voice          speechSynthesis settings; `lang` picks which of the
     *                  three say-lines is spoken for each step
     *   finale[]       closing salute, one line per language
     *   palette        paper, ink, rule, accent and particle colours
     */
    const SEQ = {
      introMs: 380,
      fadeOutMs: 520,
      finaleMs: 2600,
      skipOnInput: true,
      respectReducedMotion: true,
      voice: {
        enabled: true,
        lang: 'zh',
        rate: 0.98,
        pitch: 0.82,
        volume: 0.9,
        gapMs: 1150,
      },
      steps: [
        {
          zh: '需要访问许可',
          en: 'ACCESS PERMISSION REQUIRED',
          holdMs: 900,
          say: {
            zh: '需要访问许可',
            en: 'Access permission required',
            ru: 'Требуется разрешение на доступ',
          },
        },
        {
          zh: '身份资料确认',
          en: 'IDENTITY VERIFICATION',
          holdMs: 900,
          say: {
            zh: '身份资料确认',
            en: 'Identity verification',
            ru: 'Проверка личности',
          },
        },
        {
          zh: '接受访问需求',
          en: 'ACCESS REQUEST ACCEPTED',
          holdMs: 900,
          say: {
            zh: '接受访问需求',
            en: 'Access request accepted',
            ru: 'Запрос на доступ принят',
          },
        },
        {
          zh: '开始读取权限',
          en: 'PERMISSION READ STARTED',
          holdMs: 1000,
          say: {
            zh: '开始读取权限',
            en: 'Permission read started',
            ru: 'Начинаю чтение прав',
          },
        },
        {
          zh: '读取完毕 · 核验通过',
          en: 'READ COMPLETE · VERIFIED',
          holdMs: 1150,
          say: {
            zh: '读取完毕，核验通过',
            en: 'Read complete. Verified.',
            ru: 'Чтение завершено. Проверено.',
          },
        },
      ],
      finale: [
        {
          kind: 'ru',
          text: 'ДОБРО ПОЖАЛОВАТЬ, ТОВАРИЩ',
          lang: 'ru-RU',
          say: 'Добро пожаловать, товарищ',
        },
        {
          kind: 'zh',
          text: '欢迎回来，指挥员',
          lang: 'zh-CN',
          say: '欢迎回来，指挥员',
        },
        {
          kind: 'en',
          text: 'WELCOME BACK, COMMANDER',
          lang: 'en-US',
          say: 'Welcome back, commander',
        },
      ],
      palette: {
        stage: '#f7f8fa',
        ink: '#0b0d10',
        dim: '#5b6672',
        rule: 'rgba(11, 13, 16, 0.14)',
        accent: '#3d86c6',
        particle: '127, 182, 232',
      },
    };

    /* ---- timeline ------------------------------------------------------- */

    let acc = SEQ.introMs;
    const STARTS = SEQ.steps.map((step) => {
      const at = acc;
      acc += step.holdMs;
      return at;
    });
    const FINALE_AT = acc;
    const TOTAL_MS = FINALE_AT + SEQ.finaleMs;
    const LAST_PHASE = SEQ.steps.length;

    /* ---- helpers -------------------------------------------------------- */

    function prefersReducedMotion() {
      try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      } catch (error) {
        return false;
      }
    }

    function now() {
      return window.performance && window.performance.now
        ? window.performance.now()
        : Date.now();
    }

    function clamp01(value) {
      return value < 0 ? 0 : value > 1 ? 1 : value;
    }

    /** One synthesized line. Cancels whatever was still speaking. */
    function speak(text, lang) {
      const voice = SEQ.voice;
      if (!voice.enabled || !text) return;
      const synth = window.speechSynthesis;
      if (!synth || !window.SpeechSynthesisUtterance) return;
      try {
        const utterance = new window.SpeechSynthesisUtterance(text);
        utterance.lang = lang || 'zh-CN';
        utterance.rate = voice.rate;
        utterance.pitch = voice.pitch;
        utterance.volume = voice.volume;
        synth.cancel();
        synth.speak(utterance);
      } catch (error) {
        /* a missing voice is not worth breaking the boot over */
      }
    }

    function silence() {
      try {
        if (window.speechSynthesis) window.speechSynthesis.cancel();
      } catch (error) {
        /* ignore */
      }
    }

    /**
     * A drifting particle field with proximity links — the 流浪地球 line work,
     * reduced to its cheapest honest version: dots that tethers draw themselves
     * between. All state lives in this closure; the caller resizes and draws.
     */
    function makeField(canvas) {
      const ctx = canvas.getContext('2d');
      const parts = [];
      const rgb = SEQ.palette.particle;
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
  animation: dshop-rise 0.52s cubic-bezier(0.2, 0.72, 0.2, 1) both;
}

.dshop-en {
  margin-top: 14px;
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: clamp(9px, 0.95vw, 11.5px);
  letter-spacing: 0.4em;
  text-transform: uppercase;
  color: var(--dshop-dim);
  animation: dshop-rise 0.52s cubic-bezier(0.2, 0.72, 0.2, 1) 0.06s both;
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

.dshop-finale { display: flex; flex-direction: column; align-items: center; }
.dshop-finale > div {
  animation: dshop-rise 0.62s cubic-bezier(0.2, 0.72, 0.2, 1) both;
}
.dshop-finale .f-ru {
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: clamp(10px, 1.05vw, 13px);
  letter-spacing: 0.34em;
  color: var(--dshop-dim);
  animation-delay: 0.02s;
}
.dshop-finale .f-zh {
  font-size: clamp(26px, 3.6vw, 46px);
  font-weight: 500;
  letter-spacing: 0.18em;
  margin: 16px 0;
  animation-delay: 0.16s;
}
.dshop-finale .f-en {
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: clamp(10px, 1.05vw, 13px);
  letter-spacing: 0.34em;
  color: var(--dshop-dim);
  animation-delay: 0.3s;
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

@media (prefers-reduced-motion: reduce) {
  .dshop-root, .dshop-root * { animation: none !important; transition: opacity 0.2s linear !important; }
}
`;

    /* ---- component ------------------------------------------------------ */

    function Stage() {
      const [phase, setPhase] = useState(-1);
      const [leaving, setLeaving] = useState(false);
      const [gone, setGone] = useState(false);
      const canvasRef = useRef(null);
      const counterRef = useRef(null);
      const progressRef = useRef(null);
      const phaseRef = useRef(-1);

      useEffect(() => {
        if (SEQ.respectReducedMotion && prefersReducedMotion()) {
          setGone(true);
          return undefined;
        }

        let disposed = false;
        let ending = false;
        let raf = 0;
        const timers = new Set();

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

        const end = () => {
          if (ending || disposed) return;
          ending = true;
          silence();
          setLeaving(true);
          later(() => setGone(true), SEQ.fadeOutMs + 80);
        };

        const sayPhase = (index) => {
          if (index < 0) return;
          if (index < SEQ.steps.length) {
            const step = SEQ.steps[index];
            const lang = SEQ.voice.lang;
            const text = step.say[lang] || step.say.zh;
            const code =
              lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-US' : 'zh-CN';
            speak(text, code);
            return;
          }
          SEQ.finale.forEach((line, k) => {
            later(() => speak(line.say, line.lang), k * SEQ.voice.gapMs);
          });
        };

        const start = now();
        let lastFrame = 0;

        const tick = (ts) => {
          if (disposed) return;
          const t = ts || now();
          const elapsed = t - start;

          if (field) {
            const dt = lastFrame ? Math.min(50, t - lastFrame) : 16;
            lastFrame = t;
            field.frame(dt, clamp01((elapsed - FINALE_AT) / SEQ.finaleMs));
          }

          let next = -1;
          for (let i = STARTS.length - 1; i >= 0; i--) {
            if (elapsed >= STARTS[i]) {
              next = i;
              break;
            }
          }
          if (elapsed >= FINALE_AT) next = LAST_PHASE;
          if (next !== phaseRef.current) {
            phaseRef.current = next;
            setPhase(next);
            sayPhase(next);
          }

          if (counterRef.current) {
            const counter = (Math.floor(elapsed * 7.3) % 0xffff)
              .toString(16)
              .toUpperCase();
            counterRef.current.textContent = ('0000' + counter).slice(-4);
          }
          if (progressRef.current) {
            progressRef.current.style.transform =
              'scaleX(' + clamp01(elapsed / TOTAL_MS).toFixed(4) + ')';
          }

          if (elapsed >= TOTAL_MS) {
            end();
            return;
          }
          raf = window.requestAnimationFrame(tick);
        };

        const onSkip = () => {
          end();
        };

        if (SEQ.skipOnInput) {
          window.addEventListener('pointerdown', onSkip, true);
          window.addEventListener('keydown', onSkip, true);
        }
        raf = window.requestAnimationFrame(tick);

        return () => {
          disposed = true;
          if (raf) window.cancelAnimationFrame(raf);
          timers.forEach((id) => clearTimeout(id));
          timers.clear();
          window.removeEventListener('resize', field ? field.resize : () => {});
          window.removeEventListener('pointerdown', onSkip, true);
          window.removeEventListener('keydown', onSkip, true);
          silence();
        };
      }, []);

      if (gone) return null;

      const step = phase >= 0 && phase < SEQ.steps.length ? SEQ.steps[phase] : null;
      const seen = SEQ.steps.slice(0, Math.max(0, Math.min(phase + 1, SEQ.steps.length)));

      return h(
        'div',
        {
          className: 'dshop-root' + (leaving ? ' is-leaving' : ''),
          style: {
            '--dshop-stage': SEQ.palette.stage,
            '--dshop-ink': SEQ.palette.ink,
            '--dshop-dim': SEQ.palette.dim,
            '--dshop-rule': SEQ.palette.rule,
            '--dshop-accent': SEQ.palette.accent,
            '--dshop-fade': SEQ.fadeOutMs / 1000 + 's',
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
          phase >= LAST_PHASE
            ? h(
                'div',
                { className: 'dshop-finale', key: 'finale' },
                h('div', { className: 'f-ru' }, SEQ.finale[0].text),
                h('div', { className: 'f-zh' }, SEQ.finale[1].text),
                h('div', { className: 'f-en' }, SEQ.finale[2].text),
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
        h(
          'div',
          { key: 'bar', className: 'dshop-progress' },
          h('i', { ref: progressRef }),
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
