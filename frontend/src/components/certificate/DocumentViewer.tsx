'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  FileText, X, Download, ExternalLink, Loader2, AlertTriangle,
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw, Maximize2,
} from 'lucide-react';
import { api } from '@/lib/api';

/**
 * The scanned certificate, rendered page by page next to the audit of it.
 *
 * Several findings end in "confirm it visually" — the cachet especially, which
 * reads NOT_VERIFIABLE on any greyscale scan — and a technician cannot follow
 * that instruction without the page in front of them, at a zoom level where an
 * ink impression is actually distinguishable.
 *
 * pdf.js renders to canvas rather than handing the file to the browser's
 * built-in plugin, so page navigation, zoom and rotation behave the same on
 * every browser, including the mobile ones that otherwise refuse to display an
 * embedded PDF at all.
 *
 * The file is fetched as a blob because MinIO publishes no port in production
 * and the route requires an Authorization header, which no <embed src> sends.
 */

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

export default function DocumentViewer({
  certificateId,
  filename,
}: {
  certificateId: string;
  filename?: string;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [pdf, setPdf] = useState<any>(null);
  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [rendering, setRendering] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // pdf.js rejects a render task if another is already running on the canvas,
  // which happens easily when paging quickly.
  const taskRef = useRef<any>(null);

  const loadDocument = useCallback(async () => {
    if (pdf || loading) return;
    setLoading(true);
    setError('');
    try {
      const blobUrl = await api.getCertificateDocumentURL(certificateId);
      setUrl(blobUrl);

      // Imported here, not at module scope: pdf.js touches DOM APIs and would
      // break the server render otherwise.
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

      const doc = await pdfjs.getDocument({ url: blobUrl }).promise;
      setPdf(doc);
      setPageCount(doc.numPages);
      setPage(1);
    } catch (err: any) {
      setError(err?.message || 'Document indisponible');
    } finally {
      setLoading(false);
    }
  }, [certificateId, pdf, loading]);

  // Draw the current page whenever it, the zoom or the rotation changes.
  useEffect(() => {
    if (!pdf || !open) return;
    let cancelled = false;

    (async () => {
      setRendering(true);
      try {
        if (taskRef.current) {
          taskRef.current.cancel();
          taskRef.current = null;
        }

        const pageObj = await pdf.getPage(page);
        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        // Render at device resolution so text stays sharp on high-DPI phones.
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = pageObj.getViewport({ scale: zoom * dpr, rotation });

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / dpr}px`;
        canvas.style.height = `${viewport.height / dpr}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        taskRef.current = pageObj.render({ canvasContext: ctx, viewport });
        await taskRef.current.promise;
        taskRef.current = null;
      } catch (err: any) {
        // Cancelling a render to start a newer one is expected, not an error.
        if (!cancelled && err?.name !== 'RenderingCancelledException') {
          setError(err?.message || 'Impossible d’afficher cette page');
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdf, page, zoom, rotation, open]);

  // Fit the page to the available width — the sane default on a phone.
  const fitToWidth = useCallback(async () => {
    if (!pdf || !scrollRef.current) return;
    const pageObj = await pdf.getPage(page);
    const base = pageObj.getViewport({ scale: 1, rotation });
    const available = scrollRef.current.clientWidth - 32;
    setZoom(Math.max(0.25, Math.min(4, available / base.width)));
  }, [pdf, page, rotation]);

  useEffect(() => {
    if (pdf && open) fitToWidth();
    // Only on first load of a document, not on every page turn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdf, open]);

  // Free the blob and the parsed document, or the whole PDF stays in memory.
  useEffect(() => {
    return () => {
      if (taskRef.current) taskRef.current.cancel();
      if (pdf) pdf.destroy?.();
      if (url) URL.revokeObjectURL(url);
    };
  }, [pdf, url]);

  const goto = useCallback(
    (n: number) => setPage((p) => Math.min(pageCount || 1, Math.max(1, n || p))),
    [pageCount],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      else if (e.key === 'ArrowRight' || e.key === 'PageDown') goto(page + 1);
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') goto(page - 1);
      else if (e.key === '+' || e.key === '=') setZoom((z) => ZOOM_STEPS.find((s) => s > z) ?? z);
      else if (e.key === '-') setZoom((z) => [...ZOOM_STEPS].reverse().find((s) => s < z) ?? z);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, page, goto]);

  const btn =
    'p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition disabled:opacity-30 disabled:cursor-not-allowed';

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
          loadDocument();
        }}
        className="px-3 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-xs flex items-center gap-2 transition"
        title="Afficher le document scanné"
      >
        <FileText className="w-3.5 h-3.5" /> Voir le document
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col p-2 md:p-5"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex-1 flex flex-col min-h-0 max-w-6xl w-full mx-auto glass-panel rounded-2xl border border-slate-700 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-slate-800 shrink-0 flex-wrap">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate flex items-center gap-2">
                  <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                  {filename || 'Document'}
                </p>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button className={btn} onClick={() => goto(page - 1)} disabled={page <= 1} title="Page précédente (←)">
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-1 text-[11px] text-slate-300 px-1">
                  <input
                    type="number"
                    min={1}
                    max={pageCount || 1}
                    value={page}
                    onChange={(e) => goto(parseInt(e.target.value, 10))}
                    className="w-12 px-1.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-center text-white outline-none focus:border-cyan-500"
                    aria-label="Numéro de page"
                  />
                  <span className="text-slate-500">/ {pageCount || '—'}</span>
                </div>

                <button className={btn} onClick={() => goto(page + 1)} disabled={page >= pageCount} title="Page suivante (→)">
                  <ChevronRight className="w-4 h-4" />
                </button>

                <span className="w-px h-5 bg-slate-700 mx-0.5" />

                <button
                  className={btn}
                  onClick={() => setZoom((z) => [...ZOOM_STEPS].reverse().find((s) => s < z) ?? z)}
                  disabled={zoom <= ZOOM_STEPS[0]}
                  title="Zoom arrière (-)"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-[11px] text-slate-400 w-11 text-center tabular-nums">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  className={btn}
                  onClick={() => setZoom((z) => ZOOM_STEPS.find((s) => s > z) ?? z)}
                  disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}
                  title="Zoom avant (+)"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button className={btn} onClick={fitToWidth} title="Ajuster à la largeur">
                  <Maximize2 className="w-4 h-4" />
                </button>
                <button className={btn} onClick={() => setRotation((r) => (r + 90) % 360)} title="Pivoter">
                  <RotateCw className="w-4 h-4" />
                </button>

                <span className="w-px h-5 bg-slate-700 mx-0.5" />

                {url && (
                  <>
                    <a href={url} target="_blank" rel="noopener noreferrer" className={btn} title="Ouvrir dans un onglet">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <a href={url} download={filename || `${certificateId}.pdf`} className={btn} title="Télécharger">
                      <Download className="w-4 h-4" />
                    </a>
                  </>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition"
                  title="Fermer (Échap)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Page canvas */}
            <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto bg-slate-950 p-4">
              {loading && (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" /> Chargement du document…
                </div>
              )}

              {error && !loading && (
                <div className="h-full flex items-center justify-center p-6">
                  <div className="max-w-md text-center space-y-2">
                    <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
                    <p className="text-sm font-bold text-rose-300">{error}</p>
                    <p className="text-[11px] text-slate-500">
                      Le fichier a peut-être été supprimé du stockage objet.
                    </p>
                  </div>
                </div>
              )}

              {pdf && !error && (
                <div className="flex justify-center">
                  <div className="relative">
                    {rendering && (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-950/50 z-10">
                        <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                      </div>
                    )}
                    <canvas ref={canvasRef} className="shadow-2xl rounded-sm bg-white max-w-none" />
                  </div>
                </div>
              )}
            </div>

            <div className="px-3 py-1.5 border-t border-slate-800 text-[10px] text-slate-500 shrink-0 hidden md:block">
              ← → pour naviguer · + / − pour zoomer · Échap pour fermer
            </div>
          </div>
        </div>
      )}
    </>
  );
}
