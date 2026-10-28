/**
 * @local/dsh-opening — Client half.
 *
 * Registers one entry into `shell.overlay` (a frame-wide, click-through layer).
 * The entry is a temporary boot stage: it covers the frame, plays a short
 * power-on sequence, then unmounts itself and leaves nothing behind.
 *
 * Art direction lives in the SEQ table below — geometry, timing and the one
 * word of text are the only things that should change for a restyle. The mount
 * code below it is plumbing: it must stay inside the slot contract
 * (a fresh id, everything registered through ctx, nothing outside the slot).
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-opening',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NS = 'dsh-opening';

    /** Visible text goes through the Client locale service, never a literal. */
    const DICT = {
      zh: { word: '正在启动' },
      en: { word: 'INITIALIZING' },
    };

    /**
     * Sequence parameters.
     *
     *   fadeInMs   the stage fades up from black
     *   holdMs     the composed frame holds still
     *   fadeOutMs  the stage fades back to the app underneath
     *   rulePx     width of the centre hairline
     *   word       dictionary key for the caption
     *   palette    ink, dim, bar and stage colours
     */
    const SEQ = {
      fadeInMs: 260,
      holdMs: 1100,
      fadeOutMs: 420,
      rulePx: 320,
      word: 'word',
      palette: {
        stage: '#06080b',
        ink: '#e8eef7',
        dim: '#5a6675',
        bar: '#2b7bd6',
      },
    };

    const TOTAL_MS = SEQ.fadeInMs + SEQ.holdMs + SEQ.fadeOutMs;

    function prefersReducedMotion() {
      try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      } catch (error) {
        return false;
      }
    }

    /** Component-local stylesheet; React removes it together with the stage. */
    function stageStyles() {
      return [
        '@keyframes dshop-draw{from{transform:scaleX(0)}to{transform:scaleX(1)}}',
        '@keyframes dshop-rise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}',
        '@media (prefers-reduced-motion: reduce){.dshop-stage *{animation:none!important}}',
      ].join('');
    }

    function Stage(props) {
      const t = props.t;
      const leaving = React.useState(false);
      const gone = React.useState(function () {
        return prefersReducedMotion();
      });
      const isLeaving = leaving[0];
      const setIsLeaving = leaving[1];
      const hasGone = gone[0];
      const setHasGone = gone[1];

      React.useEffect(function () {
        if (hasGone) return undefined;
        const fadeAt = setTimeout(function () {
          setIsLeaving(true);
        }, TOTAL_MS - SEQ.fadeOutMs);
        const endAt = setTimeout(function () {
          setHasGone(true);
        }, TOTAL_MS);
        const skip = function () {
          setHasGone(true);
        };
        window.addEventListener('pointerdown', skip, true);
        window.addEventListener('keydown', skip, true);
        return function () {
          clearTimeout(fadeAt);
          clearTimeout(endAt);
          window.removeEventListener('pointerdown', skip, true);
          window.removeEventListener('keydown', skip, true);
        };
      }, [hasGone, setIsLeaving, setHasGone]);

      if (hasGone) return null;

      const rootStyle = {
        position: 'fixed',
        inset: 0,
        zIndex: 2147483,
        display: 'grid',
        placeItems: 'center',
        background: SEQ.palette.stage,
        pointerEvents: 'none',
        opacity: isLeaving ? 0 : 1,
        transition: 'opacity ' + SEQ.fadeOutMs + 'ms ease-out',
      };

      const ruleStyle = {
        width: SEQ.rulePx,
        height: 1,
        background: 'rgba(90,102,117,0.55)',
        transformOrigin: 'center',
        animation: 'dshop-draw 900ms cubic-bezier(0.22,0.61,0.36,1) both',
      };

      const captionStyle = {
        font: '500 11px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',
        letterSpacing: '0.42em',
        textTransform: 'uppercase',
        color: SEQ.palette.dim,
        animation: 'dshop-rise 620ms ease-out 180ms both',
      };

      return h(
        React.Fragment,
        null,
        h('style', { key: 'style' }, stageStyles()),
        h(
          'div',
          { key: 'stage', className: 'dshop-stage', 'aria-hidden': 'true', style: rootStyle },
          h(
            'div',
            { style: { display: 'grid', justifyItems: 'center', gap: '18px' } },
            h('div', { style: ruleStyle }),
            h('div', { style: captionStyle }, t(SEQ.word))
          )
        )
      );
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(function () {
          return ctx.locale.register(NS, DICT);
        }, 'dsh-opening: dictionaries');

        const t = ctx.locale.bind(NS);

        ctx.slots.inject('shell.overlay', function () {
          return ctx.slots.register(
            {
              name: 'shell.overlay',
              id: 'dsh-opening',
              order: -1000,
              label: function () {
                return t(SEQ.word);
              },
            },
            function () {
              return h(Stage, { t: t });
            }
          );
        });
      },
    };
  },
});
