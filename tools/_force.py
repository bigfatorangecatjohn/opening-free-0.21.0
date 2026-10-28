"""Add a build-time language override so a demo take can force one language."""
import io


def poke(path, pairs):
    src = io.open(path, encoding='utf-8').read()
    for old, new in pairs:
        assert src.count(old) == 1, '%s: anchor x%d %r' % (path, src.count(old), old[:60])
        src = src.replace(old, new)
    io.open(path, 'w', encoding='utf-8', newline='\n').write(src)
    print('patched', path)


poke('tools/build-client.mjs', [
    ("""const langs = (langFlag >= 0 ? argv[langFlag + 1] : 'zh,en,ru,ja')""",
     """const langs = (langFlag >= 0 ? argv[langFlag + 1] : 'zh,en,ru,ja')"""),

    ("""for (const lang of langs) {
  if (!['zh', 'en', 'ru', 'ja'].includes(lang)) {""",
     """// Demo takes need one language to win over the stored preference; the flag
// writes that choice into the generated header and nothing else changes.
const forceFlag = argv.indexOf('--force');
const forced = forceFlag >= 0 ? String(argv[forceFlag + 1] || '').trim() : '';
if (forced && !['zh', 'en', 'ru', 'ja'].includes(forced)) {
  console.error('unknown --force language ' + forced);
  process.exit(1);
}

for (const lang of langs) {
  if (!['zh', 'en', 'ru', 'ja'].includes(lang)) {"""),

    ("""  'window.__DSH_OPENING_MARK__ = ' + JSON.stringify('data:image/png;base64,' + mark.toString('base64')) + ';',
  '',
].join('\\n');""",
     """  'window.__DSH_OPENING_MARK__ = ' + JSON.stringify('data:image/png;base64,' + mark.toString('base64')) + ';',
  forced ? 'window.__DSH_OPENING_FORCE_LANG__ = ' + JSON.stringify(forced) + ';' : '',
  '',
]
  .filter((line, index, all) => !(line === '' && index === all.length - 2 && !forced))
  .join('\\n');"""),

    ("""for (const key of ['window.__DSH_OPENING_SET__', 'window.__DSH_OPENING_MARK__']) {""",
     """const keys = ['window.__DSH_OPENING_SET__', 'window.__DSH_OPENING_MARK__'];
if (forced) keys.push('window.__DSH_OPENING_FORCE_LANG__');
for (const key of keys) {"""),

    ("""console.log('langs   ' + built.map((item) => item.lang).join(', '));""",
     """console.log('langs   ' + built.map((item) => item.lang).join(', ') + (forced ? '  (forced ' + forced + ')' : ''));"""),
])

poke('plugin/dsh-opening/client.src.js', [
    ("""    const LANG_KEY = 'dsh-opening:lang';""",
     """    const LANG_KEY = 'dsh-opening:lang';
    // A demo build pins one language; normal builds leave the operator's pick alone.
    const FORCED = String(window.__DSH_OPENING_FORCE_LANG__ || '');"""),

    ("""    function readLang() {
      try {""",
     """    function readLang() {
      if (LANGS.indexOf(FORCED) >= 0) return FORCED;
      try {"""),
])
