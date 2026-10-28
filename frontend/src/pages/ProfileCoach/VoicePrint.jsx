import React, { useEffect, useRef } from 'react';

/**
 * Remi's voiceprint: the ProfilleAI mark with a ring of rounded bars.
 *
 * It replaced a soft gradient orb that looked like every other voice
 * assistant's. The mark in the middle is ours, and the ring says what the
 * call is doing at a glance:
 *   speaking    the bars move with Remi's real output level
 *   listening   a wave travels round the ring (there is no mic level to
 *               follow, so it keeps a steady, attentive rhythm)
 *   connecting  a light chases round the ring
 *   muted       the ring goes quiet and grey
 *
 * Canvas, one frame per display refresh. Props are read through refs so the
 * loop is started once and never re-created by a level change.
 */

const BARS = 36;
const BRAND = {
  back: '#C9CCE9',
  from: '#6A5BD0',
  to: '#241C61',
  accent: '#5A4BB4',
  idle: '#D9DBEE',
};

/* A spring, so bars overshoot a touch and settle like physical things. */
const spring = (k, d) => ({
  x: 0.1,
  v: 0,
  step(target, dt) {
    this.v += (k * (target - this.x) - d * this.v) * dt;
    this.x += this.v * dt;
    return this.x;
  },
});

const roundRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

const VoicePrint = ({ mode = 'listening', level = 0, className }) => {
  const canvasRef = useRef(null);
  const modeRef = useRef(mode);
  const levelRef = useRef(level);
  modeRef.current = mode;
  levelRef.current = level;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const bars = Array.from({ length: BARS }, () => spring(220, 16));
    const smooth = spring(260, 18);
    const fade = spring(60, 14);
    let size = 0;
    let dpr = 1;
    let t = 0;
    let last = performance.now();
    let raf = 0;

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      const rect = canvas.getBoundingClientRect();
      size = rect.width;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    };
    resize();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    observer?.observe(canvas);

    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      const current = modeRef.current;
      const lvl = Math.max(0, smooth.step(current === 'speaking' ? levelRef.current : 0, dt));
      const gray = fade.step(current === 'muted' ? 1 : 0, dt);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      const cx = size / 2;
      const cy = size / 2;
      const ring = size * 0.3;

      // The mark: breathing while listening, swelling a touch with the voice.
      const tile = size * 0.2;
      const radius = tile * 0.24;
      const breathe = current === 'listening' && !reduce ? 1 + 0.03 * Math.sin(t * 1.6) : 1 + lvl * 0.05;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(breathe, breathe);
      ctx.globalAlpha = 1 - gray * 0.45;
      roundRect(ctx, -tile * 0.85, -tile * 0.85, tile, tile, radius);
      ctx.fillStyle = BRAND.back;
      ctx.fill();
      const gradient = ctx.createLinearGradient(-tile * 0.15, -tile * 0.15, tile * 0.85, tile * 0.85);
      gradient.addColorStop(0, BRAND.from);
      gradient.addColorStop(1, BRAND.to);
      roundRect(ctx, -tile * 0.15, -tile * 0.15, tile, tile, radius);
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.restore();

      // The ring.
      for (let i = 0; i < BARS; i += 1) {
        const angle = (i / BARS) * Math.PI * 2 - Math.PI / 2;
        let target = 0.08;
        if (current === 'speaking') {
          // Each bar its own texture, all of them scaled by the real level.
          const texture = 0.55 + 0.45 * Math.abs(Math.sin(t * 7.3 + i * 1.7) * Math.sin(t * 3.1 + i * 0.6));
          // A floor of motion, so the ring still reads as talking on a
          // browser that reports no output level at all.
          target = 0.14 + Math.max(lvl, 0.18) * 0.95 * texture;
        } else if (current === 'listening') {
          target = 0.12 + 0.45 * Math.max(0, Math.sin(angle * 2 - t * 3.2)) ** 3;
        } else if (current === 'connecting') {
          const head = (t * 1.6) % 1;
          const behind = ((i / BARS) - head + 1) % 1;
          target = 0.1 + 0.55 * Math.max(0, 1 - behind * 6);
        }
        const h = Math.max(0.06, bars[i].step(reduce ? Math.min(target, 0.3) : target, dt));
        const length = size * 0.16 * h;
        const width = size * 0.026;
        ctx.save();
        ctx.translate(cx + Math.cos(angle) * ring, cy + Math.sin(angle) * ring);
        ctx.rotate(angle + Math.PI / 2);
        ctx.globalAlpha = (0.35 + Math.min(1, h) * 0.65) * (1 - gray * 0.4);
        roundRect(ctx, -width / 2, -length, width, length, width / 2);
        ctx.fillStyle = gray > 0.5 ? BRAND.idle : (i % 2 ? BRAND.from : BRAND.accent);
        ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
};

export default VoicePrint;
