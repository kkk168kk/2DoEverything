const qrImage = new URL('./support-qr.png', import.meta.url).href;
const heartPath = 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z';

const copy = {
  zh: {
    trigger: '支持 2DoEverything 作者',
    title: '谢谢你，把小事交给我',
    description: '谢谢你让 2DoEverything 陪你随手记下待办，再把一件件小事划掉。',
    scan: '微信扫码，请作者喝杯咖啡',
    qrLabel: '微信打赏二维码',
    qrUnavailable: '二维码暂时无法显示',
    note: '打赏随心。今天做完一件事，也值得庆祝。',
  },
  en: {
    trigger: 'Support the creator of 2DoEverything',
    title: 'Thanks for sharing your everyday to-dos',
    description: 'From the tasks you jot down to the little things you cross off, thanks for making 2DoEverything part of your day.',
    scan: 'Scan with WeChat to buy the creator a coffee',
    qrLabel: 'WeChat tip QR code',
    qrUnavailable: 'The QR code is temporarily unavailable',
    note: 'Tips are optional. Getting one thing done today is worth celebrating, too.',
  },
};

const confettiColors = ['#ff4b58', '#f5ba3e', '#2cbd99', '#4c89ff', '#9c63ef', '#f770a6', '#ff854a'];
const gravity = 1550;
const drag = 0.48;

function between(min, max) {
  return min + Math.random() * (max - min);
}

function createPiece(index) {
  const direction = index % 2 === 0 ? -1 : 1;
  return {
    color: confettiColors[index % confettiColors.length],
    width: between(5, 11),
    height: between(5, 13),
    vx: direction * between(55, direction < 0 ? 540 : 390),
    vy: -between(440, 900),
    angle: between(0, 2 * Math.PI),
    spin: between(-9, 9),
    lifetime: between(1.4, 2.25),
    diamond: index % 3 === 0,
  };
}

function playConfetti(canvas, card) {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const context = canvas.getContext('2d');
  if (motion.matches || !context) return;

  let frame;
  function stop() {
    cancelAnimationFrame(frame);
    canvas.hidden = true;
    window.removeEventListener('resize', stop);
    motion.removeEventListener('change', stop);
  }

  frame = requestAnimationFrame(start => {
    const bounds = card.current?.getBoundingClientRect();
    if (!bounds) return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.hidden = false;
    context.scale(ratio, ratio);

    const originX = bounds.left + bounds.width / 2;
    const originY = bounds.top + Math.min(62, bounds.height * 0.18);
    const pieces = Array.from({ length: 96 }, (_, index) => createPiece(index));
    const duration = Math.max(...pieces.map(piece => piece.lifetime));

    function draw(now) {
      const age = (now - start) / 1000;
      if (age >= duration) {
        stop();
        return;
      }

      context.clearRect(0, 0, width, height);
      const travel = -Math.expm1(-drag * age) / drag;
      for (const piece of pieces) {
        if (age >= piece.lifetime) continue;

        context.save();
        context.translate(originX + piece.vx * travel, originY + age * (piece.vy + gravity * age / 2));
        context.rotate(piece.angle + age * piece.spin);
        context.scale(0.3 + 0.7 * Math.abs(Math.cos(piece.angle + age * 5)), 1);
        if (piece.diamond) context.rotate(Math.PI / 4);
        context.globalAlpha = Math.min(1, (piece.lifetime - age) / (piece.lifetime * 0.3));
        context.fillStyle = piece.color;
        context.fillRect(-piece.width / 2, -piece.height / 2, piece.width, piece.height);
        context.restore();
      }
      frame = requestAnimationFrame(draw);
    }

    frame = requestAnimationFrame(draw);
  });

  window.addEventListener('resize', stop);
  motion.addEventListener('change', stop);
  return stop;
}

// The compiled application supplies its existing React and Radix instances.
export function createSupport(React, Dialog, CloseIcon, useTranslation) {
  const { createElement: el, useEffect, useRef, useState } = React;

  function Confetti({ card }) {
    const canvas = useRef(null);
    useEffect(() => playConfetti(canvas.current, card), [card]);
    return el('canvas', {
      ref: canvas,
      hidden: true,
      className: 'todo-support-confetti',
      'aria-hidden': true,
    });
  }

  return function Support() {
    const { i18n, t } = useTranslation();
    const language = i18n.language === 'en' ? 'en' : 'zh';
    const labels = copy[language];
    const card = useRef(null);
    const [qrUnavailable, setQrUnavailable] = useState(false);

    return el(Dialog.Root, null,
      el(Dialog.Trigger, {
        className: 'todo-support-trigger',
        'aria-label': labels.trigger,
        title: labels.trigger,
      }, el('svg', {
        className: 'todo-support-heart',
        width: 19,
        height: 19,
        viewBox: '0 0 24 24',
        fill: 'currentColor',
        stroke: 'currentColor',
        strokeWidth: 1.6,
        strokeLinejoin: 'round',
        'aria-hidden': true,
      }, el('path', { d: heartPath }))),
      el(Dialog.Portal, null,
        el(Dialog.Overlay, { className: 'todo-support-overlay' }, el(Confetti, { card })),
        el(Dialog.Content, {
          ref: card,
          className: 'todo-support-dialog',
          lang: language === 'zh' ? 'zh-CN' : 'en',
        },
          el('header', { className: 'todo-support-header' },
            el(Dialog.Title, { className: 'todo-support-title' }, labels.title),
            el(Dialog.Close, {
              className: 'todo-support-close',
              'aria-label': t('a11y.closeDialog'),
            }, el(CloseIcon, { size: 16, 'aria-hidden': true }))),
          el(Dialog.Description, { className: 'todo-support-description' }, labels.description),
          qrUnavailable
            ? el('p', { className: 'todo-support-qr-error', role: 'status' }, labels.qrUnavailable)
            : el('figure', { className: 'todo-support-figure' },
              el('img', {
                className: 'todo-support-qr',
                src: qrImage,
                width: 184,
                height: 184,
                draggable: false,
                alt: labels.qrLabel,
                onError: () => setQrUnavailable(true),
              }),
              el('figcaption', null, labels.scan)),
          el('p', { className: 'todo-support-note' }, labels.note))));
  };
}
