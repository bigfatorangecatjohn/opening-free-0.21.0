/**
 * @local/dsh-opening — Client half.
 *
 * Registers two slots: `settings.section` (the boot-language cards and the
 * four-language preview queues) and `shell.overlay` (the frame-wide,
 * click-through boot cut).
 *
 * The cut is drawn on one canvas and paced by the timeline of the audio the
 * build actually carries: a data wave sweeps in, bursts into the dots that
 * assemble the whale, the mark freezes into ink inside holographic rings, and
 * the salute rises over a breathing tick bar with a percentage counter. The
 * full sequence adds the five access steps between the rings and the salute;
 * the short cut is the same three beats in 3.8–4.5 seconds.
 *
 * The voice is a pre-rendered track. `tools\build-client.mjs` inlines it as a
 * data URI at the top of the generated client.js together with the matching
 * timeline, phases and mark, so the browser needs no host route and the
 * visuals always follow the audio the file actually carries.
 */
window.__ModuleLoader__.load({
  id: 'dsh-opening-free',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    /* Only the preview needs a portal (the boot cut lives in shell.overlay).
     * The host always ships react-dom, but a missing one must not take the
     * whole plugin down: the preview then falls back to the overlay layer. */
    let ReactDOM = null;
    try {
      ReactDOM = require('react-dom');
    } catch (error) {
      ReactDOM = null;
    }
    const { useState, useEffect, useRef } = React;

    const NS = 'dsh-opening';

    /** Text projected where the slot owner draws a label. */
    const DICT = {
      zh: { word: '开机序列', title: '开机动画' },
      en: { word: 'BOOT SEQUENCE', title: 'Opening Sequence' },
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
    /* The mask, the baked layers and the sample points are identical for every
     * instance; the four-cut preview would otherwise re-cut the same PNG four
     * times and hitch at the start of each cut. */
    let WHALE_CUT = null;
    const SET =
      Array.isArray(window.__DSH_OPENING_SET__) && window.__DSH_OPENING_SET__.length
        ? window.__DSH_OPENING_SET__
        : [{ lang: 'zh', track: '', cue: FALLBACK_CUE }];

    const LANG_KEY = 'dsh-opening:lang';
    // A demo build pins one language; normal builds leave the operator's pick alone.
    const FORCED = String(window.__DSH_OPENING_FORCE_LANG__ || '');
    const LANGS = ['zh', 'en', 'ru', 'ja', 'zh-short', 'en-short', 'ru-short', 'ja-short'];

    /** The language picked in Settings, or Chinese when nothing is stored. */
    function readLang() {
      if (LANGS.indexOf(FORCED) >= 0) return FORCED;
      try {
        const stored = window.localStorage.getItem(LANG_KEY);
        return LANGS.indexOf(stored) >= 0 ? stored : 'zh';
      } catch (error) {
        return 'zh';
      }
    }

    function writeLang(next) {
      try {
        window.localStorage.setItem(LANG_KEY, next);
      } catch (error) {
        /* private mode: the choice lasts for this page only */
      }
    }

    /** The track that matches the chosen mode, falling back to Chinese. */
    function pickSet() {
      const wanted = readLang();
      for (let i = 0; i < SET.length; i++) {
        if (SET[i].key === wanted) return SET[i];
      }
      for (let i = 0; i < SET.length; i++) {
        if (SET[i].cue && SET[i].cue.lang === wanted) return SET[i];
      }
      return SET[0];
    }

    /**
     * Tracking is language-specific. The Chinese address is five glyphs and
     * can afford the wide ticker spacing; Cyrillic "ДОБРО ПОЖАЛОВАТЬ," is
     * eighteen and would scatter to half the frame, and the eleven kana of
     * 「おかえりなさいませ、」 would outrun the four-character name beneath them.
     * These are the settled (fully arrived) values; the tick opens them wider
     * and closes to this.
     */
    const LANG_TRACK = {
      lead: { zh: 0.42, ja: 0.34, ru: 0.24, en: 0.24 },
      name: { zh: 0.26, ja: 0.26, ru: 0.16, en: 0.16 },
    };

    /**
     * The short cut carries its own map (`phases`) from the audio master:
     * sweep -> burst -> whale -> rings -> salute/name. Nothing in the short
     * cut reads `mark`; that field belongs to the full sequence alone.
     */
    function phaseOf(cue) {
      const raw = cue.phases;
      const salute = Array.isArray(cue.salute) ? cue.salute[0] : cue.salute;
      const saluteAt = salute && typeof salute.at === 'number' ? salute.at : 1.4;
      /* The name is spoken at the end of the salute line, not somewhere in the
       * tail after it: 72% into the recorded phrase is where the address
       * starts. Falling back to the track total pushed the name past the voice. */
      const saluteEnd = salute && typeof salute.end === 'number' ? salute.end : cue.total || 3.4;
      const nameAt = saluteAt + (saluteEnd - saluteAt) * 0.72;
      /* burstPower lets the long sequence keep the same three beats with a
       * quieter unlock: its audio has no impact, only a chime to land on. */
      const power = raw && typeof raw.burstPower === 'number' ? raw.burstPower : 1;
      if (raw && raw.sweep && raw.whale && typeof raw.burst === 'number') {
        return {
          sweep: raw.sweep,
          burst: raw.burst,
          whale: raw.whale,
          rings: typeof raw.rings === 'number' ? raw.rings : raw.sweep[1] + 0.47,
          salute: typeof raw.salute === 'number' ? raw.salute : saluteAt,
          name: typeof raw.name === 'number' ? raw.name : nameAt,
          burstPower: power,
        };
      }
      return {
        sweep: [0, 0.55],
        burst: 0.55,
        whale: [0.6, 1.55],
        rings: 1.02,
        salute: saluteAt,
        name: nameAt,
        burstPower: power,
      };
    }

    /** A step caption ships in four languages; fall back to the closest pair. */
    function stepTextOf(step, lang) {
      const text = step && step.text;
      if (!text) return '';
      return text[lang] || text.en || text.zh || '';
    }

    /** The salute arrives as two lines; older cues carry one. */
    function linesOf(salute) {
      return salute && Array.isArray(salute.lines) && salute.lines.length === 2
        ? salute.lines
        : [salute && salute.text ? salute.text : '', ''];
    }

    /**
     * One mode is everything the short cut needs to play a single master: its
     * cue, its track, its language, its beats, its tracking. Bundled so the
     * preview queue can hand one language after another to the same component.
     */
    function modeOf(entry) {
      /* Accept either a set entry or its key: the overlay hands over keys. */
      let picked = entry;
      if (typeof picked === 'string') {
        picked = null;
        for (let i = 0; i < SET.length; i++) {
          if (SET[i].key === entry) {
            picked = SET[i];
            break;
          }
        }
      }
      const cue = (picked && picked.cue) || FALLBACK_CUE;
      const lang = cue.lang || (picked && picked.lang) || 'zh';
      const salute = Array.isArray(cue.salute) ? cue.salute[0] : cue.salute;
      return {
        key: (picked && picked.key) || lang,
        cue: cue,
        track: (picked && picked.track) || '',
        lang: lang,
        short: cue.short === true,
        salute: salute,
        lines: linesOf(salute),
        phase: phaseOf(cue),
        leadTrack: LANG_TRACK.lead[lang] !== undefined ? LANG_TRACK.lead[lang] : 0.42,
        nameTrack: LANG_TRACK.name[lang] !== undefined ? LANG_TRACK.name[lang] : 0.26,
      };
    }

    const ACTIVE = pickSet();
    const MODE = modeOf(ACTIVE);
    const CUE = MODE.cue;
    const TRACK = MODE.track;
    const LANG = MODE.lang;
    const SHORT = MODE.short;
    const STEPS = Array.isArray(CUE.steps) ? CUE.steps : [];
    const SUBTITLE = LANG === 'zh' ? 'en' : LANG === 'en' ? 'zh' : 'en';
    const SALUTE = MODE.salute;
    const LEAD_IN = CUE.leadIn || (STEPS[0] ? STEPS[0].at : 1.45);
    const LAST_STEP = STEPS.length - 1;
    const BADGE_BASE = { zh: '中文', en: 'EN', ru: 'RU', ja: '日本語' }[LANG] || 'EN';
    const BADGE = SHORT ? BADGE_BASE + ' · 简' : BADGE_BASE;

    const PHASE = MODE.phase;

    /** How many strokes the short cut draws along the bottom edge. */
    const BAR_COUNT = 44;

    /** Settled tracking of the active mode; see LANG_TRACK for the per-language map. */
    const LEAD_TRACK = MODE.leadTrack;
    const NAME_TRACK = MODE.nameTrack;

    /**
     * The salute arrives as two lines: the address (welcome back) and the rank
     * that lands last. Cues without lines fall back to the one-line salute.
     */
    const SALUTE_LINES = MODE.lines;

    /** Terminal furniture, one string per track language. */
    const PROTOCOL = {
      zh: '访问协议 · 第五级',
      en: 'Access Protocol · Level V',
      ru: 'Протокол Доступа · Уровень V',
      ja: 'アクセス・プロトコル · 第五級',
    };
    const CAPTION = {
      zh: '身份已确认 · 准入授予',
      en: 'Identity Confirmed · Access Granted',
      ru: 'Личность Подтверждена · Доступ Разрешён',
      ja: '身分確認済み · アクセス許可',
    };

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
      accent: '#4d6bfe',
      accentLit: '#a8bcff',
      glow: '77, 107, 254',
      particle: '134, 158, 255',
      link: '77, 107, 254',
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
      if (t < SALUTE.at) {
        if (!STEPS.length) return { phase: -1, salute: false };
        if (t < STEPS[0].at) return { phase: -1, salute: false };
        let phase = 0;
        for (let i = 0; i < STEPS.length; i++) {
          if (t >= STEPS[i].at) phase = i;
        }
        return { phase, salute: false };
      }
      return { phase: STEPS.length, salute: true };
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
            ctx.strokeStyle = 'rgba(' + PALETTE.link + ', ' + alpha.toFixed(3) + ')';
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

/* Preview layer: portalled to <body> so a cut started from Settings plays
 * above the dialog instead of behind it. */
.dshop-preview {
  position: fixed;
  inset: 0;
  z-index: 2147483400;
  pointer-events: auto;
}

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
.dshop-ring.a { filter: drop-shadow(0 0 6px rgba(77, 107, 254, 0.22)); }
.dshop-ring.d { animation: dshop-spin-rev 88s linear infinite; }
.dshop-ring.d circle { stroke: rgba(11, 13, 16, 0.2); stroke-width: 0.9; stroke-dasharray: 1 5.4; }
.dshop-ring.a { animation: dshop-spin 30s linear infinite; }
.dshop-ring.a circle { stroke: url(#dshop-blue); stroke-width: 1.2; stroke-dasharray: 300 190; }
.dshop-ring.b { animation: dshop-spin-rev 19s linear infinite; }
.dshop-ring.b circle { stroke: rgba(11, 13, 16, 0.34); stroke-width: 1.7; stroke-dasharray: 150 233; }
.dshop-ring.c { animation: dshop-spin 55s linear infinite; }
.dshop-ring.c circle { stroke: rgba(11, 13, 16, 0.16); stroke-width: 1; stroke-dasharray: 3 27; }

.dshop-rings {
  animation:
    dshop-soft-in 1.2s cubic-bezier(0.2, 0.72, 0.2, 1) 0.04s both,
    dshop-breathe 5.2s ease-in-out 1.2s infinite;
}

/* A soft blue field under the dial: rises with the dial, then lets go. */
.dshop-halo {
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(78vmin, 760px);
  height: min(78vmin, 760px);
  border-radius: 50%;
  pointer-events: none;
  background: radial-gradient(
    circle,
    rgba(77, 107, 254, 0.16) 0%,
    rgba(77, 107, 254, 0.055) 44%,
    rgba(77, 107, 254, 0) 72%
  );
  animation: dshop-halo 5.2s ease-in-out 1.2s infinite;
}

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
  border: 1px solid rgba(77, 107, 254, 0.32);
  border-radius: 2px;
  padding: 1px 5px;
  letter-spacing: 0.14em;
  color: var(--dshop-accent);
  text-shadow: 0 0 9px rgba(77, 107, 254, 0.35);
}

.dshop-counter {
  color: var(--dshop-accent);
  letter-spacing: 0.24em;
  text-shadow: 0 0 10px rgba(77, 107, 254, 0.45);
  animation: dshop-counter 5.2s ease-in-out 1.2s infinite;
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
.dshop-root.is-ja .dshop-zh { font-size: clamp(19px, 2.55vw, 34px); letter-spacing: 0.07em; }

.dshop-zh {
  text-wrap: balance;
  /* tracking leaves a gap after the last glyph; pad the other side to recentre */
  padding-left: 0.16em;
  max-width: 62vmin;
  font-size: clamp(22px, 3.1vw, 40px);
  font-weight: 500;
  letter-spacing: 0.16em;
  line-height: 1.25;
  animation: dshop-rise 0.42s cubic-bezier(0.2, 0.72, 0.2, 1) both;
}

.dshop-root.is-en .dshop-zh {
  font-size: clamp(16px, 1.95vw, 26px);
  letter-spacing: 0.18em;
  font-weight: 600;
  padding-left: 0.18em;
}

.dshop-en {
  padding-left: 0.26em;
  margin-top: 15px;
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: clamp(9.5px, 0.98vw, 12px);
  letter-spacing: 0.26em;
  color: var(--dshop-dim);
  animation: dshop-rise 0.42s cubic-bezier(0.2, 0.72, 0.2, 1) 0.05s both;
}
.dshop-en::before { content: '[ '; opacity: 0.55; }
.dshop-en::after { content: ' ]'; opacity: 0.55; }

.dshop-caret {
  display: inline-block;
  width: 0.5em;
  height: 0.92em;
  margin-left: 0.34em;
  vertical-align: -0.08em;
  background: linear-gradient(to bottom, var(--dshop-accentLit), var(--dshop-accent));
  box-shadow: 0 0 11px rgba(77, 107, 254, 0.55);
  animation: dshop-blink 1.05s steps(1, end) infinite;
}

.dshop-salute {
  animation: dshop-rise 0.66s cubic-bezier(0.2, 0.72, 0.2, 1) both;
  text-align: center;
}
.dshop-salute-lead {
  padding-left: 0.42em;
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: clamp(12px, 1.35vw, 16px);
  letter-spacing: 0.42em;
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
  padding-left: 0.2em;
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
  padding-left: 0.12em;
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
  background: linear-gradient(to right, rgba(77, 107, 254, 0.2), var(--dshop-accent));
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
  background: var(--dshop-accentLit);
  box-shadow: 0 0 11px rgba(77, 107, 254, 0.8);
  will-change: left;
}

.dshop-hazard {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: repeating-linear-gradient(
    135deg,
    rgba(77, 107, 254, 0.6) 0 7px,
    transparent 7px 15px
  );
  opacity: 0.3;
  animation: dshop-soft-in 1s ease 0.1s both;
}

.dshop-scan {
  position: absolute;
  left: 0;
  right: 0;
  top: -200px;
  height: 200px;
  pointer-events: none;
  background: linear-gradient(
    to bottom,
    rgba(11, 13, 16, 0) 0%,
    rgba(77, 107, 254, 0.05) 58%,
    rgba(11, 13, 16, 0) 100%
  );
  animation: dshop-scan 7.6s linear 0.5s infinite;
}

.dshop-frame {
  position: absolute;
  inset: 72px;
  border: 1px solid rgba(11, 13, 16, 0.07);
  animation: dshop-soft-in 1.1s ease 0.1s both;
}
.dshop-frame::before,
.dshop-frame::after {
  content: '';
  position: absolute;
  width: 24px;
  height: 24px;
  border: 1.5px solid rgba(11, 13, 16, 0.5);
}
.dshop-frame::before { top: -1px; left: -1px; border-right: 0; border-bottom: 0; }
.dshop-frame::after { bottom: -1px; right: -1px; border-left: 0; border-top: 0; }

.dshop-protocol {
  margin-bottom: 20px;
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: 9.5px;
  letter-spacing: 0.42em;
  color: var(--dshop-accent);
  opacity: 0.66;
  animation: dshop-rise 0.5s cubic-bezier(0.2, 0.72, 0.2, 1) 0.12s both;
}

.dshop-salute-cap {
  margin-bottom: 14px;
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: 9.5px;
  letter-spacing: 0.44em;
  color: var(--dshop-accent);
  opacity: 0.9;
  text-shadow: 0 0 12px rgba(77, 107, 254, 0.45);
}

@keyframes dshop-breathe {
  0%, 100% { filter: drop-shadow(0 0 2px rgba(77, 107, 254, 0.14)); }
  50% { filter: drop-shadow(0 0 17px rgba(77, 107, 254, 0.6)); }
}

@keyframes dshop-halo {
  0%, 100% { opacity: 0.4; transform: translate(-50%, -50%) scale(0.97); }
  50% { opacity: 1; transform: translate(-50%, -50%) scale(1.04); }
}

@keyframes dshop-counter {
  0%, 100% { opacity: 0.72; }
  50% { opacity: 1; }
}

@keyframes dshop-scan {
  from { transform: translateY(0); }
  to { transform: translateY(calc(100vh + 400px)); }
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

/* ---- short cut: stream, whale, rings, salute ------------------------- */

.dshop-cyber-center {
  position: absolute;
  left: 50%;
  top: 0;
  transform: translate(-50%, 0);
  text-align: center;
  pointer-events: none;
  will-change: transform;
}

.dshop-cyber-lead {
  padding-left: 0.62em;
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: clamp(15.75px, 1.86vmin, 22.5px);
  letter-spacing: 0.62em;
  color: var(--dshop-dim);
  opacity: 0;
  text-shadow: 0 0 14px rgba(77, 107, 254, 0.42);
  will-change: opacity, letter-spacing;
}

.dshop-cyber-namewrap {
  opacity: 0;
  will-change: opacity;
}

.dshop-cyber-rule {
  width: 0;
  height: 1px;
  margin: 12px auto 0;
  opacity: 0;
  background: linear-gradient(
    to right,
    rgba(77, 107, 254, 0) 0%,
    rgba(77, 107, 254, 0.92) 50%,
    rgba(77, 107, 254, 0) 100%
  );
  box-shadow: 0 0 14px rgba(77, 107, 254, 0.6);
}

.dshop-cyber-name {
  margin-top: 11px;
  padding-left: 0.26em;
  font-size: clamp(37.5px, 6.9vmin, 87px);
  font-weight: 600;
  line-height: 1.16;
  letter-spacing: 0.26em;
  color: var(--dshop-ink);
  will-change: opacity, transform, letter-spacing, text-shadow;
}

.dshop-root.is-ru .dshop-cyber-name,
.dshop-root.is-en .dshop-cyber-name {
  padding-left: 0.16em;
  font-size: clamp(31.5px, 5.85vmin, 69px);
  letter-spacing: 0.16em;
}

/* Eighteen Cyrillic glyphs at the Chinese lead size would run wider than the
   name under them, so the Latin and Cyrillic addresses get a smaller face. */
.dshop-root.is-ru .dshop-cyber-lead,
.dshop-root.is-en .dshop-cyber-lead {
  padding-left: 0.24em;
  font-size: clamp(12.75px, 1.5vmin, 18px);
}

/* Eleven kana instead of five: same idea, one step milder. */
.dshop-root.is-ja .dshop-cyber-lead {
  padding-left: 0.34em;
  font-size: clamp(13.5px, 1.64vmin, 19.5px);
}

/* The Chinese and Japanese addresses sit closest to the ring: their block is
   tall enough to be clamped upward by the progress bar. Tighten the stack so
   the lead clears the circle and the two lines read as one salute, not two. */
.dshop-root.is-zh .dshop-cyber-lead,
.dshop-root.is-ja .dshop-cyber-lead {
  line-height: 1.12;
}

.dshop-root.is-zh .dshop-cyber-rule,
.dshop-root.is-ja .dshop-cyber-rule {
  margin-top: 4px;
}

.dshop-root.is-zh .dshop-cyber-name,
.dshop-root.is-ja .dshop-cyber-name {
  margin-top: 4px;
  line-height: 1.04;
}

.dshop-cyber-bar {
  position: absolute;
  left: 50%;
  bottom: 34px;
  transform: translateX(-50%);
  display: flex;
  align-items: flex-end;
  gap: 16px;
  pointer-events: none;
}

.dshop-cyber-bars {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 17px;
}

.dshop-cyber-tick {
  width: 2px;
  height: 100%;
  border-radius: 1px;
  background: var(--dshop-accent);
  opacity: 0.12;
  box-shadow: 0 0 7px rgba(77, 107, 254, 0.7);
  will-change: opacity;
}

.dshop-cyber-pct {
  min-width: 3.6em;
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.16em;
  color: var(--dshop-accent);
  text-shadow: 0 0 11px rgba(77, 107, 254, 0.55);
}

/* The long sequence narrates five access steps. The plate is five rows tall
   but every row dissolves into the same spot -- the middle one -- so the
   words land in place instead of walking down the screen. */
.dshop-cyber-steps {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: calc(6em + 48px);
  font-size: clamp(15px, 2.05vmin, 28px);
  pointer-events: none;
  transform: translateY(0);
  will-change: transform;
}

.dshop-cyber-step {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: inherit;
  letter-spacing: 0.12em;
  color: var(--dshop-dim);
  text-shadow: 0 0 18px rgba(77, 107, 254, 0.16);
  white-space: nowrap;
  will-change: opacity, transform;
}

@media (max-width: 900px) {
  .dshop-cyber-steps {
    font-size: clamp(14px, 3.1vmin, 22px);
    height: calc(6em + 40px);
  }
  .dshop-cyber-step { letter-spacing: 0.08em; }
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
        h(
          'defs',
          { key: 'defs' },
          h(
            'linearGradient',
            { id: 'dshop-blue', x1: '0', y1: '0', x2: '1', y2: '1' },
            h('stop', { offset: '0%', stopColor: '#4d6bfe' }),
            h('stop', { offset: '46%', stopColor: '#a8bcff' }),
            h('stop', { offset: '100%', stopColor: '#4d6bfe' }),
          ),
        ),
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

      const step = phase >= 0 && phase <= LAST_STEP ? STEPS[phase] : null;
      const seen = STEPS.slice(0, Math.max(0, Math.min(phase + 1, STEPS.length)));
      const leadIn = phase === -1;

      return h(
        'div',
        {
          className:
            'dshop-root' +
            (leaving ? ' is-leaving' : '') +
            (LANG === 'ru' ? ' is-ru' : '') +
            (LANG === 'en' ? ' is-en' : '') +
            (LANG === 'ja' ? ' is-ja' : ''),
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
        h('div', { key: 'halo', className: 'dshop-halo' }),
        h(Rings, { key: 'rings' }),
        h('div', { key: 'grid', className: 'dshop-grid' }),
        h('div', { key: 'grain', className: 'dshop-grain' }),
        h('div', { key: 'vignette', className: 'dshop-vignette' }),
        h('div', { key: 'scan', className: 'dshop-scan' }),
        h('div', { key: 'frame', className: 'dshop-frame' }),
        h('div', { key: 'hazard', className: 'dshop-hazard' }),
        h('div', { key: 'tl', className: 'dshop-tick tl' }),
        h('div', { key: 'tr', className: 'dshop-tick tr' }),
        h('div', { key: 'bl', className: 'dshop-tick bl' }),
        h('div', { key: 'br', className: 'dshop-tick br' }),
        h(
          'div',
          { key: 'top', className: 'dshop-topbar' },
          h('span', null, 'DEEPSEEK HARNESS'),
          h('span', { className: 'dshop-lang' }, BADGE),
          h('span', { ref: counterRef, className: 'dshop-counter' }, '0000'),
          h('span', null, 'ACCESS CONTROL'),
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
                      h('div', { key: 'cap', className: 'dshop-salute-cap' }, CAPTION[LANG] || CAPTION.en),
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
                  h('div', { className: 'dshop-protocol' }, PROTOCOL[LANG] || PROTOCOL.en),
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

    /* ---- the short cut -------------------------------------------------- */

    function clampUnit(value) {
      return value < 0 ? 0 : value > 1 ? 1 : value;
    }

    function ramp(edge0, edge1, value) {
      const k = clampUnit((value - edge0) / (edge1 - edge0));
      return k * k * (3 - 2 * k);
    }

    function mix(a, b, k) {
      return a + (b - a) * k;
    }

    /**
     * The shipped whale is a dark whale on a pale rounded tile, not a cut-out.
     * Lift the whale out of the tile: threshold by luminance, keep its alpha,
     * then bake the layers the short cut draws -- ink body, silver rim, steel
     * shadow rim, halo, scan blade -- and sample the silhouette so the
     * particles have somewhere to converge to.
     */
    function prepareWhale(url) {
      if (WHALE_CUT) return WHALE_CUT;
      const state = { ready: false, ink: null, rim: null, rimB: null, glow: null, blade: null, box: null, points: [] };
      WHALE_CUT = state;
      if (!url) return state;
      const img = new Image();
      img.onload = () => {
        try {
          const size = 1024;
          const work = document.createElement('canvas');
          work.width = size;
          work.height = size;
          const wctx = work.getContext('2d');
          wctx.drawImage(img, 0, 0, size, size);
          const pixels = wctx.getImageData(0, 0, size, size).data;

          const mask = document.createElement('canvas');
          mask.width = size;
          mask.height = size;
          const mctx = mask.getContext('2d');
          const masked = mctx.createImageData(size, size);
          let minX = size;
          let minY = size;
          let maxX = 0;
          let maxY = 0;
          for (let i = 0; i < pixels.length; i += 4) {
            const lum = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
            const on = pixels[i + 3] > 128 && lum < 150;
            masked.data[i] = 255;
            masked.data[i + 1] = 255;
            masked.data[i + 2] = 255;
            masked.data[i + 3] = on ? 255 : 0;
            if (!on) continue;
            const at = i / 4;
            const x = at % size;
            const y = (at - x) / size;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
          mctx.putImageData(masked, 0, 0);

          const box = {
            x: minX,
            y: minY,
            w: Math.max(1, maxX - minX),
            h: Math.max(1, maxY - minY),
          };
          box.cx = minX + box.w / 2;
          box.cy = minY + box.h / 2;

          // What the whale freezes into: the DeepSeek mark in ink, not in blue.
          // Black stays black -- the cyberpunk is in the surface: a cold blue
          // nebula off the head, a violet one off the tail, CRT scanlines and a
          // hard highlight along the top edge, all clipped to the silhouette.
          const ink = document.createElement('canvas');
          ink.width = size;
          ink.height = size;
          const ictx = ink.getContext('2d');
          const inkGrad = ictx.createLinearGradient(0, minY, 0, maxY);
          inkGrad.addColorStop(0, '#141922');
          inkGrad.addColorStop(0.55, '#090c12');
          inkGrad.addColorStop(1, '#030508');
          ictx.fillStyle = inkGrad;
          ictx.fillRect(0, 0, size, size);

          const headGlow = ictx.createRadialGradient(
            minX + box.w * 0.30, minY + box.h * 0.26, 0,
            minX + box.w * 0.30, minY + box.h * 0.26, box.w * 0.56,
          );
          headGlow.addColorStop(0, 'rgba(52, 96, 255, 0.50)');
          headGlow.addColorStop(0.45, 'rgba(40, 78, 224, 0.18)');
          headGlow.addColorStop(1, 'rgba(40, 78, 224, 0)');
          ictx.fillStyle = headGlow;
          ictx.fillRect(0, 0, size, size);

          const tailGlow = ictx.createRadialGradient(
            minX + box.w * 0.74, minY + box.h * 0.74, 0,
            minX + box.w * 0.74, minY + box.h * 0.74, box.w * 0.52,
          );
          tailGlow.addColorStop(0, 'rgba(132, 48, 232, 0.40)');
          tailGlow.addColorStop(0.5, 'rgba(112, 40, 210, 0.14)');
          tailGlow.addColorStop(1, 'rgba(112, 40, 210, 0)');
          ictx.fillStyle = tailGlow;
          ictx.fillRect(0, 0, size, size);

          ictx.fillStyle = 'rgba(118, 226, 255, 0.075)';
          for (let line = minY; line < maxY; line += 4) {
            ictx.fillRect(0, line, size, 1);
          }

          const topSheen = ictx.createLinearGradient(0, minY, 0, minY + box.h * 0.30);
          topSheen.addColorStop(0, 'rgba(178, 232, 255, 0.20)');
          topSheen.addColorStop(1, 'rgba(178, 232, 255, 0)');
          ictx.fillStyle = topSheen;
          ictx.fillRect(0, minY, size, box.h * 0.30);

          ictx.globalCompositeOperation = 'destination-in';
          ictx.drawImage(mask, 0, 0);
          ictx.globalCompositeOperation = 'source-over';

          // Neon edge: the silhouette, eroded by about 1.8%, leaves a band that
          // traces both the outline and the cut-outs (belly, eye, mouth).
          const rimSize = 512;
          const rimScale = rimSize / size;
          function buildRim(top, mid, bottom) {
            const out = document.createElement('canvas');
            out.width = rimSize;
            out.height = rimSize;
            const actx = out.getContext('2d');
            actx.drawImage(mask, 0, 0, rimSize, rimSize);
            actx.globalCompositeOperation = 'destination-out';
            actx.translate(rimSize / 2, rimSize / 2);
            actx.scale(0.982, 0.982);
            actx.translate(-rimSize / 2, -rimSize / 2);
            actx.drawImage(mask, 0, 0, rimSize, rimSize);
            actx.setTransform(1, 0, 0, 1, 0, 0);
            actx.globalCompositeOperation = 'source-in';
            const grad = actx.createLinearGradient(0, minY * rimScale, 0, maxY * rimScale);
            grad.addColorStop(0, top);
            grad.addColorStop(0.52, mid);
            grad.addColorStop(1, bottom);
            actx.fillStyle = grad;
            actx.fillRect(0, 0, rimSize, rimSize);
            return out;
          }
          /* Deep enough to read against the pale stage: the halo carries the
           * light, the rim carries the colour. A near-white cyan rim would
           * vanish on paper. */
          /* Semi-transparent metallic silver: a bright face and a steel
           * shadow face, so the edge reads as polished metal rather than a
           * neon tube. Both are laid over the black body at partial alpha. */
          const rim = buildRim('#ffffff', '#c9d3e2', '#8b97ab');
          const rimB = buildRim('#e6edf8', '#8b98ac', '#5f6a7c');

          // Halo: the mask smeared out by repeated small offsets, then tinted.
          const haloSize = 160;
          const haloScale = haloSize / size;
          const glow = document.createElement('canvas');
          glow.width = haloSize;
          glow.height = haloSize;
          const gctx = glow.getContext('2d');
          gctx.globalAlpha = 0.075;
          for (let gy = -3; gy <= 3; gy++) {
            for (let gx = -3; gx <= 3; gx++) {
              if (!gx && !gy) continue;
              gctx.drawImage(
                mask, gx * 2.7, gy * 2.7, haloSize, haloSize,
              );
            }
          }
          gctx.globalAlpha = 1;
          gctx.globalCompositeOperation = 'source-in';
          const haloGrad = gctx.createLinearGradient(0, minY * haloScale, 0, maxY * haloScale);
          /* Top and bottom are deliberately not near-white: a vertical
           * white-to-steel-to-white ramp left the north and south edges of
           * the halo almost invisible, which read as a flat cut-out. */
          haloGrad.addColorStop(0, '#cdd9e9');
          haloGrad.addColorStop(0.5, '#8fa1ba');
          haloGrad.addColorStop(1, '#d8e2f1');
          gctx.fillStyle = haloGrad;
          gctx.fillRect(0, 0, haloSize, haloSize);

          /* The scan blade that rides down the mark as it lands, in the same
           * metal as the rim. */
          const blade = document.createElement('canvas');
          blade.width = size;
          blade.height = size;
          const blctx = blade.getContext('2d');
          const bladeGrad = blctx.createLinearGradient(0, minY, 0, maxY);
          bladeGrad.addColorStop(0, '#ffffff');
          bladeGrad.addColorStop(0.5, '#dde6f3');
          bladeGrad.addColorStop(1, '#a9b6c9');
          blctx.fillStyle = bladeGrad;
          blctx.fillRect(0, 0, size, size);
          blctx.globalCompositeOperation = 'destination-in';
          blctx.drawImage(mask, 0, 0);

          const sample = [];
          // 6 px on a 1024 tile: about 1800 dots, which is dense enough to read
          // as a scanned orca at 440 px wide and still cheap to animate.
          const step = 6;
          for (let y = minY; y < maxY; y += step) {
            for (let x = minX; x < maxX; x += step) {
              const at = ((y | 0) * size + (x | 0)) * 4 + 3;
              if (masked.data[at] < 128) continue;
              sample.push({ x: (x - box.cx) / box.w, y: (y - box.cy) / box.w });
            }
          }

          const keep = 1800;
          let points = sample;
          if (sample.length > keep) {
            const stride = sample.length / keep;
            points = [];
            for (let i = 0; i < keep; i++) points.push(sample[Math.floor(i * stride)]);
          }
          for (let i = 0; i < points.length; i++) {
            const p = points[i];
            const angle = Math.random() * 6.2831853;
            const reach = 0.12 + Math.random() * 0.55;
            p.sx = Math.cos(angle) * reach;
            p.sy = Math.sin(angle) * reach * 0.8;
            p.r = 0.5 + Math.random() * 1.5;
            p.sw = (Math.random() - 0.5) * 1.6;
            p.delay = Math.random();
            p.tone = Math.random();
            // Static per point: the swim stroke weights the tail, and mixing it
            // at sample time keeps a pow() out of the per-frame dot loop.
            p.tailK = Math.pow(clampUnit(p.x + 0.5), 1.7);
          }

          state.points = points;
          state.ink = ink;
          state.rim = rim;
          state.rimB = rimB;
          state.glow = glow;
          state.blade = blade;
          state.box = box;
          state.ready = true;
        } catch (error) {
          /* no 2d context: the cut runs without the whale */
        }
      };
      img.src = url;
      return state;
    }

    /** One canvas for the whole short cut: stream, burst, whale, rings. */
    function makeCyberScene(canvas, phase) {
      // Kept transparent: the stage carries a soft white radial glow under the
      // canvas, and an opaque surface would have to repaint it every frame.
      const ctx = canvas.getContext('2d');
      const whale = prepareWhale(MARK);
      const dust = [];
      let w = 0;
      let h = 0;
      let unit = 0;

      /* ---- batched dots -------------------------------------------------
       * Every particle used to be its own beginPath / arc / fill: ~900 fills
       * a frame for the water, ~1800 for the whale, ~300 for the rings. Three
       * thousand canvas state flushes per frame is where the stutter came
       * from. Instead each pass drops its points into this shared buffer and
       * they come out as one path per (colour, alpha bucket) pair -- around
       * fifty fills a frame instead of three thousand.
       *
       * Dots stay circles of the exact same radius as before; only their alpha
       * is quantised, and 24 buckets means the worst error is ±0.02, well
       * under a display step. Buckets are filled by counting sort in two O(n)
       * passes, so the bucket count costs nothing per dot. */
      const DOT_MAX = 2600;
      const DOT_BUCKETS = 24;
      const DOT_BINS = 64;
      const dotX = new Float32Array(DOT_MAX);
      const dotY = new Float32Array(DOT_MAX);
      const dotR = new Float32Array(DOT_MAX);
      const dotA = new Float32Array(DOT_MAX);
      const dotC = new Uint8Array(DOT_MAX);
      const dotB = new Uint8Array(DOT_MAX);
      const dotOrder = new Int32Array(DOT_MAX);
      const binStart = new Int32Array(DOT_BINS + 1);
      const binCursor = new Int32Array(DOT_BINS + 1);
      let dotN = 0;

      function dotAdd(x, y, r, a, c) {
        if (a <= 0.012 || dotN >= DOT_MAX) return;
        dotX[dotN] = x;
        dotY[dotN] = y;
        dotR[dotN] = r;
        dotA[dotN] = a > 1 ? 1 : a;
        dotC[dotN] = c || 0;
        dotN += 1;
      }

      function dotPaint(colors, buckets) {
        const n = dotN;
        if (!n) return;
        const bins = Math.min(DOT_BINS, colors.length * buckets);
        for (let i = 0; i <= bins; i++) binStart[i] = 0;
        for (let i = 0; i < n; i++) {
          let b = (dotA[i] * buckets) | 0;
          if (b >= buckets) b = buckets - 1;
          const bin = dotC[i] * buckets + b;
          dotB[i] = bin;
          binStart[bin + 1] += 1;
        }
        for (let i = 0; i < bins; i++) binStart[i + 1] += binStart[i];
        for (let i = 0; i < bins; i++) binCursor[i] = binStart[i];
        for (let i = 0; i < n; i++) dotOrder[binCursor[dotB[i]]++] = i;

        for (let c = 0; c < colors.length; c++) {
          for (let b = 0; b < buckets; b++) {
            const bin = c * buckets + b;
            const from = binStart[bin];
            const to = binStart[bin + 1];
            if (from === to) continue;
            ctx.beginPath();
            for (let k = from; k < to; k++) {
              const i = dotOrder[k];
              ctx.moveTo(dotX[i] + dotR[i], dotY[i]);
              ctx.arc(dotX[i], dotY[i], dotR[i], 0, 6.2831853);
            }
            ctx.fillStyle = 'rgba(' + colors[c] + ', ' + ((b + 0.5) / buckets).toFixed(3) + ')';
            ctx.fill();
          }
        }
        dotN = 0;
      }

      function resize() {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        w = canvas.clientWidth || window.innerWidth;
        h = canvas.clientHeight || window.innerHeight;
        unit = Math.min(w, h);
        canvas.width = Math.max(1, Math.round(w * dpr));
        canvas.height = Math.max(1, Math.round(h * dpr));
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (!dust.length) {
          const count = Math.max(80, Math.min(210, Math.round((w * h) / 11000)));
          for (let i = 0; i < count; i++) {
            dust.push({
              x: Math.random(),
              y: Math.random(),
              r: 0.6 + Math.random() * 1.7,
              ph: Math.random() * 6.2831853,
              sp: 0.5 + Math.random() * 1.6,
              a: 0.18 + Math.random() * 0.34,
            });
          }
        }
      }

      /** One prepared layer of the mark, drawn at a given width, optionally spun. */
      function paintArt(art, x, y, widthPx, alpha, rot, ox, oy) {
        if (!whale.ready || !art || alpha <= 0.004) return;
        const scale = widthPx / whale.box.w;
        const dx = x - whale.box.cx * scale + (ox || 0);
        const dy = y - whale.box.cy * scale + (oy || 0);
        ctx.save();
        ctx.globalAlpha = Math.min(1, alpha);
        if (rot) {
          ctx.translate(x, y);
          ctx.rotate(rot);
          ctx.translate(-x, -y);
        }
        ctx.drawImage(art, dx, dy, 1024 * scale, 1024 * scale);
        ctx.restore();
      }

      /**
       * The mark in its final dress: black body, blue nebula and CRT scanlines
       * baked into it, a neon edge that splits into magenta while it lands, a
       * breathing halo, and -- during materialisation only -- a scan blade
       * riding down the silhouette plus a few torn slices.
       */
      function paintMark(x, y, widthPx, alpha, rot, tt, settled, pulse) {
        if (!whale.ready || alpha <= 0.004) return;
        const scale = widthPx / whale.box.w;
        const dx = x - whale.box.cx * scale;
        const dy = y - whale.box.cy * scale;
        const span = 1024 * scale;

        /* Two halo passes: a wide silver cloud that reads from across the
         * room, and a tight one that hugs the silhouette so the edge looks
         * lit rather than pasted. */
        paintArt(whale.glow, x, y, widthPx * 1.18, alpha * (0.29 + 0.22 * pulse));
        paintArt(whale.glow, x, y, widthPx * 1.05, alpha * (0.53 + 0.26 * pulse));
        paintArt(whale.ink, x, y, widthPx, alpha, rot);
        if (whale.rim) {
          const split = 0.6 + 2.4 * (1 - settled);
          paintArt(whale.rimB, x, y, widthPx, alpha * 0.39, rot, split, -split * 0.45);
          paintArt(whale.rim, x, y, widthPx, alpha * (0.65 + 0.20 * pulse), rot, -split * 0.55, split * 0.35);
        }

        /* The blade: one bright pass down the body as the ink bleeds in. */
        if (alpha > 0.02 && alpha < 0.995) {
          const blade = whale.box.y + whale.box.h * alpha - 10;
          ctx.save();
          ctx.globalAlpha = 0.5 * Math.sin(Math.PI * alpha);
          ctx.globalCompositeOperation = 'lighter';
          ctx.drawImage(whale.blade, 0, blade, 1024, 20, dx, dy + blade * scale, span, 20 * scale);
          ctx.restore();
        }

        /* Torn slices: strongest while landing, then an occasional stutter so
         * the mark never reads as a flat pasted bitmap. */
        const stutter = Math.max(0, Math.sin(tt * 2.3) - 0.94) * 6;
        const tear = (1 - settled) * 3.4 + stutter;
        if (tear > 0.05 && alpha > 0.08) {
          ctx.save();
          ctx.globalAlpha = Math.min(1, alpha);
          const bands = [[0.17, 0.05, 1], [0.45, 0.038, -1], [0.71, 0.046, 1]];
          for (let i = 0; i < bands.length; i++) {
            const sy = whale.box.y + whale.box.h * bands[i][0];
            const sh = whale.box.h * bands[i][1];
            const shift = Math.sin(tt * 7.7 + i * 2.3) * tear * bands[i][2];
            ctx.drawImage(whale.ink, 0, sy, 1024, sh, dx + shift, dy + sy * scale, span, sh * scale);
          }
          ctx.restore();
        }
      }

      /**
       * The data stream: one wave, made of grain.
       *
       * There used to be three staggered rollers. The ask was one layer, bigger
       * and slower, and far more detailed -- so this is a single breaking crest
       * spanning the screen, and everything that used to be a flat gradient is
       * now a field of particles riding the surface: body grain, a bright crest
       * file, and spray thrown off the lip. The ripples run at 1.15 / 1.85 /
       * 2.60 rad/s instead of 3.0 / 5.1 / 7.7, which is what makes the water
       * roll like water instead of flicker like a scanner.
       */
      /* The body and lip gradients only depend on where the wave sits and
       * how big the screen is, so they are built once per size instead of
       * every frame; the fade rides on globalAlpha instead. */
      let gradKey = '';
      let bodyGrad = null;
      let edgeGrad = null;
      function waveGrads(by) {
        const key = by + ':' + unit;
        if (key === gradKey && bodyGrad) return;
        gradKey = key;
        bodyGrad = ctx.createLinearGradient(0, by - unit * 0.2, 0, by + unit * 0.15);
        bodyGrad.addColorStop(0, 'rgba(30, 52, 205, 0.60)');
        bodyGrad.addColorStop(0.45, 'rgba(62, 90, 240, 0.48)');
        bodyGrad.addColorStop(1, 'rgba(124, 149, 255, 0.18)');
        edgeGrad = ctx.createLinearGradient(0, by - unit * 0.24, 0, by + unit * 0.18);
        edgeGrad.addColorStop(0, 'rgba(150, 178, 255, 0.90)');
        edgeGrad.addColorStop(0.55, 'rgba(28, 48, 200, 0.85)');
        edgeGrad.addColorStop(1, 'rgba(28, 48, 200, 0)');
      }

      function drawWave(head, alpha, t, by) {
        // One wave, not a stripe with a bump on the end. At 1.02 screen widths
        // the band was long enough that its flat tail read as a second, thin
        // water line crossing the whole frame while the crest sat at the head.
        // 0.72 keeps the trailing slope short enough to read as the back of the
        // same wave, and the amplitude now grows with the distance from the
        // tail instead of jumping up at the last third.
        const tail = head - 0.72 * w;
        const span = Math.max(1, head - tail);
        const reach = function (x) {
          return clampUnit((x - tail) / span);
        };
        const amp = function (x) {
          return unit * (0.005 + 0.158 * Math.pow(reach(x), 1.25));
        };
        const crest = function (x) {
          const k = reach(x);
          return (
            by -
            amp(x) +
            Math.sin(x * 0.0082 + t * 1.15) * unit * 0.024 * (0.3 + k) +
            Math.sin(x * 0.0181 - t * 1.85 + 0.8) * unit * 0.010 * (0.22 + k) +
            Math.sin(x * 0.0410 + t * 2.60 + 1.7) * unit * 0.0028
          );
        };
        const trough = function (x) {
          const k = reach(x);
          return (
            by +
            amp(x) * 0.55 +
            Math.sin(x * 0.0077 + t * 1.15 + 1.3) * unit * 0.019 * (0.3 + k) +
            Math.sin(x * 0.0197 - t * 1.95 + 2.1) * unit * 0.0072 * (0.22 + k)
          );
        };

        ctx.save();
        ctx.globalCompositeOperation = 'source-over';

        /* ---- the body: a soft blue mass the grain reads against --------- */
        const lipX = head + unit * 0.022;
        ctx.beginPath();
        ctx.moveTo(tail, by);
        for (let x = tail; x <= head; x += 6) ctx.lineTo(x, crest(x));
        ctx.quadraticCurveTo(lipX, crest(head) + unit * 0.035, lipX, by - amp(head) * 0.28);
        ctx.quadraticCurveTo(head + unit * 0.012, by + amp(head) * 0.34, head - unit * 0.04, by + unit * 0.03);
        for (let x = head - unit * 0.04; x >= tail; x -= 6) ctx.lineTo(x, trough(x));
        ctx.closePath();
        waveGrads(by);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = bodyGrad;
        ctx.fill();
        ctx.globalAlpha = 1;

        /* ---- body grain -------------------------------------------------- */
        const GRAIN = 620;
        for (let i = 0; i < GRAIN; i++) {
          const s1 = Math.sin(i * 12.9898) * 0.5 + 0.5;
          const s2 = Math.sin(i * 78.233 + 1.7) * 0.5 + 0.5;
          const s3 = Math.sin(i * 39.346 + 4.1) * 0.5 + 0.5;
          const k = 1 - Math.pow(1 - (i + 0.5) / GRAIN, 1.7);
          const px0 = tail + span * k + Math.sin(t * 0.9 + s2 * 6.2831853) * unit * 0.006 + (s3 - 0.5) * unit * 0.01;
          const v = Math.pow(s1, 1.35);
          const py =
            crest(px0) +
            (trough(px0) - crest(px0)) * v +
            Math.sin(t * 1.6 + s2 * 6.2831853 + px0 * 0.01) * unit * 0.004;
          const tw = 0.5 + 0.5 * Math.sin(t * 2.4 + s3 * 6.2831853);
          const a = alpha * (0.1 + 0.34 * (1 - v) * (0.35 + 0.65 * k)) * (0.55 + 0.45 * tw);
          const light = s1 > 0.66;
          dotAdd(px0, py, (0.5 + s2 * 1.6) * (0.6 + 0.5 * k), light ? a : a * 0.85, light ? 1 : 0);
        }
        dotPaint(['24, 44, 190', '198, 216, 255'], DOT_BUCKETS);

        /* ---- the crest file: bright grain along the breaking lip --------- */
        const FILED = 230;
        for (let i = 0; i < FILED; i++) {
          const s1 = Math.sin(i * 21.7 + 0.5) * 0.5 + 0.5;
          const s2 = Math.sin(i * 57.31 + 2.3) * 0.5 + 0.5;
          const k = 1 - Math.pow(1 - (i + 0.5) / FILED, 2.4);
          const px = tail + span * k + Math.sin(t * 1.4 + s2 * 6.2831853) * unit * 0.004;
          const py = crest(px) + (s1 - 0.5) * unit * 0.02 * (0.35 + k);
          const tw = 0.45 + 0.55 * Math.sin(t * 3.1 + s1 * 6.2831853);
          const a = alpha * (0.16 + 0.62 * k) * tw;
          dotAdd(px, py, 0.6 + s2 * 2.1 * (0.35 + k), a, 0);
        }
        dotPaint(['228, 238, 255'], DOT_BUCKETS);

        /* ---- spray thrown off the lip ------------------------------------ */
        for (let i = 0; i < 44; i++) {
          const s1 = Math.sin(i * 33.1 + 0.7) * 0.5 + 0.5;
          const phase = (t * 0.52 + s1) % 1;
          const ox = head - unit * (0.02 + 0.1 * s1);
          const px = ox + unit * (0.03 + 0.1 * s1) * phase;
          const py = crest(ox) - unit * 0.012 + unit * (0.05 + 0.17 * s1) * phase * phase;
          const a = alpha * (1 - phase) * 0.55;
          dotAdd(px, py, 0.7 + (1 - phase) * 1.8, a, 0);
        }
        dotPaint(['108, 138, 252'], DOT_BUCKETS);

        /* ---- the lip itself, so the head keeps a hard edge ---------------- */
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = edgeGrad;
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.moveTo(head - unit * 0.06, crest(head - unit * 0.06));
        ctx.quadraticCurveTo(head + unit * 0.035, crest(head) - unit * 0.035, head + unit * 0.02, by);
        ctx.stroke();
        ctx.globalAlpha = 1;

        for (let i = 1; i <= 6; i++) {
          const ry = unit * (0.006 + i * 0.0055);
          ctx.beginPath();
          ctx.ellipse(head - i * unit * 0.055, by + unit * 0.012, ry * 3.2, ry, 0, 0, 6.2831853);
          ctx.strokeStyle = 'rgba(77, 107, 254, ' + (alpha * 0.18 * (1 - i / 7)).toFixed(3) + ')';
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }

        const halo = ctx.createRadialGradient(head, by, 0, head, by, unit * 0.26);
        halo.addColorStop(0, 'rgba(77, 107, 254, ' + (0.2 * alpha).toFixed(3) + ')');
        halo.addColorStop(1, 'rgba(77, 107, 254, 0)');
        ctx.fillStyle = halo;
        ctx.fillRect(head - unit * 0.26, by - unit * 0.26, unit * 0.52, unit * 0.52);

        ctx.restore();
      }

      function frame(t) {
        if (!w || !h) return;
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, w, h);

        const cx = w / 2;
        const cy = h * 0.44;
        const burstY = h * 0.5;
        // Rings one size up, mark half a size down: at 1080p the innermost
        // ring is now r = 0.72 * 356 = 256 px and the mark is 330 px wide
        // (204 px half-diagonal), so the whale sits clearly inside the circle
        // with a margin instead of grazing it.
        const ringR = Math.min(unit * 0.33, 360);
        const swimW = Math.min(unit * 0.46, 495);
        const restW = Math.min(unit * 0.315, 330);
        const breath = 0.5 + 0.5 * Math.sin(6.2831853 * 0.32 * (t - 0.9) - 1.1);
        const alive = 0.55 + 0.45 * breath;

        for (let i = 0; i < dust.length; i++) {
          const d = dust[i];
          const drift = d.y - t * 0.014 * d.sp;
          const y = drift - Math.floor(drift);
          const x = d.x + Math.sin(t * 0.8 * d.sp + d.ph) * 0.006;
          const fade = 0.5 + 0.5 * Math.sin(t * 1.2 * d.sp + d.ph);
          const a = d.a * (0.1 + 0.9 * fade * fade) * ramp(0, 0.5, t);
          dotAdd(x * w, y * h, d.r, a, 0);
        }
        dotPaint(['134, 158, 255'], DOT_BUCKETS);

        // The head is still at the centre on the burst frame, but it eases in
        // and out instead of launching at full speed, and after the burst the
        // water keeps travelling for over half a second while it thins out --
        // the old exit was 0.3 s and read as the picture being yanked away.
        if (t < phase.burst + 0.72) {
          const sweep = clampUnit(t / Math.max(0.001, phase.burst));
          const head =
            t < phase.burst
              ? mix(-0.22 * w, 0.54 * w, sweep * sweep * (3 - 2 * sweep))
              : mix(0.54 * w, 1.46 * w, clampUnit((t - phase.burst) / 0.62));
          const fade =
            t < phase.burst
              ? ramp(0, 0.14, t)
              : Math.max(0, 1 - (t - phase.burst) / 0.62);
          if (fade > 0.01) drawWave(head, fade, t, burstY);
        }

        const bt = t - phase.burst;
        /* The long sequence unlocks on a chime, not on an impact: the same
         * beats play at a third of the punch so the picture does not shout
         * over a narration that has already started. */
        const punch = typeof phase.burstPower === 'number' ? phase.burstPower : 1;
        if (bt >= 0 && bt < 1.05) {
          ctx.save();
          ctx.globalCompositeOperation = 'source-over';
          const flash = Math.max(0, 1 - bt / 0.26);
          if (flash > 0.01) {
            const reach = unit * (0.12 + 0.5 * Math.min(1, bt / 0.26));
            const glow = ctx.createRadialGradient(cx, burstY, 0, cx, burstY, reach);
            glow.addColorStop(0, 'rgba(37, 62, 220, ' + (0.55 * flash * punch).toFixed(3) + ')');
            glow.addColorStop(0.32, 'rgba(77, 107, 254, ' + (0.34 * flash * punch).toFixed(3) + ')');
            glow.addColorStop(1, 'rgba(77, 107, 254, 0)');
            ctx.fillStyle = glow;
            ctx.fillRect(cx - reach, burstY - reach, reach * 2, reach * 2);
          }
          for (let ring = 0; ring < 2; ring++) {
            const k = clampUnit((bt - ring * 0.07) / 0.62);
            if (k <= 0 || k >= 1) continue;
            ctx.beginPath();
            ctx.arc(cx, burstY, unit * 0.5 * Math.pow(k, 0.62), 0, 6.2831853);
            ctx.strokeStyle = 'rgba(77, 107, 254, ' + (0.62 * Math.pow(1 - k, 1.7) * punch).toFixed(3) + ')';
            ctx.lineWidth = 3 * (1 - k) + 0.6;
            ctx.stroke();
          }
          const sparkK = Math.min(1, bt / 0.5);
          for (let i = 0; i < 64; i++) {
            const angle = (i / 64) * 6.2831853 + 0.21;
            const long = 0.05 + 0.2 * (((i * 37) % 100) / 100);
            const inner = unit * 0.04 * Math.pow(sparkK, 0.5);
            const outer = unit * (0.04 + long) * Math.pow(sparkK, 0.55);
            const a = 0.55 * Math.pow(1 - sparkK, 1.4) * punch;
            if (a <= 0.01) continue;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(angle) * inner, burstY + Math.sin(angle) * inner);
            ctx.lineTo(cx + Math.cos(angle) * outer, burstY + Math.sin(angle) * outer);
            ctx.strokeStyle = 'rgba(37, 62, 220, ' + a.toFixed(3) + ')';
            ctx.lineWidth = 1.1;
            ctx.stroke();
          }
          ctx.restore();
        }

        const wStart = phase.whale[0];
        const wEnd = phase.whale[1];
        // Form quickly and off-centre, then spend the rest of the beat swimming:
        // that is what makes the whale read as moving, not condensing in place.
        // The pose locks while the call is still ringing, not after it: the
        // salute has to land on a still mark. The lock follows the salute, so
        // the tight Japanese cut simply swims a shorter leg instead of the
        // voice arriving over a whale that is still moving.
        const lock = Math.min(wEnd, Math.max(wStart + 0.55, Math.min(wStart + 1.02, phase.salute - 0.1)));
        // The whole beat is the crossing, not the second half of it: at the old
        // start the whale reached the centre in 0.6 s and read as a cut.
        const swim = ramp(wStart + 0.02, lock, t);
        const settle = ramp(lock - 0.12, lock + 0.44, t);
        const size = mix(swimW, restW, settle);
        const fromX = w * 0.19;
        const fromY = h * 0.41;
        const restX = mix(fromX, cx, swim);
        // A shallow arc on the way in: the whale rises out of the burst.
        const restY = mix(fromY, cy, swim) - Math.sin(Math.PI * swim) * unit * 0.05;
        const beat = 6.2831853 * 1.15 * (t - wStart);
        const wagAmp = 0.055 * (1 - settle);
        // No roll: the mark arrives upright and stays upright. The only angle
        // left is the small nose-down tilt of the approach, which is gone by
        // the time the body locks.
        const rot = (1 - swim) * -0.12;
        const cloud = ramp(wStart, wStart + 0.12, t) * (1 - ramp(lock + 0.38, lock + 0.86, t));
        // The mark stays. It fades up out of the dots and holds there for the
        // rest of the cut: an earlier pass had it sink away as the name landed,
        // and the frame went empty in the one moment it should be full.
        // Materialising is the slow part: a third of a second was a switch
        // being thrown; 0.62 s lets the ink bleed through the dots instead.
        const ink = ramp(lock - 0.05, lock + 0.62, t);

        if (whale.ready && t >= wStart - 0.02 && cloud > 0.02 && whale.points.length) {
          ctx.save();
          ctx.globalCompositeOperation = 'source-over';
          const points = whale.points;
          const cosR = Math.cos(rot);
          const sinR = Math.sin(rot);
          for (let i = 0; i < points.length; i++) {
            const p = points[i];
            const k = ramp(0, 1, clampUnit((t - (wStart + p.delay * 0.3)) / 0.55));
            if (k <= 0.002) continue;
            // A travelling wave down the body: strong at the tail, still at the
            // head, damped to zero as the mark locks. This is the swim stroke.
            const wag = Math.sin(beat - (p.x + 0.5) * 2.7) * wagAmp * p.tailK;
            const wx = (p.x + wag * 0.35) * size;
            const wy = (p.y + wag) * size;
            const tx = restX + wx * cosR - wy * sinR;
            const ty = restY + wx * sinR + wy * cosR;
            const bx = cx + p.sx * unit * 1.1;
            const by = burstY + p.sy * unit * 1.1;
            const swirl = Math.sin(Math.PI * k) * p.sw * unit * 0.12;
            const px = mix(bx, tx, k) - swirl * p.y * 2.2;
            const py = mix(by, ty, k) + swirl * p.x * 2.2;
            const a = cloud * (0.42 + 0.58 * k) * (0.2 + 0.62 * p.tone);
            const deep = p.tone > 0.72;
            dotAdd(px, py, p.r * (0.7 + 0.5 * k), deep ? Math.min(1, a * 1.1) : a, deep ? 1 : 0);
          }
          dotPaint(['77, 107, 254', '28, 52, 206'], DOT_BUCKETS);
          ctx.restore();
        }

        if (whale.ready) {
          const bloomA = (0.12 + 0.11 * breath) * ramp(wStart, wStart + 0.2, t) * (1 - 0.7 * ink);
          if (bloomA > 0.004) {
            const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, ringR * 0.95);
            bloom.addColorStop(0, 'rgba(158, 173, 196, ' + bloomA.toFixed(3) + ')');
            bloom.addColorStop(0.55, 'rgba(186, 200, 222, ' + (bloomA * 0.4).toFixed(3) + ')');
            bloom.addColorStop(1, 'rgba(206, 217, 234, 0)');
            ctx.fillStyle = bloom;
            ctx.fillRect(cx - ringR, cy - ringR, ringR * 2, ringR * 2);
          }
          paintMark(restX, restY, size, ink, rot, t, settle, breath);
        }

        const ringT = t - phase.rings;
        if (ringT > -0.04) {
          const appearAll = ramp(0, 0.3, ringT);
          const defs = [
            { r: ringR, n: 96, spin: 0.26, size: 1.55, a: 0.92 },
            { r: ringR * 0.86, n: 72, spin: -0.34, size: 1.2, a: 0.72 },
            { r: ringR * 0.72, n: 120, spin: 0.44, size: 0.95, a: 0.56 },
          ];
          ctx.save();
          ctx.globalCompositeOperation = 'source-over';
          for (let s = 0; s < defs.length; s++) {
            const def = defs[s];
            const radius = def.r * (1 + 0.014 * breath);
            for (let i = 0; i < def.n; i++) {
              const appear = ramp(0, 1, clampUnit((ringT - (i / def.n) * 0.5) / 0.24));
              if (appear <= 0.01) continue;
              const angle = (i / def.n) * 6.2831853 + def.spin * ringT + 0.35 * s;
              dotAdd(
                cx + Math.cos(angle) * radius,
                cy + Math.sin(angle) * radius,
                def.size * (0.65 + 0.5 * appear),
                def.a * appear * alive,
                0
              );
            }
          }
          const spin = ringT * 1.5;
          const spinR = ringR * (1 + 0.014 * breath);
          for (let i = 0; i < 20; i++) {
            const angle = spin + i * 0.032;
            dotAdd(
              cx + Math.cos(angle) * spinR,
              cy + Math.sin(angle) * spinR,
              Math.max(0.4, 2.3 - i * 0.09),
              (1 - i / 20) * 0.9 * ramp(0, 0.4, ringT),
              1
            );
          }
          dotPaint(['77, 107, 254', '28, 52, 206'], DOT_BUCKETS);
          ctx.restore();

          ctx.globalCompositeOperation = 'source-over';
          for (let s = 0; s < 2; s++) {
            ctx.beginPath();
            ctx.arc(cx, cy, defs[s].r, 0, 6.2831853);
            ctx.strokeStyle = 'rgba(77, 107, 254, ' + (0.16 * alive * appearAll).toFixed(3) + ')';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }

        /* The long sequence holds this frame for a dozen seconds while the
         * steps narrate, and a still picture reads as a frozen one. One slow
         * hologram scan crosses the mark every 4.6 s; the short cuts are over
         * before it ever fires. */
        if (phase.salute - phase.burst > 6) {
          const since = t - phase.burst - 2.0;
          if (since > 0) {
            const u = (since % 4.6) / 1.5;
            if (u <= 1) {
              const sx = cx + (u * 1.8 - 0.9) * ringR;
              const top = cy - ringR * 0.82;
              const tall = ringR * 1.64;
              const grad = ctx.createLinearGradient(sx, top, sx, top + tall);
              const a = 0.17 * Math.sin(Math.PI * u);
              grad.addColorStop(0, 'rgba(77, 107, 254, 0)');
              grad.addColorStop(0.5, 'rgba(77, 107, 254, ' + a.toFixed(3) + ')');
              grad.addColorStop(1, 'rgba(77, 107, 254, 0)');
              ctx.fillStyle = grad;
              ctx.fillRect(sx - 1.1, top, 2.2, tall);
            }
          }
        }
      }

      return { resize, frame };
    }
    /**
     * The short cut: three beats in one clock, so the picture, the type and the
     * bottom bars stay on the music. `mode` is one master of the set (an
     * inactive language plays the same way), and `onDone` lets the preview
     * queue start the next one when this one has faded.
     */
    function Cyber(props) {
      const mode = props.mode || MODE;
      const doneRef = useRef(null);
      doneRef.current = props.onDone || null;
      const [leaving, setLeaving] = useState(false);
      const [gone, setGone] = useState(false);
      const canvasRef = useRef(null);
      const centerRef = useRef(null);
      const leadRef = useRef(null);
      const nameWrapRef = useRef(null);
      const nameRef = useRef(null);
      const ruleRef = useRef(null);
      const barsRef = useRef(null);
      const pctRef = useRef(null);
      const stepsRef = useRef([]);
      const stepsBoxRef = useRef(null);

      useEffect(() => {
        if (prefersReducedMotion()) {
          setGone(true);
          if (doneRef.current) doneRef.current();
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
        const scene = canvas ? makeCyberScene(canvas, mode.phase) : null;
        if (scene) {
          scene.resize();
          window.addEventListener('resize', scene.resize);
        }

        const startedAt = window.performance.now();
        let track = null;
        if (mode.track) {
          track = new Audio(mode.track);
          track.preload = 'auto';
          track.volume = 0.95;
          const attempt = track.play();
          if (attempt && typeof attempt.catch === 'function') {
            attempt.catch(() => {
              /* autoplay blocked: the cut runs silently */
            });
          }
        }

        const clock = () => {
          if (track && !track.paused && track.currentTime > 0) return track.currentTime;
          return (window.performance.now() - startedAt) / 1000;
        };

        const fade = mode.cue.fadeOut || 0.28;
        const total = mode.cue.total || 3.4;
        const span = Math.max(0.6, total - fade);

        const stop = (hard) => {
          if (ending || disposed) return;
          ending = true;
          if (hard && track) {
            try {
              track.pause();
              track.currentTime = 0;
            } catch (error) {
              /* nothing was playing */
            }
          }
          setLeaving(true);
          later(() => {
            setGone(true);
            const next = doneRef.current;
            if (next) next();
          }, hard ? 170 : fade * 1000 + 40);
        };

        const tickEls = barsRef.current
          ? Array.prototype.slice.call(barsRef.current.children)
          : [];
        const tickAlpha = new Array(tickEls.length).fill(-1);
        const leadEl = leadRef.current;
        const centerEl = centerRef.current;
        const wrapEl = nameWrapRef.current;
        const nameEl = nameRef.current;
        const ruleEl = ruleRef.current;
        const pctEl = pctRef.current;
        let pctText = '';
        let lastProgress = -1;

        /* Assigning a style property dirties the element even when the value
         * did not move, and letterSpacing / width force a re-layout. Most of
         * these values are constant once their ramp has finished, so they are
         * memoised and only pushed when they actually change. */
        const cssMemo = {};
        const setCss = (name, el, prop, value) => {
          const key = name + '.' + prop;
          if (!el || cssMemo[key] === value) return;
          cssMemo[key] = value;
          el.style[prop] = value;
        };

        /* Reading window.innerWidth just after a style write forces a layout
         * flush, and the tick reads it every frame. The viewport only changes
         * on resize, so it is sampled there instead. */
        let vw = window.innerWidth;
        let vh = window.innerHeight;
        let captionY = 0;

        /* The caption hangs under the lowest ring (the ring group is centred
         * at 0.44vh with r = min(unit*0.33, 360), same numbers as the canvas),
         * but it may never run into the progress bar. Its own height is read
         * from the laid-out node, so long names push it up instead of being
         * clipped. Recomputed on resize only -- the text does not reflow
         * during the run. */
        const cjkSalute = mode.lang === 'zh' || mode.lang === 'ja';
        const place = () => {
          const unitSpan = Math.min(vw, vh);
          const ring = Math.min(unitSpan * 0.33, 360);
          /* ~4 mm of daylight under the lowest ring at a normal desktop
           * scale, so the salute never touches the circle. */
          const gap = Math.max(26, unitSpan * 0.07);
          const measured = centerEl ? centerEl.offsetHeight : 0;
          const blockH = measured > 8 ? measured : Math.max(48, unitSpan * 0.1);
          const under = vh * 0.44 + ring + gap;
          const floor = vh * 0.44 + ring * 0.55;
          /* The Chinese and Japanese salutes are tall enough to be clamped
           * upward by the bar; give them a lower bottom line and a small
           * extra drop, so the lead clears the ring instead of hugging it. */
          const reserve = cjkSalute ? 54 : 62;
          const drop = cjkSalute ? Math.min(unitSpan * 0.02, 22) : 0;
          captionY = Math.min(under + drop, Math.max(floor, vh - reserve - blockH));
          /* The step plate keeps the old anchor; it hands over to a salute
           * that now lands a little lower. */
          const plate = stepsBoxRef.current;
          if (plate) {
            const plateY = Math.min(under, Math.max(floor, vh - 62 - blockH));
            plate.style.transform = 'translateY(' + plateY.toFixed(1) + 'px)';
          }
        };
        const measure = () => {
          vw = window.innerWidth;
          vh = window.innerHeight;
          place();
        };
        window.addEventListener('resize', measure);
        measure();

        const tick = (ts) => {
          if (disposed) return;
          const t = clock();
          if (scene) scene.frame(t);

          const progress = clampUnit(t / span);
          if (Math.abs(progress - lastProgress) > 0.0005) {
            lastProgress = progress;

            if (centerEl) {
              setCss('center', centerEl, 'transform', 'translate(-50%, ' + captionY.toFixed(1) + 'px)');
            }

            if (leadEl) {
              const k = ramp(mode.phase.salute, mode.phase.salute + 0.36, t);
              const flicker = 0.78 + 0.22 * (0.5 + 0.5 * Math.sin(t * 41.3));
              setCss('lead', leadEl, 'opacity', (k * flicker).toFixed(3));
              setCss('lead', leadEl, 'letterSpacing', (mode.leadTrack + 0.2 - 0.2 * k).toFixed(3) + 'em');
            }

            if (wrapEl && nameEl && ruleEl) {
              const k = ramp(mode.phase.name, mode.phase.name + 0.46, t);
              setCss('wrap', wrapEl, 'opacity', k.toFixed(3));
              setCss('name', nameEl, 'transform',
                'translateY(' + ((1 - k) * 9).toFixed(2) + 'px) scale(' + (1.07 - 0.07 * k).toFixed(4) + ')');
              setCss('name', nameEl, 'letterSpacing', (0.07 + (mode.nameTrack - 0.07) * k).toFixed(3) + 'em');
              setCss('name', nameEl, 'textShadow',
                '0 0 ' + (9 + 24 * k).toFixed(1) + 'px rgba(77, 107, 254, ' + (0.12 + 0.32 * k).toFixed(3) + ')');
              setCss('rule', ruleEl, 'width', (k * 190).toFixed(1) + 'px');
              setCss('rule', ruleEl, 'opacity', (k * 0.9).toFixed(3));
            }

            if (tickEls.length) {
              const breather = 0.56 + 0.44 * (0.5 + 0.5 * Math.sin(6.2831853 * 0.32 * (t - 0.9) - 1.1));
              const lit = progress * tickEls.length;
              for (let i = 0; i < tickEls.length; i++) {
                const v = i + 1 <= lit ? 1 : Math.max(0, lit - i);
                const a = 0.1 + 0.9 * v * breather;
                if (Math.abs(a - tickAlpha[i]) > 0.016) {
                  tickAlpha[i] = a;
                  tickEls[i].style.opacity = a.toFixed(3);
                }
              }
            }

            if (pctEl) {
              const text = ('00' + Math.round(progress * 100)).slice(-3) + '%';
              if (text !== pctText) {
                pctText = text;
                pctEl.textContent = text;
              }
            }
          }

          /* The step plate follows the voice one line at a time: written in
           * as the sentence starts, dissolved as it ends, so the next line
           * arrives into an empty plate. Only one is ever legible. */
          if (stepsRef.current.length) {
            for (let i = 0; i < stepsRef.current.length; i++) {
              const step = mode.cue.steps && mode.cue.steps[i];
              const el = stepsRef.current[i];
              if (!step || !el) continue;
              const enters = ramp(step.at, step.at + 0.22, t);
              const leaves = 1 - ramp(step.end, step.end + 0.22, t);
              const k = enters * leaves;
              setCss('step' + i, el, 'opacity', k.toFixed(3));
              setCss('step' + i, el, 'transform',
                'translateY(' + ((1 - enters) * 10 - (1 - leaves) * 5).toFixed(2) + 'px)');
            }
          }

          if (t >= span) {
            stop(false);
            return;
          }
          raf = window.requestAnimationFrame(tick);
        };

        const onSkip = () => stop(true);
        window.addEventListener('pointerdown', onSkip, true);
        window.addEventListener('keydown', onSkip, true);
        raf = window.requestAnimationFrame(tick);

        return () => {
          disposed = true;
          if (raf) window.cancelAnimationFrame(raf);
          timers.forEach((id) => clearTimeout(id));
          timers.clear();
          if (scene) window.removeEventListener('resize', scene.resize);
          window.removeEventListener('resize', measure);
          window.removeEventListener('pointerdown', onSkip, true);
          window.removeEventListener('keydown', onSkip, true);
          if (track) {
            try {
              track.pause();
              track.removeAttribute('src');
            } catch (error) {
              /* already released */
            }
          }
        };
      }, []);

      if (gone) return null;

      return h(
        'div',
        {
          className:
            'dshop-root' +
            (leaving ? ' is-leaving' : '') +
            (mode.lang === 'zh' ? ' is-zh' : '') +
            (mode.lang === 'ru' ? ' is-ru' : '') +
            (mode.lang === 'en' ? ' is-en' : '') +
            (mode.lang === 'ja' ? ' is-ja' : ''),
          style: {
            '--dshop-stage': PALETTE.stage,
            '--dshop-ink': PALETTE.ink,
            '--dshop-dim': PALETTE.dim,
            '--dshop-faint': PALETTE.faint,
            '--dshop-rule': PALETTE.rule,
            '--dshop-accent': PALETTE.accent,
            '--dshop-fade': (mode.cue.fadeOut || 0.28) + 's',
          },
        },
        h('style', { key: 'css' }, CSS),
        h('canvas', { key: 'field', ref: canvasRef, className: 'dshop-canvas' }),
        mode.cue.steps && mode.cue.steps.length
          ? h(
              'div',
              { key: 'steps', className: 'dshop-cyber-steps', ref: stepsBoxRef },
              mode.cue.steps.map(function (step, i) {
                return h(
                  'div',
                  {
                    key: i,
                    className: 'dshop-cyber-step',
                    ref: function (el) {
                      stepsRef.current[i] = el;
                    },
                  },
                  stepTextOf(step, mode.lang)
                );
              })
            )
          : null,
        h(
          'div',
          { className: 'dshop-cyber-center', ref: centerRef },
          h('div', { className: 'dshop-cyber-lead', ref: leadRef }, mode.lines[0]),
          h(
            'div',
            { className: 'dshop-cyber-namewrap', ref: nameWrapRef },
            h('div', { className: 'dshop-cyber-rule', ref: ruleRef }),
            h('h1', { className: 'dshop-cyber-name', ref: nameRef }, mode.lines[1])
          )
        ),
        h(
          'div',
          { className: 'dshop-cyber-bar' },
          h(
            'div',
            { className: 'dshop-cyber-bars', ref: barsRef },
            Array.from({ length: BAR_COUNT }, function (_, i) {
              return h('i', { key: i, className: 'dshop-cyber-tick' });
            })
          ),
          h('div', { className: 'dshop-cyber-pct', ref: pctRef }, '000%')
        )
      );
    }
    /**
     * The short cuts, played here and now from the Settings page. A queue is a
     * list of set keys; nothing is saved, so the boot language is untouched.
     */
    const PREVIEW_QUEUES = [
      {
        id: 'four-full',
        label: '依次播放四版（完整）· 中文 → English → Русский → 日本語 · 约 72 s',
        keys: ['zh', 'en', 'ru', 'ja'],
        lead: true,
      },
      {
        id: 'four',
        label: '依次播放四版（简）· 中文 → English → Русский → 日本語',
        keys: ['zh-short', 'en-short', 'ru-short', 'ja-short'],
        lead: true,
      },
      { id: 'zh-short', label: '中文（简）', keys: ['zh-short'] },
      { id: 'ja-short', label: '日本語（簡）', keys: ['ja-short'] },
      { id: 'ru-short', label: 'Русский (Кратко)', keys: ['ru-short'] },
      { id: 'en-short', label: 'English (Short)', keys: ['en-short'] },
    ];

    /** Tiny emitter: the Settings page starts a queue, the overlay plays it. */
    const PREVIEW = { queue: null, index: 0, done: false, listeners: new Set() };

    function previewNotify() {
      PREVIEW.listeners.forEach((fn) => {
        try {
          fn();
        } catch (error) {
          /* a listener from a page that is already going away */
        }
      });
    }

    function playPreview(keys) {
      PREVIEW.queue = keys.slice();
      PREVIEW.index = 0;
      PREVIEW.done = false;
      previewNotify();
    }

    function advancePreview() {
      if (!PREVIEW.queue) return;
      PREVIEW.index += 1;
      if (PREVIEW.index >= PREVIEW.queue.length) {
        PREVIEW.queue = null;
        PREVIEW.done = true;
      }
      previewNotify();
    }

    /**
     * The overlay layer: the cut that belongs to this page load, or whatever
     * the preview queue holds. React keeps the boot cut's instance alive across
     * these re-renders, so starting a preview later never replays it.
     */
    function OverlayRoot() {
      const rev = useState(0)[1];
      useEffect(() => {
        const fn = () => rev((n) => n + 1);
        PREVIEW.listeners.add(fn);
        return () => {
          PREVIEW.listeners.delete(fn);
        };
      }, []);
      if (PREVIEW.queue) {
        const key = PREVIEW.queue[PREVIEW.index];
        const node = h(Cyber, { key: key, mode: modeOf(key), onDone: advancePreview });
        /* The overlay layer sits under the host's dialogs, so a preview started
         * from Settings would play behind the very panel that launched it.
         * Portalled to <body> the cut is above everything for its few seconds;
         * the layer swallows clicks so the dialog underneath is not operated
         * by accident while it plays. */
        if (ReactDOM && ReactDOM.createPortal) {
          return ReactDOM.createPortal(
            h('div', { key: 'preview', className: 'dshop-preview' }, node),
            document.body,
          );
        }
        return node;
      }
      if (PREVIEW.done) return null;
      return h(Cyber, null);
    }

    /** The eight modes, grouped: full sequence first, short cut second. */
    const CHOICES = [
      { key: 'zh', group: 'full', name: '中文', line: '欢迎回来，指挥员' },
      { key: 'en', group: 'full', name: 'English', line: 'Welcome back, commander.' },
      { key: 'ru', group: 'full', name: 'Русский', line: 'Добро пожаловать, товарищ.' },
      { key: 'ja', group: 'full', name: '日本語', line: 'おかえりなさいませ、ご主人様' },
      { key: 'zh-short', group: 'short', name: '中文（简）', line: '欢迎回来，指挥员' },
      { key: 'en-short', group: 'short', name: 'English (Short)', line: 'Welcome back, commander.' },
      { key: 'ru-short', group: 'short', name: 'Русский (Кратко)', line: 'Добро пожаловать, товарищ.' },
      { key: 'ja-short', group: 'short', name: '日本語（簡）', line: 'おかえりなさいませ、ご主人様' },
    ];

    /**
     * This plugin's own Settings page. Inline styles on purpose: the stage CSS
     * is confined to the overlay, while this page lives inside the host's
     * settings panel and should inherit its theme, font and colour.
     */
    function SettingsPage() {
      const [lang, setLang] = useState(readLang);
      const choose = (next) => {
        writeLang(next);
        setLang(next);
      };
      return h(
        'div',
        {
          style: {
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            maxWidth: '640px',
            font: 'inherit',
            color: 'inherit',
          },
        },
        h(
          'div',
          { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
          h('div', { style: { fontSize: '15px', fontWeight: 600 } }, 'Boot language'),
          h(
            'div',
            { style: { fontSize: '12.5px', lineHeight: 1.65, opacity: 0.62 } },
            'Which power-on sequence plays. The full cut runs the five access steps (~18s); the short cut is the 3.8-4.5s one: one wave sweeps the screen, bursts into the dots that assemble the whale, and the mark swims into place and freezes into ink inside the rings as the salute lands. Every language lands the salute on the same beat, so a longer line makes a longer cut instead of faster beats. The change lands on the next page load.',
          ),
        ),
        ['full', 'short'].map((group) =>
          h(
            'div',
            {
              key: 'group-' + group,
              style: { display: 'flex', flexDirection: 'column', gap: '10px' },
            },
            h(
              'div',
              {
                style: {
                  fontSize: '11px',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  opacity: 0.5,
                },
              },
              group === 'full' ? 'Full sequence · 18s' : 'Short cut · 3.8-4.5s',
            ),
            h(
          'div',
          { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } },
          CHOICES.filter((choice) => choice.group === group).map((choice) => {
            const active = choice.key === lang;
            return h(
              'button',
              {
                key: choice.key,
                type: 'button',
                onClick: () => choose(choice.key),
                'aria-pressed': active,
                style: {
                  flex: '1 1 170px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '6px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border:
                    '1px solid ' +
                    (active ? 'currentColor' : 'rgba(128, 128, 128, 0.3)'),
                  background: active ? 'rgba(128, 128, 128, 0.14)' : 'transparent',
                  color: 'inherit',
                  font: 'inherit',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'background 120ms ease, border-color 120ms ease',
                },
              },
              h(
                'span',
                {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    fontSize: '13px',
                    fontWeight: 500,
                  },
                },
                choice.name,
                active
                  ? h('span', { style: { fontSize: '11px', opacity: 0.65 } }, '✓')
                  : null,
              ),
              h(
                'span',
                { style: { fontSize: '11.5px', opacity: 0.58 } },
                choice.line,
              ),
            );
          }),
            ),
          ),
        ),
        h(
          'div',
          { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
          h('div', { style: { fontSize: '15px', fontWeight: 600 } }, 'Preview'),
          h(
            'div',
            { style: { fontSize: '12.5px', lineHeight: 1.65, opacity: 0.62 } },
            'Plays the cuts here and now, without touching the saved boot language. The four-language queues run every version back to back (about 72 s for the full sequence, 16 s for the short cuts). Click anywhere or press a key to skip to the next one.',
          ),
          h(
            'div',
            { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } },
            PREVIEW_QUEUES.map((queue) =>
              h(
                'button',
                {
                  key: queue.id,
                  type: 'button',
                  onClick: () => playPreview(queue.keys),
                  style: {
                    flex: queue.lead ? '1 1 100%' : '1 1 130px',
                    padding: queue.lead ? '12px 16px' : '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid rgba(77, 107, 254, 0.55)',
                    background: queue.lead
                      ? 'rgba(77, 107, 254, 0.14)'
                      : 'rgba(77, 107, 254, 0.06)',
                    color: 'inherit',
                    font: 'inherit',
                    fontSize: queue.lead ? '13px' : '12px',
                    fontWeight: queue.lead ? 600 : 500,
                    textAlign: 'left',
                    cursor: 'pointer',
                  },
                },
                queue.label,
              ),
            ),
          ),
        ),
      );
    }

    function apply(ctx) {
      ctx.effect(
        () => ctx.locale.register(NS, { zh: DICT.zh, en: DICT.en }),
        'dsh-opening: dictionaries',
      );
      const t = ctx.locale.bind(NS);
      ctx.slots.inject('settings.section', () =>
        ctx.slots.register(
          {
            name: 'settings.section',
            id: 'dsh-opening-free',
            order: 45,
            label: () => t('title'),
          },
          () => h(SettingsPage, null),
        ),
      );
      ctx.slots.inject('shell.overlay', () =>
        ctx.slots.register(
          {
            name: 'shell.overlay',
            id: 'dsh-opening-free',
            order: -1000,
            label: () => t('word'),
          },
          () => h(OverlayRoot, null),
        ),
      );
    }

    return { inject: ['slots', 'locale'], apply };
  },
});
