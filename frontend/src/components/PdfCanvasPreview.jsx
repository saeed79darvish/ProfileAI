import { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { CircularProgress } from '@mui/material';

/**
 * PdfCanvasPreview — renders a PDF (data: or blob: URL) to <canvas> elements.
 *
 * Why this exists: mobile Safari (iOS) refuses to render a
 * `data:application/pdf` (or even blob) PDF inside an <iframe> — the frame just
 * shows blank. To give mobile users a real preview we rasterise each page with
 * pdf.js onto a canvas. pdf.js is heavy, so it's dynamically imported here and
 * this whole component is only mounted on small screens.
 */

const Wrap = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  background: #f1f5f9;
  overflow: hidden;
`;

const Pages = styled.div`
  width: 100%;
  height: 100%;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 10px;

  canvas {
    width: 100%;
    height: auto;
    max-width: 100%;
    border-radius: 4px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.12);
    background: #fff;
  }
`;

const Overlay = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #6b7280;
  font-size: 14px;
  font-weight: 500;
  text-align: center;
  padding: 16px;
  background: #f1f5f9;
`;

export default function PdfCanvasPreview({ url, title }) {
  const wrapRef = useRef(null);
  const pagesRef = useRef(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  // Track the container's real pixel width so we render at the correct
  // resolution. Mobile Safari sometimes lays this out to 0 during the modal
  // open animation, which used to produce a "blank" (120px, clamped) canvas
  // that never re-rendered. Now we watch the container size and retrigger
  // the pdf.js render as soon as we have a real width to draw into.
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = pagesRef.current;
    if (!el) return undefined;

    const measure = () => {
      const w = el.clientWidth;
      if (w > 0) setContainerWidth(w);
    };
    measure();

    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let loadingTask = null;

    async function render() {
      if (!url) return;
      // Wait until we have a real container width. We render at 240px
      // minimum (retina-friendly) so a "blank" flash never ships.
      if (containerWidth < 100) {
        setStatus('loading');
        return;
      }
      setStatus('loading');
      try {
        const pdfjs = await import('pdfjs-dist');
        // Vite-friendly worker URL (bundled as a separate asset).
        const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

        loadingTask = pdfjs.getDocument(url);
        const pdf = await loadingTask.promise;
        if (cancelled) return;

        const container = pagesRef.current;
        if (!container) return;
        container.innerHTML = '';

        // Render at a crisp scale capped to the container width.
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const usable = Math.max(containerWidth - 20, 240); // minus horizontal padding

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          if (cancelled) return;

          const baseViewport = page.getViewport({ scale: 1 });
          const scale = (usable / baseViewport.width) * dpr;
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          container.appendChild(canvas);

          await page.render({ canvasContext: ctx, viewport }).promise;
          if (cancelled) return;
        }

        if (!cancelled) setStatus('ready');
      } catch (err) {
        console.error('PDF canvas render error:', err);
        if (!cancelled) setStatus('error');
      }
    }

    render();

    return () => {
      cancelled = true;
      try { loadingTask?.destroy?.(); } catch { /* ignore */ }
    };
  }, [url, containerWidth]);

  const openInNewTab = () => {
    if (!url) return;
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch { /* ignore */ }
  };

  return (
    <Wrap ref={wrapRef}>
      <Pages ref={pagesRef} aria-label={title || 'Resume preview'} />
      {status === 'loading' && (
        <Overlay>
          <CircularProgress size={28} sx={{ color: '#4f46e5' }} />
          <span>Rendering preview…</span>
        </Overlay>
      )}
      {status === 'error' && (
        <Overlay>
          <span>Couldn’t render the preview here.</span>
          <button
            type="button"
            onClick={openInNewTab}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid #6366f1',
              background: '#6366f1',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Open PDF in new tab
          </button>
        </Overlay>
      )}
    </Wrap>
  );
}
