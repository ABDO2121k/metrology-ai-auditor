'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, FileText, RefreshCw, ScanLine, XCircle, Loader2,
  ShieldCheck, ClipboardList, Beaker,
} from 'lucide-react';
import { api, Certificate, CertificateOCR } from '@/lib/api';
import GlobalReport from '@/components/certificate/GlobalReport';
import DetailReport from '@/components/certificate/DetailReport';
import Measurements from '@/components/certificate/Measurements';

const IN_PROGRESS = new Set(['PENDING_OCR', 'OCR_PROCESSING']);

/**
 * One certificate, in three separated views.
 *
 *   Synthèse         - the decision and the controls behind it
 *   Rapport détaillé - the evidence: identity, dates, conditions, traceability,
 *                      visual inspection, extraction diagnostics
 *   Mesures          - the measurement table, grouped by quantity
 *
 * The page previously stacked all of this into one scroll, which buried the
 * verdict under diagnostics and made a 47-point multimeter unreadable.
 */
const TABS = [
  { id: 'summary', label: 'Synthèse', Icon: ShieldCheck },
  { id: 'detail', label: 'Rapport détaillé', Icon: ClipboardList },
  { id: 'measures', label: 'Mesures', Icon: Beaker },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function CertificateDetailsPage() {
  const params = useParams<{ id: string }>();
  const certificateId = useMemo(() => params?.id || '', [params]);

  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [ocr, setOcr] = useState<CertificateOCR | null>(null);
  const [loading, setLoading] = useState(true);
  const [reprocessing, setReprocessing] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<TabId>('summary');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Read the stored extraction. This never triggers a new OCR run: extraction
   * happens once at upload, so viewing a certificate costs nothing.
   */
  const load = useCallback(
    async (showSpinner = true) => {
      if (!certificateId) return;
      if (showSpinner) setLoading(true);
      setError('');
      try {
        const cert = await api.getCertificate(certificateId);
        setCertificate(cert);
        try {
          setOcr(await api.getCertificateOCR(certificateId));
        } catch {
          // An extraction still running is expected, not an error.
          setOcr(null);
        }
      } catch (err: any) {
        setError(err?.message || 'Impossible de charger le certificat');
      } finally {
        setLoading(false);
      }
    },
    [certificateId],
  );

  useEffect(() => {
    load();
  }, [load]);

  // Follow a background extraction to completion without a manual refresh.
  useEffect(() => {
    const busy = certificate ? IN_PROGRESS.has(certificate.status) : false;
    if (busy && !pollRef.current) {
      pollRef.current = setInterval(() => load(false), 4000);
    } else if (!busy && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [certificate, load]);

  const handleReprocess = async () => {
    setReprocessing(true);
    try {
      await api.reprocessCertificate(certificateId);
      await load(false);
    } catch (err: any) {
      setError(err?.message || 'Relance impossible');
    } finally {
      setReprocessing(false);
    }
  };

  if (loading && !certificate) {
    return (
      <div className="glass-panel rounded-3xl border border-slate-800 p-8 text-center text-slate-300">
        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-3" />
        Chargement du certificat…
      </div>
    );
  }

  if (error && !certificate) {
    return (
      <div className="space-y-4">
        <Link href="/certificates" className="inline-flex items-center gap-2 text-cyan-300 text-sm">
          <ArrowLeft className="w-4 h-4" /> Retour au registre
        </Link>
        <div className="glass-panel rounded-3xl border border-rose-500/30 p-6 text-rose-300">{error}</div>
      </div>
    );
  }

  const busy = certificate ? IN_PROGRESS.has(certificate.status) : false;
  const pointCount = ocr?.measurements?.length ?? 0;

  return (
    <div className="space-y-6 py-2">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Link href="/certificates" className="inline-flex items-center gap-2 text-cyan-300 text-sm">
          <ArrowLeft className="w-4 h-4" /> Retour au registre
        </Link>
        <div className="flex gap-2">
          <button
            onClick={() => load()}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-2 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Actualiser
          </button>
          <button
            onClick={handleReprocess}
            disabled={reprocessing || busy}
            className="px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs flex items-center gap-2 transition disabled:opacity-40"
          >
            <ScanLine className={`w-3.5 h-3.5 ${reprocessing ? 'animate-pulse' : ''}`} /> Relancer l'OCR
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Identity header — always visible, whichever view is open. */}
      <div className="glass-panel rounded-3xl border border-slate-800 p-6 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-400" />
            {certificate?.certificate_number}
          </h1>
          <span className="px-3 py-1 rounded-full text-[11px] font-bold border bg-slate-800 text-slate-300 border-slate-700">
            {certificate?.status}
          </span>
        </div>
        <p className="text-xs text-slate-400">
          {certificate?.client_name || 'Client non renseigné'}
          {certificate?.instrument_name ? ` · ${certificate.instrument_name}` : ''}
          {certificate?.original_filename ? ` · ${certificate.original_filename}` : ''}
        </p>
      </div>

      {busy && (
        <div className="glass-panel rounded-3xl border border-blue-500/30 p-6 flex items-center gap-3 text-blue-300">
          <Loader2 className="w-5 h-5 animate-spin" />
          <div className="text-xs">
            <p className="font-bold">Extraction OCR en cours…</p>
            <p className="text-slate-400">
              L'analyse d'un certificat scanné prend généralement 30 à 90 secondes. Cette page se
              met à jour automatiquement.
            </p>
          </div>
        </div>
      )}

      {certificate?.status === 'OCR_FAILED' && (
        <div className="glass-panel rounded-3xl border border-rose-500/30 p-6 space-y-2 text-rose-300">
          <p className="font-bold text-sm flex items-center gap-2">
            <XCircle className="w-4 h-4" /> L'extraction a échoué
          </p>
          <p className="text-xs font-mono break-words text-rose-200/80">
            {certificate.ocr_error || 'Erreur inconnue'}
          </p>
        </div>
      )}

      {/* View selector */}
      <div className="flex flex-wrap gap-2">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold border flex items-center gap-2 transition ${
              tab === id
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
            {id === 'measures' && ocr ? (
              <span className="text-[10px] font-semibold text-slate-500">({pointCount})</span>
            ) : null}
          </button>
        ))}
      </div>

      {!ocr && !busy ? (
        <div className="glass-panel rounded-3xl border border-slate-800 p-8 text-center text-slate-400 text-xs">
          Aucun résultat d'extraction disponible pour ce certificat.
        </div>
      ) : (
        <>
          {tab === 'summary' && <GlobalReport certificate={certificate} ocr={ocr} />}
          {tab === 'detail' && <DetailReport certificate={certificate} ocr={ocr} />}
          {tab === 'measures' && <Measurements ocr={ocr} />}
        </>
      )}
    </div>
  );
}
