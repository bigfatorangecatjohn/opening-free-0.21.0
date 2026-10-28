"""Patch client.src.js: tri-language set cycling + ionization particle field."""
import io

path = r"plugin\dsh-opening\client.src.js"
src = io.open(path, encoding="utf-8").read()

# ---- 1. header: language set instead of a single cue -------------------------
start = src.index("    const FALLBACK_CUE = {")
end = src.index("    const PALETTE = {")
head = '''    const FALLBACK_CUE = {
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

    const CYCLE_KEY = 'dsh-opening:cycle';

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

'''
src = src[:start] + head + src[end:]

# ---- 2. particle field: ignition / recombination ----------------------------
start = src.index("    /**\n     * A drifting particle field")
end = src.index("    /* ---- styles ---")
field = '''    function envelope(life) {
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

'''
src = src[:start] + field + src[end:]

# ---- 3. render: active-language text, language badge -----------------------
src = src.replace("""                    step.zh,
                    h('span', { className: 'dshop-caret' }),
                  ),
                  h('div', { className: 'dshop-en' }, step.en),""",
"""                    line(step, LANG),
                    h('span', { className: 'dshop-caret' }),
                  ),
                  h('div', { className: 'dshop-en' }, line(step, SUBTITLE)),""")

src = src.replace("              h('span', null, row.zh),", "              h('span', null, line(row, LANG)),")

src = src.replace("""          h('span', null, 'DSH · ACCESS CONTROL'),
          h('span', { ref: counterRef, className: 'dshop-counter' }, '0000'),""",
"""          h('span', null, 'DSH · ACCESS CONTROL'),
          h('span', { className: 'dshop-lang' }, BADGE),
          h('span', { ref: counterRef, className: 'dshop-counter' }, '0000'),""")

# ---- 4. css for the badge --------------------------------------------------
anchor = ".dshop-counter {"
badge_css = """.dshop-lang {
  border: 1px solid var(--dshop-rule);
  border-radius: 2px;
  padding: 1px 5px;
  letter-spacing: 0.14em;
  color: var(--dshop-ink);
}

"""
assert anchor in src
src = src.replace(anchor, badge_css + anchor, 1)

io.open(path, "w", encoding="utf-8", newline="\n").write(src)
print("patched client.src.js:", len(src), "chars")
print("has SET:", "__DSH_OPENING_SET__" in src, "| glow:", "makeGlow" in src, "| badge:", "dshop-lang" in src)
