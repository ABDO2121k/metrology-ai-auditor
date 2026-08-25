'use client';

import { useState, useEffect, useCallback } from 'react';
import { Server, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Activity } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { api } from '@/lib/api';

interface ServiceHealth {
  name: string;
  port: number;
  container: string;
  type: string;
  status: string;
  latency: number;
  detail?: string;
}

/**
 * Status presentation.
 *
 * The gateway now reports what it actually measured. Previously it forced
 * every entry to "healthy", so this page showed 9/9 green even with services
 * down — the single most misleading thing an operations view can do.
 */
const STATUS_STYLE: Record<string, { chip: string; icon: React.ReactNode; label: string }> = {
  healthy: {
    chip: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    label: 'Opérationnel',
  },
  degraded: {
    chip: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    label: 'Dégradé',
  },
  unhealthy: {
    chip: 'text-rose-400 bg-rose-500/15 border-rose-500/30',
    icon: <XCircle className="w-3.5 h-3.5" />,
    label: 'En erreur',
  },
  unreachable: {
    chip: 'text-rose-400 bg-rose-500/15 border-rose-500/30',
    icon: <XCircle className="w-3.5 h-3.5" />,
    label: 'Injoignable',
  },
};

export default function DockerMetricsPage() {
  const { t } = useLanguage();
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [healthy, setHealthy] = useState(0);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await api.systemHealth();
      setServices(data.services || []);
      setHealthy(data.healthy_count ?? 0);
      setTotal(data.total_count ?? 0);
    } catch (e: any) {
      setError(e?.message || 'Impossible de contacter la passerelle');
      setServices([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]);

  const allHealthy = total > 0 && healthy === total;

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-white">{t('dockerTitle')}</h1>
            <p className="text-xs text-slate-400">{t('dockerSub')}</p>
          </div>
        </div>

        <button
          onClick={load}
          className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-2 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /> {t('btnRefresh')}
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2">
          <XCircle className="w-4 h-4" /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {t('dockerHealthyCount')}
          </div>
          <p className={`text-3xl font-extrabold ${allHealthy ? 'text-emerald-400' : 'text-amber-400'}`}>
            {healthy}/{total || '—'}
          </p>
        </div>
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {t('dockerClusterStatus')}
          </div>
          <p className={`text-lg font-extrabold ${allHealthy ? 'text-emerald-400' : 'text-amber-400'}`}>
            {allHealthy ? 'TOUS OPÉRATIONNELS' : 'DÉGRADÉ'}
          </p>
        </div>
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Latence moyenne
          </div>
          <p className="text-3xl font-extrabold text-cyan-400">
            {services.length
              ? `${Math.round(services.reduce((s, x) => s + x.latency, 0) / services.length)} ms`
              : '—'}
          </p>
        </div>
      </div>

      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left rtl:text-right text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-4">Service</th>
                <th className="p-4">Conteneur</th>
                <th className="p-4">Type</th>
                <th className="p-4">Port</th>
                <th className="p-4">Latence</th>
                <th className="p-4">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading && services.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Interrogation des services…
                  </td>
                </tr>
              ) : services.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    <Activity className="w-6 h-6 mx-auto mb-2 text-slate-600" />
                    Aucune donnée de santé disponible
                  </td>
                </tr>
              ) : (
                services.map((svc) => {
                  const style = STATUS_STYLE[svc.status] || STATUS_STYLE.unreachable;
                  return (
                    <tr key={svc.container} className="hover:bg-slate-800/30 transition">
                      <td className="p-4 font-bold text-white">{svc.name}</td>
                      <td className="p-4 text-slate-400 font-mono text-[11px]">{svc.container}</td>
                      <td className="p-4 text-slate-400">{svc.type}</td>
                      <td className="p-4 text-slate-400 font-mono">{svc.port}</td>
                      <td className="p-4 text-slate-400">{svc.latency} ms</td>
                      <td className="p-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold border flex items-center gap-1 w-fit ${style.chip}`}
                          title={svc.detail}
                        >
                          {style.icon} {style.label}
                        </span>
                        {svc.detail && (
                          <div className="text-[10px] text-slate-500 mt-1 max-w-[260px] truncate">
                            {svc.detail}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
