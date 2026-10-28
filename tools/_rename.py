"""Rename to dsh-opening-free, add the language switch, fix centred tracking."""
import io
import json

root = "plugin/dsh-opening/"

# 1. manifest ---------------------------------------------------------------
pkg = json.load(io.open(root + "package.json", encoding="utf-8"))
pkg["name"] = "dsh-opening-free"
io.open(root + "package.json", "w", encoding="utf-8", newline="\n").write(
    json.dumps(pkg, ensure_ascii=False, indent=2) + "\n"
)

patch = io.open(root + "cordis.patch.yml", encoding="utf-8").read()
patch = patch.replace("id: dsh-opening\n", "id: dsh-opening-free\n").replace(
    "name: '@local/dsh-opening'\n", "name: dsh-opening-free\n"
)
io.open(root + "cordis.patch.yml", "w", encoding="utf-8", newline="\n").write(patch)

for lang, title in (("zh", "开机动画 Free"), ("en", "Opening Sequence Free")):
    path = root + "locale/%s.json" % lang
    doc = json.load(io.open(path, encoding="utf-8"))
    doc["meta"]["title"] = title
    io.open(path, "w", encoding="utf-8", newline="\n").write(
        json.dumps(doc, ensure_ascii=False, indent=2) + "\n"
    )

# 2. client source ----------------------------------------------------------
path = root + "client.src.js"
src = io.open(path, encoding="utf-8").read()
edits = []


def swap(old, new, label):
    global src
    if src.count(old) != 1:
        raise SystemExit("anchor not unique (%d): %s" % (src.count(old), label))
    src = src.replace(old, new)
    edits.append(label)


swap("  id: '@local/dsh-opening',", "  id: 'dsh-opening-free',", "module id")

swap(
    """    const CYCLE_KEY = 'dsh-opening:cycle.v2';

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
""",
    """    const LANG_KEY = 'dsh-opening:lang';
    const LANGS = ['zh', 'en', 'ru'];

    /** The language picked in Settings, or Chinese when nothing is stored. */
    function readLang() {
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

    /** The track that matches the chosen language, falling back to Chinese. */
    function pickSet() {
      const wanted = readLang();
      for (let i = 0; i < SET.length; i++) {
        if (SET[i].cue && SET[i].cue.lang === wanted) return SET[i];
      }
      return SET[0];
    }
""",
    "language preference",
)

# language row for Settings → General -----------------------------------
swap(
    """    function apply(ctx) {""",
    """    /**
     * Settings → General row. Renders with inline styles on purpose: the stage
     * CSS is confined to the overlay, while this row lives inside the host's
     * settings page and has to inherit the host's theme and font.
     */
    function LanguageRow() {
      const [lang, setLang] = useState(readLang);
      const options = [
        { key: 'zh', label: '中文' },
        { key: 'en', label: 'English' },
        { key: 'ru', label: 'Русский' },
      ];
      const choose = (next) => {
        writeLang(next);
        setLang(next);
      };
      return h(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            padding: '10px 0',
            font: 'inherit',
            color: 'inherit',
          },
        },
        h(
          'div',
          { style: { display: 'flex', flexDirection: 'column', gap: '3px' } },
          h('div', { style: { fontSize: '13px', fontWeight: 500 } }, 'Boot language'),
          h(
            'div',
            { style: { fontSize: '12px', opacity: 0.6 } },
            'Which language the boot sequence speaks.',
          ),
        ),
        h(
          'div',
          { style: { display: 'flex', gap: '6px' } },
          options.map((option) =>
            h(
              'button',
              {
                key: option.key,
                type: 'button',
                onClick: () => choose(option.key),
                'aria-pressed': lang === option.key,
                style: {
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border:
                    '1px solid ' +
                    (lang === option.key ? 'currentColor' : 'rgba(128, 128, 128, 0.34)'),
                  background:
                    lang === option.key ? 'rgba(128, 128, 128, 0.16)' : 'transparent',
                  color: 'inherit',
                  font: 'inherit',
                  fontSize: '12px',
                  cursor: 'pointer',
                },
              },
              option.label,
            ),
          ),
        ),
      );
    }

    function apply(ctx) {""",
    "language row",
)

swap(
    """      ctx.slots.inject('shell.overlay', () =>""",
    """      ctx.slots.inject('settings.general.item', () =>
        ctx.slots.register(
          {
            name: 'settings.general.item',
            id: 'dsh-opening-free-language',
            order: 60,
            label: () => 'Boot sequence',
          },
          () => h(LanguageRow, null),
        ),
      );
      ctx.slots.inject('shell.overlay', () =>""",
    "settings registration",
)

# 3. optical centring + an English typographic scale ----------------------
swap(
    """.dshop-zh {
  text-wrap: balance;
  max-width: 62vmin;""",
    """.dshop-zh {
  text-wrap: balance;
  /* tracking leaves a gap after the last glyph; pad the other side to recentre */
  padding-left: 0.16em;
  max-width: 62vmin;""",
    "zh centring",
)

swap(
    """.dshop-en {
  margin-top: 14px;""",
    """.dshop-root.is-en .dshop-zh {
  font-size: clamp(16px, 1.95vw, 26px);
  letter-spacing: 0.18em;
  font-weight: 600;
  padding-left: 0.18em;
}

.dshop-en {
  padding-left: 0.4em;
  margin-top: 14px;""",
    "en scale",
)

swap(
    """.dshop-salute-lead {
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;""",
    """.dshop-salute-lead {
  padding-left: 0.42em;
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;""",
    "salute lead centring",
)

swap(
    """.dshop-salute-name {
  margin-top: 13px;""",
    """.dshop-salute-name {
  padding-left: 0.2em;
  margin-top: 13px;""",
    "salute name centring",
)

swap(
    """.dshop-salute.ru .dshop-salute-name,
.dshop-salute.en .dshop-salute-name {
  font-size: clamp(24px, 3.4vw, 42px);
  letter-spacing: 0.12em;
}""",
    """.dshop-salute.ru .dshop-salute-name,
.dshop-salute.en .dshop-salute-name {
  font-size: clamp(24px, 3.4vw, 42px);
  letter-spacing: 0.12em;
  padding-left: 0.12em;
}""",
    "salute latin centring",
)

swap(
    """          className: 'dshop-root' + (leaving ? ' is-leaving' : '') + (LANG === 'ru' ? ' is-ru' : ''),""",
    """          className:
            'dshop-root' +
            (leaving ? ' is-leaving' : '') +
            (LANG === 'ru' ? ' is-ru' : '') +
            (LANG === 'en' ? ' is-en' : ''),""",
    "is-en class",
)

io.open(path, "w", encoding="utf-8", newline="\n").write(src)
print("renamed and patched:")
for label in edits:
    print("  -", label)
