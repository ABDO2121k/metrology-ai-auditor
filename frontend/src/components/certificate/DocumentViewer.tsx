'use client';

import { useEffect, useState, useCallback } from 'react';
import { FileText, X, Download, ExternalLink, Loader2, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';

/**
 * The scanned certificate itself, next to the audit of it.
 *
 * Several findings end in "confirm it visually" — the cachet especially, which
 * is reported NOT_VERIFIABLE on any greyscale scan. That instruction is
 * impossible to follow without the page on screen, and the file is not
 * otherwise reachable: MinIO publishes no port in production and the route
 * requires an Authorization header, so the PDF is fetched as a blob and shown
 * from an object URL.
 */
export default function DocumentViewer({
  certificateId,
  filename,
}: {
  certificateId: string;
  filename?: string;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (url || loading) return;
    setLoading(true);
    setError('');
    try {
      setUrl(await api.getCertificateDocumentURL(certificateId));
    } catch (err: any) {
      setError(err?.message || 'Document indisponible');
    } finally {
      setLoading(false);
    }
  }, [certificateId, url, loading]);

  // Release the blob when the component goes away, or the browser holds the
  // whole PDF in memory for the rest of the session.
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  // Escape closes the overlay, as expected of a modal.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const openViewer = async () => {
    setOpen(true);
    await load();
  };

  return (
    <>
      <button
        onClick={openViewer}
        className="px-3 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-xs flex items-center gap-2 transition"
        title="Afficher le document scanné"
      >
        <FileText className="w-3.5 h-3.5" /> Voir le document
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col p-3 md:p-6"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex-1 flex flex-col min-h-0 max-w-6xl w-full mx-auto glass-panel rounded-2xl border border-slate-700 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-800 shrink-0">
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate flex items-center gap-2">
                  <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                  {filename || 'Document'}
                </p>
                <p className="text-[10px] text-slate-400">
                  Comparez le document au rapport d'audit — cachet, signature, pages et tableau de mesures
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {url && (
                  <>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                      title="Ouvrir dans un nouvel onglet"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <a
                      href={url}
                      download={filename || `${certificateId}.pdf`}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                      title="Télécharger"
                    >
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

            <div className="flex-1 min-h-0 bg-slate-950">
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

              {url && !loading && !error && (
                // <object> degrades to its children when the browser has no
                // PDF plugin, which <iframe> does not do.
                <object data={url} type="application/pdf" className="w-full h-full">
                  <div className="h-full flex items-center justify-center p-6">
                    <div className="text-center space-y-3">
                      <p className="text-xs text-slate-400">
                        Votre navigateur ne peut pas afficher le PDF directement.
                      </p>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-xs font-semibold"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Ouvrir dans un nouvel onglet
                      </a>
                    </div>
                  </div>
                </object>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
