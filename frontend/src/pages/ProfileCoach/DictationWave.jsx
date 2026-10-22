import React, { useEffect, useRef, useState } from 'react';

/**
 * The live waveform shown in the composer while dictating.
 *
 * Your own voice, scrolling right to left: each bar is the microphone level
 * at a moment, so you can see it is hearing you (and when it is not) without
 * reading the words. A timer beside it, because a recording with no sense of
 * length makes people rush.
 *
 * Canvas, redrawn every frame from a ref; the parent never re-renders for it.
 */
const BAR_GAP = 3;
const BAR_W = 3;
const SAMPLE_MS = 60;

const formatTime = (ms) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const DictationWave = ({ levelRef, className }) => {
  const canvasRef = useRef(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const history = [];
    const started = performance.now();
    let lastSample = 0;
    let raf = 0;

    const draw = (now) => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      const max = Math.floor(w / (BAR_W + BAR_GAP));
      if (now - lastSample > SAMPLE_MS) {
        lastSample = now;
        history.push(levelRef?.current || 0);
        while (history.length > max) history.shift();
        setElapsed(now - started);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      // Newest on the right; older bars fade as they move left.
      for (let i = 0; i < history.length; i += 1) {
        const level = reduce ? Math.min(history[i], 0.3) : history[i];
        const barH = Math.max(3, level * h);
        const x = w - (history.length - i) * (BAR_W + BAR_GAP);
        ctx.globalAlpha = 0.35 + 0.65 * (i / Math.max(1, history.length - 1));
        ctx.fillStyle = '#dc2626';
        const y = (h - barH) / 2;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, BAR_W, barH, BAR_W / 2);
        else ctx.rect(x, y, BAR_W, barH);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [levelRef]);

  return (
    <span className={className}>
      <canvas ref={canvasRef} aria-hidden="true" />
      <span className="time" aria-live="off">{formatTime(elapsed)}</span>
    </span>
  );
};

export default DictationWave;
