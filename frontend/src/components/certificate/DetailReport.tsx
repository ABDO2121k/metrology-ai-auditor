'use client';

import {
  Building2, CalendarClock, Thermometer, Landmark, Stamp, ScanSearch, Info,
} from 'lucide-react';
import { Certificate, CertificateOCR } from '@/lib/api';
import { Field, Section, MarkBadge, IssueList, EmptyState } from './Primitives';

/**
 * The evidence behind the verdict: identity, dates, conditions, traceability,
 * what the visual inspection actually measured, and how the extraction ran.
 */
export default function DetailReport({
  certificate,
  ocr,
}: {
  certificate: Certificate | null;
  ocr: CertificateOCR | null;
}) {
  const extraction = ocr?.extraction;
  const payload = extraction?.universal_payload;
  const validation = extraction?.ai_validation;
  const diagnostics = extraction?.diagnostics;

  const device = payload?.client_and_device;
  const dates = payload?.dates_and_conditions;
  const doc = payload?.document_info;
  const visual = payload?.visual_validation;
  const standards = payload?.reference_standards_audit ?? [];

  return (
    <div className="space-y-6">
      <Section title="Client et instrument" icon={<Building2 className="w-5 h-5 text-cyan-400" />}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Client" value={device?.client_name || certificate?.client_name} />
          <Field label="Adresse" value={device?.client_address} />
          <Field label="Désignation" value={device?.device_designation || certificate?.instrument_name} />
          <Field label="Fabricant" value={device?.manufacturer} />
          <Field label="Modèle" value={device?.model} />
          <Field label="N° de série" value={device?.serial_number || certificate?.instrument_serial} mono />
          <Field label="Code interne" value={device?.internal_code} mono />
          <Field label="Domaine" value={doc?.domain} />
          <Field label="Code formulaire" value={doc?.form_code} mono />
        </div>
      </Section>

      <Section title="Document" icon={<ScanSearch className="w-5 h-5 text-emerald-400" />}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="N° certificat" value={doc?.certificate_number || certificate?.certificate_number} mono />
          <Field label="Fichier d'origine" value={certificate?.original_filename} />
          <Field
            label="Pages annoncées / extraites"
            value={doc ? `${doc.announced_pages} / ${doc.extracted_pages}` : null}
            tone={doc?.page_integrity_pass ? 'text-emerald-300' : 'text-amber-300'}
          />
          <Field label="Amendement" value={doc ? (doc.is_amendment ? 'Oui' : 'Non') : null} />
          <Field label="Remplace" value={doc?.superseded_certificate} mono />
          <Field label="Empreinte SHA-256" value={certificate?.file_hash_sha256?.slice(0, 24)} mono />
        </div>
      </Section>

      <Section
        title="Dates et chronologie"
        icon={<CalendarClock className="w-5 h-5 text-cyan-400" />}
        subtitle="Étalonnage ≤ émission ≤ validation < prochain étalonnage"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Date d'étalonnage" value={dates?.calibration_date} />
          <Field label="Date d'émission" value={dates?.issue_date} />
          <Field label="Date de validation" value={dates?.validation_date} />
          <Field label="Prochain étalonnage" value={dates?.next_calibration_date} />
        </div>
        {dates?.chronology_issues?.length ? (
          <IssueList items={dates.chronology_issues} variant="blocking" title="Incohérences de chronologie" />
        ) : (
          <p className="text-[11px] text-slate-500">Aucune incohérence de chronologie détectée.</p>
        )}
      </Section>

      <Section
        title="Conditions ambiantes"
        icon={<Thermometer className="w-5 h-5 text-amber-400" />}
        subtitle="23 °C ± 2 °C · humidité ≤ 80 %HR"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Température (relevé)" value={dates?.ambient_temperature} />
          <Field
            label="Température (valeur)"
            value={dates?.temperature_celsius != null ? `${dates.temperature_celsius} °C` : null}
          />
          <Field label="Humidité (relevé)" value={dates?.ambient_humidity} />
          <Field
            label="Humidité (valeur)"
            value={dates?.humidity_percent != null ? `${dates.humidity_percent} %HR` : null}
          />
        </div>
      </Section>

      <Section
        title="Traçabilité — étalons de référence"
        icon={<Landmark className="w-5 h-5 text-purple-400" />}
        subtitle="Un étalon expiré à la date d'étalonnage bloque la validation"
      >
        {standards.length === 0 ? (
          <EmptyState
            message="Aucun étalon de référence n'a été identifié"
            hint="Le bloc de traçabilité n'a pas pu être lu sur ce document."
          />
        ) : (
          <div className="space-y-2">
            {standards.map((std: any, i: number) => (
              <div
                key={i}
                className={`p-3 rounded-xl border text-[11px] flex flex-wrap justify-between gap-3 ${
                  std.is_valid_at_calibration
                    ? 'bg-slate-950 border-slate-800 text-slate-300'
                    : 'bg-rose-500/10 border-rose-500/25 text-rose-200'
                }`}
              >
                <span className="font-semibold">{std.designation}</span>
                <span className="font-mono">{std.connection_code || '—'}</span>
                <span>Validité : {std.validity_date || 'non renseignée'}</span>
                <span className={std.is_valid_at_calibration ? 'text-emerald-300' : 'text-rose-300'}>
                  {std.is_valid_at_calibration ? 'Valide' : 'Expiré'}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* What the visual inspection actually measured, not just its verdict. */}
      <Section
        title="Inspection visuelle — cachet et signature"
        icon={<Stamp className="w-5 h-5 text-cyan-400" />}
        subtitle="Un cachet est une empreinte d'encre : il est cherché dans les pixels, pas dans le texte"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="text-[10px] text-slate-400 uppercase tracking-wide">Cachet de validation</div>
            <MarkBadge status={visual?.validation_stamp_status} />
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="text-[10px] text-slate-400 uppercase tracking-wide">Signature</div>
            <MarkBadge status={visual?.signature_status} />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field
            label="Numérisation couleur"
            value={visual ? (visual.colour_capable_scan ? 'Oui' : 'Non (niveaux de gris)') : null}
            tone={visual?.colour_capable_scan ? 'text-emerald-300' : 'text-amber-300'}
          />
          <Field
            label="Encre couleur — en-tête"
            value={visual ? `${visual.letterhead_colour_percent}%` : null}
          />
          <Field
            label="Encre couleur — zone de validation"
            value={visual ? `${visual.validation_zone_colour_percent}%` : null}
          />
          <Field
            label="Marques détectées"
            value={visual?.marks_found_on_pages?.length ? `pages ${visual.marks_found_on_pages.join(', ')}` : null}
          />
          <Field label="Opérateur" value={visual?.operator_name} />
          <Field label="Approbateur" value={visual?.approver_name} />
        </div>

        {visual?.evidence_notes?.length ? (
          <IssueList items={visual.evidence_notes} variant="info" title="Constat de l'inspection" />
        ) : null}
      </Section>

      {validation && (
        <Section title="Toutes les observations" icon={<Info className="w-5 h-5 text-slate-400" />}>
          <IssueList items={validation.critical_issues} variant="blocking" title="Anomalies bloquantes" />
          <IssueList items={validation.warnings} variant="warning" title="Avertissements" />
          <IssueList items={validation.suggestions} variant="info" title="Suggestions" />
          {!validation.critical_issues?.length &&
            !validation.warnings?.length &&
            !validation.suggestions?.length && (
              <p className="text-[11px] text-slate-500">Aucune observation.</p>
            )}
        </Section>
      )}

      {diagnostics && (
        <Section
          title="Diagnostic d'extraction"
          icon={<ScanSearch className="w-5 h-5 text-slate-400" />}
          subtitle="Comment ce résultat a été obtenu"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
              label="Taille du rendu"
              value={`${Math.round((diagnostics.render_bytes_total || 0) / 1024)} Ko`}
            />
            <Field label="Erreur vision" value={diagnostics.vision_error} />
          </div>

          {diagnostics.disagreements?.length ? (
            <IssueList
              items={diagnostics.disagreements}
              variant="warning"
              title="Désaccords entre lectures"
            />
          ) : null}

          {diagnostics.field_provenance?.length > 0 && (
            <div className="overflow-x-auto border border-slate-800 rounded-2xl">
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
                      <td className="p-2 text-slate-200 max-w-[220px] truncate">
                        {p.value || <span className="text-slate-600">—</span>}
                      </td>
                      <td className="p-2 text-slate-400">{p.source}</td>
                      <td className="p-2 text-slate-400">{Math.round((p.confidence || 0) * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}
    </div>
  );
}
