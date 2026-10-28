"""Move the language switch from a General row into the plugin's own Settings page."""
import io

path = 'plugin/dsh-opening/client.src.js'
src = io.open(path, encoding='utf-8').read()

# 1. dictionary gains a title for the nav row ------------------------------
old_dict = """    const DICT = {
      zh: { word: '开机序列' },
      en: { word: 'BOOT SEQUENCE' },
    };"""
new_dict = """    const DICT = {
      zh: { word: '开机序列', title: '开机动画' },
      en: { word: 'BOOT SEQUENCE', title: 'Opening Sequence' },
    };"""
assert src.count(old_dict) == 1, 'dict anchor'
src = src.replace(old_dict, new_dict)

# 2. the row becomes a full settings page ---------------------------------
start = src.index('    /**\n     * Settings → General row.')
end = src.index('    function apply(ctx) {', start)

page = '''    /** The three tracks, in the order the page shows them. */
    const CHOICES = [
      { key: 'zh', name: '中文', line: '欢迎回来，指挥员' },
      { key: 'en', name: 'English', line: 'Welcome back, commander.' },
      { key: 'ru', name: 'Русский', line: 'Добро пожаловать, товарищ.' },
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
            'Which language the power-on sequence speaks. The steps and the closing salute follow it; the change lands on the next page load.',
          ),
        ),
        h(
          'div',
          { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } },
          CHOICES.map((choice) => {
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
      );
    }

'''
src = src[:start] + page + src[end:]

# 3. register the page instead of the General row -------------------------
old_reg = """      ctx.slots.inject('settings.general.item', () =>
        ctx.slots.register(
          {
            name: 'settings.general.item',
            id: 'dsh-opening-free-language',
            order: 60,
            label: () => 'Boot sequence',
          },
          () => h(LanguageRow, null),
        ),
      );"""
new_reg = """      ctx.slots.inject('settings.section', () =>
        ctx.slots.register(
          {
            name: 'settings.section',
            id: 'dsh-opening-free',
            order: 45,
            label: () => t('title'),
          },
          () => h(SettingsPage, null),
        ),
      );"""
assert src.count(old_reg) == 1, 'registration anchor'
src = src.replace(old_reg, new_reg)

assert 'LanguageRow' not in src, 'stale reference left behind'
io.open(path, 'w', encoding='utf-8', newline='\n').write(src)
print('settings page in place')
