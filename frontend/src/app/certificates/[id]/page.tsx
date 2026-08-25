'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, FileText, RefreshCw, ScanLine, AlertTriangle, CheckCircle2,
  XCircle, Info, Loader2, Gauge, Beaker, Calendar,
} from 'lucide-react';
import { api, Certificate, CertificateOCR } from '@/lib/api';

const IN_PROGRESS = new Set(['PENDING_OCR', 'OCR_PROCESSING']);

function Field({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
      <div className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</div>
      <div className={`text-xs font-semibold break-words ${tone || 'text-white'}`}>
        {value === null || value === undefined || value === '' ? (
          <span className="text-slate-600">—</span>
        ) : (
          value
        )}
      </div>
    </div>
  );
}

export default function CertificateDetailsPage() {
  const params = useParams<{ id: string }>();
  const certificateId = useMemo(() => params?.id || '', [params]);

  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [ocr, setOcr] = useState<CertificateOCR | null>(null);
  const [loading, setLoading] = useState(true);
  const [reprocessing, setReprocessing] = useState(false);
  const [error, setError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Read the stored extraction.
   *
   * This page used to POST to /ocr/parse on every mount, which re-ran a
   * multi-second OCR pass (and, with a vision key configured, re-billed it)
   * just to look at a certificate. Extraction now happens once at upload and
   * the result is read back from the database.
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
          // An extraction that has not finished yet is expected, not an error.
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

  const extraction = ocr?.extraction;
  const payload = extraction?.universal_payload;
  const validation = extraction?.ai_validation;
  const diagnostics = extraction?.diagnostics;
  const busy = certificate ? IN_PROGRESS.has(certificate.status) : false;

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

      {/* Document identity */}
      <div className="glass-panel rounded-3xl border border-slate-800 p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-400" />
            {certificate?.certificate_number}
          </h1>
          <span className="px-3 py-1 rounded-full text-[11px] font-bold border bg-slate-800 text-slate-300 border-slate-700">
            {certificate?.status}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Fichier" value={certificate?.original_filename} />
          <Field label="Client" value={certificate?.client_name} />
          <Field label="Instrument" value={certificate?.instrument_name} />
          <Field label="N° de série" value={certificate?.instrument_serial} />
          <Field label="Date d'étalonnage" value={certificate?.calibration_date} />
          <Field label="Date d'émission" value={certificate?.issue_date} />
        </div>
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

      {/* Audit verdict */}
      {validation && (
        <div className="glass-panel rounded-3xl border border-slate-800 p-6 space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Gauge className="w-5 h-5 text-cyan-400" /> Verdict de l'audit
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field
              label="Recommandation"
              value={payload?.ai_decision?.validation_recommendation}
              tone={
                payload?.ai_decision?.validation_recommendation === 'VALIDATED'
                  ? 'text-emerald-300'
                  : payload?.ai_decision?.validation_recommendation === 'REJECTED'
                  ? 'text-rose-300'
                  : 'text-amber-300'
              }
            />
            <Field
              label="Conformité"
              value={payload?.metrological_audit?.conformity_status}
              tone={
                payload?.metrological_audit?.conformity_status === 'CONFORME'
                  ? 'text-emerald-300'
                  : payload?.metrological_audit?.conformity_status === 'NON_CONFORME'
                  ? 'text-rose-300'
                  : 'text-amber-300'
              }
            />
            <Field
              label="Qualité d'extraction"
              value={validation.extraction_quality}
              tone={
                ['EXCELLENT', 'HIGH'].includes(validation.extraction_quality)
                  ? 'text-emerald-300'
                  : validation.extraction_quality === 'MEDIUM'
                  ? 'text-amber-300'
                  : 'text-rose-300'
              }
            />
            <Field
              label="Confiance"
              value={`${Math.round((validation.confidence_score || 0) * 100)}%`}
            />
          </div>

          {validation.critical_issues?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Anomalies bloquantes (
                {validation.critical_issues.length})
              </p>
              {validation.critical_issues.map((issue: string, i: number) => (
                <div
                  key={i}
                  className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/25 text-[11px] text-rose-200"
                >
                  {issue}
                </div>
              ))}
            </div>
          )}

          {validation.warnings?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Avertissements ({validation.warnings.length})
              </p>
              {validation.warnings.map((warning: string, i: number) => (
                <div
                  key={i}
                  className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-200"
                >
                  {warning}
                </div>
              ))}
            </div>
          )}

          {validation.suggestions?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" /> Suggestions
              </p>
              {validation.suggestions.map((s: string, i: number) => (
                <div
                  key={i}
                  className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700 text-[11px] text-slate-300"
                >
                  {s}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Conditions & traceability */}
      {payload && (
        <div className="glass-panel rounded-3xl border border-slate-800 p-6 space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-400" /> Conditions & traçabilité
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="Domaine" value={payload.document_info?.domain} />
            <Field
              label="Pages (annoncées / extraites)"
              value={`${payload.document_info?.announced_pages ?? '—'} / ${
                payload.document_info?.extracted_pages ?? '—'
              }`}
              tone={payload.document_info?.page_integrity_pass ? 'text-emerald-300' : 'text-rose-300'}
            />
            <Field label="Température" value={payload.dates_and_conditions?.ambient_temperature} />
            <Field label="Humidité" value={payload.dates_and_conditions?.ambient_humidity} />
            <Field
              label="Tampon / cachet"
              value={payload.visual_validation?.validation_stamp_present ? 'Présent' : 'Absent'}
              tone={
                payload.visual_validation?.validation_stamp_present
                  ? 'text-emerald-300'
                  : 'text-rose-300'
              }
            />
            <Field
              label="Signature"
              value={payload.visual_validation?.signatures_present ? 'Présente' : 'Absente'}
              tone={
                payload.visual_validation?.signatures_present ? 'text-emerald-300' : 'text-rose-300'
              }
            />
            <Field label="Amendement" value={payload.document_info?.is_amendment ? 'Oui' : 'Non'} />
            <Field
              label="Remplace"
              value={payload.document_info?.superseded_certificate}
            />
          </div>

          {payload.reference_standards_audit?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-slate-300">Étalons de référence</p>
              {payload.reference_standards_audit.map((std: any, i: number) => (
                <div
                  key={i}
                  className={`p-2.5 rounded-lg border text-[11px] flex justify-between gap-3 flex-wrap ${
                    std.is_valid_at_calibration
                      ? 'bg-slate-800/60 border-slate-700 text-slate-300'
                      : 'bg-rose-500/10 border-rose-500/25 text-rose-200'
                  }`}
                >
                  <span>
                    {std.designation} {std.connection_code ? `(${std.connection_code})` : ''}
                  </span>
                  <span>Validité : {std.validity_date || '—'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Measurement table */}
      <div className="glass-panel rounded-3xl border border-slate-800 p-6 space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Beaker className="w-5 h-5 text-emerald-400" />
          Points de mesure {ocr?.measurements?.length ? `(${ocr.measurements.length})` : ''}
        </h2>

        {!ocr?.measurements?.length ? (
          <p className="text-slate-400 text-xs">
            {busy
              ? 'Extraction en cours…'
              : "Aucun point de mesure n'a pu être extrait de ce certificat."}
          </p>
        ) : (
          <div className="overflow-x-auto border border-slate-800 rounded-2xl">
            <table className="w-full text-xs whitespace-nowrap">
              <thead className="bg-slate-950 text-slate-300">
                <tr>
                  <th className="p-3 text-left">#</th>
                  <th className="p-3 text-left">Grandeur</th>
                  <th className="p-3 text-left">Unité</th>
                  <th className="p-3 text-left">Référence</th>
                  <th className="p-3 text-left">Mesuré</th>
                  <th className="p-3 text-left">Erreur</th>
                  <th className="p-3 text-left">Correction</th>
                  <th className="p-3 text-left">U (k=2)</th>
                  <th className="p-3 text-left">EMT</th>
                  <th className="p-3 text-left">|Corr|+U</th>
                  <th className="p-3 text-left">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {ocr.measurements.map((m) => (
                  <tr key={m.point_index} className="border-t border-slate-800 text-slate-200">
                    <td className="p-3">{m.point_index}</td>
                    <td className="p-3 text-slate-400">{m.parameter || '—'}</td>
                    <td className="p-3 text-slate-400">{m.unit || '—'}</td>
                    <td className="p-3">{m.reference_value}</td>
                    <td className="p-3">{m.measured_value}</td>
                    <td className="p-3">{m.calculated_error}</td>
                    <td className="p-3">{m.calculated_correction}</td>
                    <td className="p-3">{m.expanded_uncertainty_u}</td>
                    <td className="p-3">{m.emt_limit}</td>
                    <td className="p-3">{m.guard_band_sum}</td>
                    <td className="p-3">
                      {m.is_conforme ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Conforme
                        </span>
                      ) : (
                        <span className="text-rose-400 font-bold flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> Non conforme
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* How the extraction was produced */}
      {diagnostics && (
        <details className="glass-panel rounded-3xl border border-slate-800 p-6">
          <summary className="text-sm font-bold text-white cursor-pointer">
            Diagnostic d'extraction
          </summary>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            <Field label="Moteurs" value={diagnostics.engine_pipeline?.join(' → ')} />
            <Field label="Modèle vision" value={diagnostics.vision_model || 'non utilisé'} />
            <Field
              label="Confiance OCR"
              value={
                diagnostics.ocr_mean_confidence != null
                  ? `${Math.round(diagnostics.ocr_mean_confidence * 100)}%`
                  : null
              }
            />
            <Field label="Durée" value={`${((diagnostics.duration_ms || 0) / 1000).toFixed(1)} s`} />
            <Field label="Pages rendues" value={diagnostics.pages_rendered} />
            <Field label="Caractères OCR" value={diagnostics.ocr_chars} />
            <Field
              label="Taille rendu"
              value={`${Math.round((diagnostics.render_bytes_total || 0) / 1024)} Ko`}
            />
            <Field label="Erreur vision" value={diagnostics.vision_error} />
          </div>

          {diagnostics.field_provenance?.length > 0 && (
            <div className="mt-4 overflow-x-auto border border-slate-800 rounded-2xl">
              <table className="w-full text-[11px]">
                <thead className="bg-slate-950 text-slate-400">
                  <tr>
                    <th className="p-2 text-left">Champ</th>
                    <th className="p-2 text-left">Valeur</th>
                    <th className="p-2 text-left">Source</th>
                    <th className="p-2 text-left">Confiance</th>
                  </tr>
                </thead>
                <tbody>
                  {diagnostics.field_provenance.map((p: any, i: number) => (
                    <tr key={i} className="border-t border-slate-800">
                      <td className="p-2 text-slate-400">{p.field}</td>
                      <td className="p-2 text-slate-200 max-w-[220px] truncate">{p.value || '—'}</td>
                      <td className="p-2 text-slate-400">{p.source}</td>
                      <td className="p-2 text-slate-400">{Math.round((p.confidence || 0) * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </details>
      )}
    </div>
  );
}
