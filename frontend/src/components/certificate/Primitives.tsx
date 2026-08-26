'use client';

import { CheckCircle2, XCircle, HelpCircle, AlertTriangle } from 'lucide-react';
import type { MarkStatus } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import { translateFinding, findingsBySeverity, type Finding, type Severity } from '@/lib/findings';

/**
 * Shared presentation pieces for the certificate views.
 *
 * Every certificate is a different shape — a tachometer reports two points in
 * tr/min, a multimeter forty-seven across seven ranges, and a poorly scanned
 * document may yield none at all. These primitives all render a missing value
 * as an explicit dash rather than collapsing to an empty cell, so a field the
 * pipeline could not read is visibly absent instead of silently blank.
 */

export function Field({
  label,
  value,
  tone,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  tone?: string;
  mono?: boolean;
}) {
  const missing = value === null || value === undefined || value === '';
  return (
    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
      <div className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</div>
      <div
        className={`text-xs font-semibold break-words ${mono ? 'font-mono' : ''} ${
          missing ? 'text-slate-600' : tone || 'text-white'
        }`}
      >
        {missing ? 'non renseigné' : value}
      </div>
    </div>
  );
}

export function Section({
  title,
  icon,
  children,
  subtitle,
}: {
  title: string;
  icon?: React.ReactNode;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-panel rounded-3xl border border-slate-800 p-6 space-y-4">
      <div className="space-y-0.5">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          {icon}
          {title}
        </h2>
        {subtitle && <p className="text-[11px] text-slate-400">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

const MARK_STYLES: Record<MarkStatus, { text: string; chip: string; label: string; icon: React.ReactNode }> = {
  PRESENT: {
    text: 'text-emerald-300',
    chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    label: 'Présent',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  ABSENT: {
    text: 'text-rose-300',
    chip: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    label: 'Absent',
    icon: <XCircle className="w-3.5 h-3.5" />,
  },
  NOT_VERIFIABLE: {
    text: 'text-amber-300',
    chip: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    label: 'Non vérifiable',
    icon: <HelpCircle className="w-3.5 h-3.5" />,
  },
};

/**
 * A cachet or signature verdict.
 *
 * "Non vérifiable" is deliberately distinct from "Absent": a greyscale scan
 * destroys the colour that separates stamped ink from print, so the platform
 * says it could not tell rather than asserting the mark is missing.
 */
export function MarkBadge({ status }: { status?: MarkStatus | string }) {
  const style = MARK_STYLES[(status as MarkStatus) ?? 'NOT_VERIFIABLE'] ?? MARK_STYLES.NOT_VERIFIABLE;
  return (
    <span
      className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 w-fit ${style.chip}`}
    >
      {style.icon} {style.label}
    </span>
  );
}

export function VerdictBadge({ value, kind }: { value?: string; kind: 'conformity' | 'recommendation' }) {
  const good = kind === 'conformity' ? ['CONFORME'] : ['VALIDATED'];
  const bad = kind === 'conformity' ? ['NON_CONFORME'] : ['REJECTED'];

  const tone = !value
    ? 'bg-slate-700/40 text-slate-300 border-slate-600/40'
    : good.includes(value)
    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
    : bad.includes(value)
    ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
    : 'bg-amber-500/15 text-amber-300 border-amber-500/30';

  return (
    <span className={`px-3 py-1 rounded-full text-[11px] font-bold border ${tone}`}>
      {value || 'INDÉTERMINÉ'}
    </span>
  );
}

export function IssueList({
  items,
  variant,
  title,
}: {
  items?: string[];
  variant: 'blocking' | 'warning' | 'info';
  title: string;
}) {
  if (!items?.length) return null;

  const style = {
    blocking: {
      head: 'text-rose-300',
      box: 'bg-rose-500/10 border-rose-500/25 text-rose-200',
      icon: <XCircle className="w-3.5 h-3.5" />,
    },
    warning: {
      head: 'text-amber-300',
      box: 'bg-amber-500/10 border-amber-500/25 text-amber-200',
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
    },
    info: {
      head: 'text-slate-300',
      box: 'bg-slate-800/60 border-slate-700 text-slate-300',
      icon: <HelpCircle className="w-3.5 h-3.5" />,
    },
  }[variant];

  return (
    <div className="space-y-1.5">
      <p className={`text-xs font-bold flex items-center gap-1.5 ${style.head}`}>
        {style.icon} {title} ({items.length})
      </p>
      {items.map((item, i) => (
        <div key={i} className={`p-2.5 rounded-lg border text-[11px] ${style.box}`}>
          {item}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="p-6 text-center space-y-1">
      <p className="text-xs font-semibold text-slate-400">{message}</p>
      {hint && <p className="text-[11px] text-slate-600">{hint}</p>}
    </div>
  );
}


/**
 * Findings rendered in the reader's language.
 *
 * Prefers the structured `findings` array, which carries a code and its
 * params. Falls back to the backend's English strings when a certificate was
 * extracted before codes existed, so old records still display.
 */
export function FindingList({
  findings,
  fallback,
  severity,
  title,
}: {
  findings?: Finding[];
  fallback?: string[];
  severity: Severity;
  title: string;
}) {
  const { lang } = useLanguage();

  const structured = findingsBySeverity(findings, severity);
  const items = structured.length
    ? structured.map((f) => translateFinding(f, lang))
    : fallback || [];

  const variant = severity === 'BLOCKING' ? 'blocking' : severity === 'WARNING' ? 'warning' : 'info';
  return <IssueList items={items} variant={variant} title={title} />;
}
