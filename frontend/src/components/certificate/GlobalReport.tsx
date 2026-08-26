'use client';

import {
  Gauge, ShieldCheck, Stamp, PenLine, FileCheck2, Layers, AlertTriangle,
} from 'lucide-react';
import { Certificate, CertificateOCR } from '@/lib/api';
import { Field, Section, MarkBadge, VerdictBadge, FindingList } from './Primitives';
import { useLanguage } from '@/context/LanguageContext';

/**
 * The one-screen answer: may this certificate be validated, and if not, why.
 *
 * Everything here is a conclusion. The evidence behind each conclusion lives in
 * the detailed report, and the numbers behind the conformity verdict live in
 * the measurements view.
 */
export default function GlobalReport({
  certificate,
  ocr,
}: {
  certificate: Certificate | null;
  ocr: CertificateOCR | null;
}) {
  const extraction = ocr?.extraction;
  const payload = extraction?.universal_payload;
  const validation = extraction?.ai_validation;
  const visual = payload?.visual_validation;
  const audit = payload?.metrological_audit;
  const decision = payload?.ai_decision;
  const { t } = useLanguage();

  const blocking: string[] = validation?.critical_issues ?? [];
  const warnings: string[] = validation?.warnings ?? [];
  const pointCount = ocr?.measurements?.length ?? 0;

  return (
    <div className="space-y-6">
      <Section
        title="Décision d'audit"
        icon={<ShieldCheck className="w-5 h-5 text-cyan-400" />}
        subtitle="Synthèse de la vérification ISO/IEC 17025"
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Recommandation</p>
            <VerdictBadge value={decision?.validation_recommendation} kind="recommendation" />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Conformité</p>
            <VerdictBadge value={audit?.conformity_status} kind="conformity" />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Confiance extraction</p>
            <span className="px-3 py-1 rounded-full text-[11px] font-bold border bg-slate-800 text-slate-200 border-slate-700">
              {validation ? `${Math.round((validation.confidence_score || 0) * 100)}%` : '—'}
              {validation?.extraction_quality ? ` · ${validation.extraction_quality}` : ''}
            </span>
          </div>
        </div>

        {/* A count of zero is a finding in its own right, not an empty table. */}
        {pointCount === 0 && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-200 flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              Aucun point de mesure n'a pu être extrait : la conformité métrologique
              n'a pas pu être prononcée pour ce certificat.
            </span>
          </div>
        )}

        {audit?.conformity_status === 'INDETERMINE' && pointCount > 0 && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-200 flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              Les colonnes du tableau ont été déduites sans en-têtes : les points sont
              affichés pour revue mais aucun verdict de conformité n'est prononcé.
            </span>
          </div>
        )}
      </Section>

      <Section
        title="Contrôles réglementaires"
        icon={<FileCheck2 className="w-5 h-5 text-emerald-400" />}
        subtitle="Cachet, signature, intégrité documentaire et chronologie"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="text-[10px] text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
              <Stamp className="w-3.5 h-3.5 text-cyan-400" /> Cachet de validation
            </div>
            <MarkBadge status={visual?.validation_stamp_status} />
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="text-[10px] text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
              <PenLine className="w-3.5 h-3.5 text-cyan-400" /> Signature
            </div>
            <MarkBadge status={visual?.signature_status} />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field
            label="Intégrité des pages"
            value={
              payload?.document_info
                ? `${payload.document_info.announced_pages} annoncées / ${payload.document_info.extracted_pages} extraites`
                : null
            }
            tone={payload?.document_info?.page_integrity_pass ? 'text-emerald-300' : 'text-amber-300'}
          />
          <Field
            label="Chronologie"
            value={payload?.dates_and_conditions ? (payload.dates_and_conditions.chronology_valid ? 'Cohérente' : 'Incohérente') : null}
            tone={payload?.dates_and_conditions?.chronology_valid ? 'text-emerald-300' : 'text-rose-300'}
          />
          <Field
            label="Conditions ambiantes"
            value={payload?.dates_and_conditions ? (payload.dates_and_conditions.conditions_valid ? 'Dans les limites' : 'Hors limites') : null}
            tone={payload?.dates_and_conditions?.conditions_valid ? 'text-emerald-300' : 'text-amber-300'}
          />
          <Field
            label="Étalon de référence"
            value={
              payload?.reference_standards_audit?.length
                ? payload.reference_standards_audit.every((s: any) => s.is_valid_at_calibration)
                  ? 'Valide à la date'
                  : 'Expiré'
                : null
            }
            tone={
              payload?.reference_standards_audit?.every((s: any) => s.is_valid_at_calibration)
                ? 'text-emerald-300'
                : 'text-rose-300'
            }
          />
        </div>
      </Section>

      <Section
        title="Chiffres clés"
        icon={<Gauge className="w-5 h-5 text-cyan-400" />}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Points audités" value={pointCount || '0'} />
          <Field label="Points non conformes" value={audit?.non_conforme_points ?? '—'} tone={audit?.non_conforme_points ? 'text-rose-300' : undefined} />
          <Field label="Écarts de calcul" value={audit?.math_errors_detected ?? '—'} tone={audit?.math_errors_detected ? 'text-amber-300' : undefined} />
          <Field label="Domaine" value={payload?.document_info?.domain} />
        </div>
      </Section>

      {(blocking.length > 0 || warnings.length > 0) && (
        <Section title="Anomalies" icon={<Layers className="w-5 h-5 text-rose-400" />}>
          <FindingList
            findings={validation?.findings}
            fallback={blocking}
            severity="BLOCKING"
            title={t('findingsBlocking')}
          />
          <FindingList
            findings={validation?.findings}
            fallback={warnings}
            severity="WARNING"
            title={t('findingsWarnings')}
          />
        </Section>
      )}
    </div>
  );
}
