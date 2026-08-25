'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Upload, FileSpreadsheet, Users, Server, RefreshCw,
  AlertTriangle, CheckCircle2, ArrowRight, ShieldCheck, HelpCircle,
  Activity, FileCheck2, XCircle, Gauge,
} from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { api, AuthUser, CertificateStats, Certificate, getUser } from '@/lib/api';

interface KpiProps {
  label: string;
  value: string | number;
  sub?: string;
  tone: 'cyan' | 'emerald' | 'amber' | 'rose' | 'purple';
  icon: React.ReactNode;
}

// Tailwind only ships classes it can see in source, so the tone styles are
// written out in full rather than interpolated. The previous dashboard built
// class names like `text-${color}-400`, which Tailwind never generated — those
// KPI numbers rendered unstyled.
const TONES: Record<KpiProps['tone'], { text: string; border: string }> = {
  cyan: { text: 'text-cyan-400', border: 'border-cyan-500/30' },
  emerald: { text: 'text-emerald-400', border: 'border-emerald-500/30' },
  amber: { text: 'text-amber-400', border: 'border-amber-500/30' },
  rose: { text: 'text-rose-400', border: 'border-rose-500/30' },
  purple: { text: 'text-purple-400', border: 'border-purple-500/30' },
};

function Kpi({ label, value, sub, tone, icon }: KpiProps) {
  const style = TONES[tone];
  return (
    <div className={`glass-panel p-5 rounded-2xl border border-slate-800 space-y-2`}>
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex justify-between items-center gap-2">
        <span>{label}</span>
        <span className={style.text}>{icon}</span>
      </div>
      <p className={`text-3xl font-extrabold ${style.text}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-500 font-semibold">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const { t } = useLanguage();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [stats, setStats] = useState<CertificateStats | null>(null);
  const [recent, setRecent] = useState<Certificate[]>([]);
  const [userCount, setUserCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Every panel is optional: one failing endpoint should not blank the
      // whole dashboard, so failures are tolerated per-request.
      const [statsRes, certsRes, usersRes] = await Promise.allSettled([
        api.certificateStats(),
        api.listCertificates(),
        api.listUsers(),
      ]);

      if (statsRes.status === 'fulfilled') setStats(statsRes.value);
      else setError('Statistiques indisponibles');

      if (certsRes.status === 'fulfilled') setRecent(certsRes.value.slice(0, 6));
      if (usersRes.status === 'fulfilled') setUserCount(usersRes.value.length);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setUser(getUser());
    load();
  }, [load]);

  // Only meaningful once something has actually been judged: a set of purely
  // INDETERMINE certificates has no compliance rate, and showing 0% or 100%
  // would both be wrong.
  const hasJudged = (stats?.judged_points ?? 0) > 0;
  const compliance = stats && hasJudged ? Math.round(stats.compliance_percent) : null;

  return (
    <div className="space-y-8 py-4">
      <div className="glass-panel p-6 md:p-8 rounded-3xl border border-slate-800 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-start justify-between relative z-10 gap-4 flex-wrap">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border bg-cyan-500/15 text-cyan-300 border-cyan-500/30">
              <ShieldCheck className="w-3.5 h-3.5" /> {t('role_TECHNICIAN')}
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white">
              {t('dashboardWelcome')},{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
                {user?.full_name?.split(' ')[0] || user?.username || '—'}
              </span>
            </h1>
            <p className="text-xs text-slate-400">{t('dashboardSubtitle')}</p>
          </div>

          <button
            onClick={load}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-2 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> {t('btnRefresh')}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Every figure below is read from the database. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi
          label={t('statTotalCerts')}
          value={stats?.total_certificates ?? '—'}
          sub={t('statTotalCertsSub')}
          tone="cyan"
          icon={<FileCheck2 className="w-3.5 h-3.5" />}
        />
        <Kpi
          label={t('dashboardTechKpi2')}
          value={stats?.pending ?? '—'}
          sub={t('kpiPendingSub')}
          tone="amber"
          icon={<Activity className="w-3.5 h-3.5" />}
        />
        <Kpi
          label={t('statCompliancePass')}
          value={compliance === null ? '—' : `${compliance}%`}
          sub={
            hasJudged
              ? `${stats?.conforme_points}/${stats?.judged_points} ${t('kpiJudgedSub')}`
              : t('kpiNoneJudged')
          }
          tone={hasJudged ? 'emerald' : 'amber'}
          icon={<CheckCircle2 className="w-3.5 h-3.5" />}
        />
        <Kpi
          label={t('dashboardTechKpi4')}
          value={stats?.blocking_anomalies ?? '—'}
          sub={t('kpiAnomaliesSub')}
          tone="rose"
          icon={<AlertTriangle className="w-3.5 h-3.5" />}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi
          label={t('kpiPointsAudited')}
          value={stats?.total_points ?? '—'}
          sub={hasJudged ? `${stats?.judged_points} ${t('kpiJudgedSub')}` : t('kpiNoneJudged')}
          tone="cyan"
          icon={<Gauge className="w-3.5 h-3.5" />}
        />
        <Kpi
          label={t('kpiFlagged')}
          value={stats?.flagged ?? '—'}
          tone="amber"
          icon={<AlertTriangle className="w-3.5 h-3.5" />}
        />
        <Kpi
          label={t('kpiUndecided')}
          value={stats?.undecided_certificates ?? '—'}
          sub={t('kpiUndecidedSub')}
          tone="amber"
          icon={<HelpCircle className="w-3.5 h-3.5" />}
        />
        <Kpi
          label={t('kpiFailed')}
          value={stats?.failed ?? '—'}
          sub={t('kpiFailedSub')}
          tone="rose"
          icon={<XCircle className="w-3.5 h-3.5" />}
        />
        <Kpi
          label={t('statTotalUsers')}
          value={userCount ?? '—'}
          sub={t('statTotalUsersSub')}
          tone="purple"
          icon={<Users className="w-3.5 h-3.5" />}
        />
      </div>

      {/* Recent activity */}
      <div className="glass-panel rounded-3xl border border-slate-800 p-5 space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> {t('dashboardRecent')}
          </h3>
          <Link href="/certificates" className="text-xs font-bold text-cyan-400 hover:underline">
            {t('navCerts')} →
          </Link>
        </div>

        {loading && recent.length === 0 ? (
          <p className="text-xs text-slate-500 py-4">{t('certsLoading')}</p>
        ) : recent.length === 0 ? (
          <p className="text-xs text-slate-500 py-4">{t('certsEmpty')}</p>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {recent.map((cert) => (
              <Link
                key={cert.id}
                href={`/certificates/${cert.id}`}
                className="flex items-center justify-between gap-3 py-2.5 hover:bg-slate-800/30 rounded-lg px-2 transition"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-cyan-300 font-mono truncate">
                    {cert.certificate_number}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate">
                    {cert.client_name || cert.original_filename}
                  </p>
                </div>
                <span className="text-[10px] font-bold text-slate-400 shrink-0">{cert.status}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3">
        <h3 className="text-sm font-bold text-white">{t('dashboardQuickLinks')}</h3>
        <div className="flex flex-wrap gap-3">
          <Link href="/upload" className="px-4 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold flex items-center gap-2 transition">
            <Upload className="w-3.5 h-3.5" /> {t('navUpload')} <ArrowRight className="w-3 h-3 rtl:rotate-180" />
          </Link>
          <Link href="/certificates" className="px-4 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-2 transition">
            <FileSpreadsheet className="w-3.5 h-3.5" /> {t('navCerts')} <ArrowRight className="w-3 h-3 rtl:rotate-180" />
          </Link>
          <Link href="/admin/users" className="px-4 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-semibold flex items-center gap-2 transition">
            <Users className="w-3.5 h-3.5" /> {t('navUsers')} <ArrowRight className="w-3 h-3 rtl:rotate-180" />
          </Link>
          <Link href="/admin/docker-metrics" className="px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-2 transition">
            <Server className="w-3.5 h-3.5" /> {t('navHealth')} <ArrowRight className="w-3 h-3 rtl:rotate-180" />
          </Link>
        </div>
      </div>
    </div>
  );
}
