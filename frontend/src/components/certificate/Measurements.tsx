'use client';

import { useMemo, useState } from 'react';
import { Beaker, CheckCircle2, XCircle, HelpCircle, ArrowDownUp } from 'lucide-react';
import { CertificateOCR, MeasurementPoint } from '@/lib/api';
import { Section, EmptyState } from './Primitives';

/**
 * The measurement table, grouped by unit.
 *
 * Certificates are not one shape: a tachometer reports two points in tr/min, an
 * earth tester reports ohm and kilohm sections, and a multimeter is calibrated
 * across V, mV, A, mA and uA at once. Grouping by unit keeps each range legible
 * instead of interleaving incomparable quantities in one flat list, and the
 * layout adapts to however many sections a given certificate happens to carry.
 */

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  // Metrology values span many orders of magnitude (0.0005 V to 800 V), so
  // fixed decimal places would either truncate or add noise.
  const abs = Math.abs(value);
  if (abs !== 0 && (abs < 0.0001 || abs >= 1e7)) return value.toExponential(4);
  return String(Number(value.toFixed(6)));
}

function VerdictCell({ point }: { point: MeasurementPoint }) {
  // A point with no printed EMT has nothing to test against. Showing a green
  // tick there would claim a pass that was never assessed.
  if (point.conformity_decided === false) {
    return (
      <span
        className="text-amber-400 font-bold flex items-center gap-1 whitespace-nowrap"
        title="Aucun EMT imprimé sur le certificat pour ce point"
      >
        <HelpCircle className="w-3 h-3" /> Indéterminé
      </span>
    );
  }
  return point.is_conforme ? (
    <span className="text-emerald-400 font-bold flex items-center gap-1 whitespace-nowrap">
      <CheckCircle2 className="w-3 h-3" /> Conforme
    </span>
  ) : (
    <span className="text-rose-400 font-bold flex items-center gap-1 whitespace-nowrap">
      <XCircle className="w-3 h-3" /> Non conforme
    </span>
  );
}

export default function Measurements({ ocr }: { ocr: CertificateOCR | null }) {
  const points = ocr?.measurements ?? [];
  const conformityDecided =
    (ocr?.extraction?.universal_payload?.metrological_audit?.conformity_status ??
      ocr?.conformity_status) !== 'INDETERMINE';

  const groups = useMemo(() => {
    const byUnit = new Map<string, MeasurementPoint[]>();
    for (const p of points) {
      const key = p.unit || 'sans unité';
      if (!byUnit.has(key)) byUnit.set(key, []);
      byUnit.get(key)!.push(p);
    }
    return Array.from(byUnit.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [points]);

  const [activeUnit, setActiveUnit] = useState<string>('ALL');

  const visibleGroups = activeUnit === 'ALL' ? groups : groups.filter(([u]) => u === activeUnit);

  if (points.length === 0) {
    return (
      <Section title="Points de mesure" icon={<Beaker className="w-5 h-5 text-emerald-400" />}>
        <EmptyState
          message="Aucun point de mesure n'a pu être extrait de ce certificat"
          hint="Le tableau n'a pas été reconnu de façon fiable. Activez la couche vision (OPENAI_API_KEY) ou saisissez les points manuellement."
        />
      </Section>
    );
  }

  const decidedPoints = points.filter((p) => p.conformity_decided !== false);
  const nonConforme = decidedPoints.filter((p) => !p.is_conforme).length;
  const undecided = points.length - decidedPoints.length;

  return (
    <div className="space-y-6">
      <Section
        title={`Points de mesure (${points.length})`}
        icon={<Beaker className="w-5 h-5 text-emerald-400" />}
        subtitle={
          groups.length > 1
            ? `${groups.length} grandeurs mesurées sur ce certificat`
            : 'Erreur, correction et bande de garde recalculées à partir des valeurs extraites'
        }
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase">Total points</div>
            <div className="text-xl font-extrabold text-white">{points.length}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase">Grandeurs</div>
            <div className="text-xl font-extrabold text-cyan-400">{groups.length}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase">Non conformes</div>
            <div className={`text-xl font-extrabold ${nonConforme ? 'text-rose-400' : 'text-emerald-400'}`}>
              {decidedPoints.length ? nonConforme : '—'}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase">Sans EMT</div>
            <div className={`text-xl font-extrabold ${undecided ? 'text-amber-400' : 'text-slate-300'}`}>
              {undecided}
            </div>
          </div>
        </div>

        {undecided > 0 && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-200">
            {undecided} point(s) ne portent pas d'EMT sur le certificat : la règle
            |Correction| + U ≤ EMT n'a rien à quoi se comparer, donc aucun verdict
            de conformité n'est prononcé pour ceux-là.
          </div>
        )}
        {!conformityDecided && decidedPoints.length === 0 && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-200">
            Les colonnes ont été déduites sans en-têtes de tableau : les valeurs sont
            affichées telles qu'extraites.
          </div>
        )}

        {/* Range filter — only worth showing when there is more than one. */}
        {groups.length > 1 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveUnit('ALL')}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition ${
                activeUnit === 'ALL'
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              Toutes ({points.length})
            </button>
            {groups.map(([unit, rows]) => (
              <button
                key={unit}
                onClick={() => setActiveUnit(unit)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition ${
                  activeUnit === unit
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                {unit} ({rows.length})
              </button>
            ))}
          </div>
        )}
      </Section>

      {visibleGroups.map(([unit, rows]) => (
        <Section
          key={unit}
          title={`Grandeur : ${unit}`}
          icon={<ArrowDownUp className="w-5 h-5 text-cyan-400" />}
          subtitle={`${rows.length} point${rows.length > 1 ? 's' : ''} · règle |Correction| + U ≤ EMT`}
        >
          <div className="overflow-x-auto border border-slate-800 rounded-2xl">
            <table className="w-full text-xs whitespace-nowrap">
              <thead className="bg-slate-950 text-slate-300">
                <tr>
                  <th className="p-3 text-left">#</th>
                  <th className="p-3 text-left">Grandeur</th>
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
                {rows.map((m) => (
                  <tr
                    key={`${unit}-${m.point_index}`}
                    className={`border-t border-slate-800 text-slate-200 ${
                      m.conformity_decided !== false && !m.is_conforme ? 'bg-rose-500/5' : ''
                    }`}
                  >
                    <td className="p-3">{m.point_index}</td>
                    <td className="p-3 text-slate-400">{m.parameter || '—'}</td>
                    <td className="p-3">{formatNumber(m.reference_value)}</td>
                    <td className="p-3">{formatNumber(m.measured_value)}</td>
                    <td className="p-3">{formatNumber(m.calculated_error)}</td>
                    <td className="p-3">{formatNumber(m.calculated_correction)}</td>
                    <td className="p-3">{formatNumber(m.expanded_uncertainty_u)}</td>
                    <td className="p-3">{formatNumber(m.emt_limit)}</td>
                    <td className="p-3 font-semibold">{formatNumber(m.guard_band_sum)}</td>
                    <td className="p-3">
                      <VerdictCell point={m} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      ))}
    </div>
  );
}
