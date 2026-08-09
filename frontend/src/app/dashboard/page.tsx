'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Upload, FileSpreadsheet, Layers, PieChart, Users, Server,
  FileCheck, BarChart3, UserCheck, Activity, Zap, FileCheck2,
  AlertTriangle, CheckCircle2, ArrowRight, ShieldCheck
} from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export default function DashboardPage() {
  const { t } = useLanguage();
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string>('');
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [realUsers, setRealUsers] = useState<any[]>([]);

  useEffect(() => {
    const u = localStorage.getItem('jwt_user');
    const tok = localStorage.getItem('jwt_token');
    if (u && tok) {
      try {
        const parsed = JSON.parse(u);
        setUser(parsed);
        setToken(tok);
        if (parsed.role === 'ADMINISTRATOR') {
          fetchAdminData(tok);
        }
      } catch (e) {}
    }
  }, []);

  const fetchAdminData = async (jwtToken: string) => {
    try {
      const [aRes, uRes] = await Promise.all([
        fetch('http://localhost:8000/api/v1/analytics/dashboard', {
          headers: { 'Authorization': `Bearer ${jwtToken}` }
        }),
        fetch('http://localhost:8000/api/v1/admin/users', {
          headers: { 'Authorization': `Bearer ${jwtToken}` }
        })
      ]);
      if (aRes.ok) setAnalyticsData(await aRes.json());
      if (uRes.ok) setRealUsers(await uRes.json());
    } catch (e) {}
  };

  const role = user?.role || 'GUEST';

  return (
    <div className="space-y-8 py-4">

      {/* Welcome Banner */}
      <div className="glass-panel p-6 md:p-8 rounded-3xl border border-slate-800 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex items-start justify-between relative z-10">
          <div className="space-y-1">
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border ${
              role === 'ADMINISTRATOR' ? 'bg-purple-500/15 text-purple-300 border-purple-500/30' :
              role === 'DIRECTOR' ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' :
              role === 'VALIDATOR' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' :
              'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
            }`}>
              <ShieldCheck className="w-3.5 h-3.5" /> {t('role_' + role)}
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white">
              {t('dashboardWelcome')}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">{user?.full_name?.split(' ')[0] || user?.username}</span>
            </h1>
            <p className="text-xs text-slate-400">{t('dashboardSubtitle')}</p>
          </div>
        </div>
      </div>

      {/* === ADMINISTRATOR DASHBOARD === */}
      {role === 'ADMINISTRATOR' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-extrabold text-white mb-1 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-400" /> {t('adminDashboardTitle')}
            </h2>
            <p className="text-xs text-slate-400">{t('adminDashboardSub')}</p>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex justify-between items-center">
                <span>{t('statConnectedUsers')}</span>
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <p className="text-3xl font-extrabold text-emerald-400">{analyticsData?.connected_users_count ?? 1}</p>
              <p className="text-[10px] text-emerald-400 font-semibold">Redis Session Set</p>
            </div>
            <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('statTotalUsers')}</div>
              <p className="text-3xl font-extrabold text-purple-400">{realUsers.length > 0 ? realUsers.length : 4}</p>
              <p className="text-[10px] text-purple-400 font-semibold">{t('statTotalUsersSub')}</p>
            </div>
            <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('statTotalCerts')}</div>
              <p className="text-3xl font-extrabold text-cyan-400">{analyticsData?.compliance_pie_chart?.total_checked ?? 5}</p>
              <p className="text-[10px] text-cyan-400 font-semibold">{t('statTotalCertsSub')}</p>
            </div>
            <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('statCompliancePass')}</div>
              <p className="text-3xl font-extrabold text-emerald-400">{analyticsData?.compliance_pie_chart?.conforme_percentage ?? 100}%</p>
              <p className="text-[10px] text-emerald-400 font-semibold">{t('statComplianceSub')}</p>
            </div>
          </div>

          {/* Users Breakdown */}
          {realUsers.length > 0 && (
            <div className="glass-panel rounded-3xl border border-slate-800 p-5 space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-400" /> {t('adminTableTitle')}
                </h3>
                <Link href="/admin/users" className="text-xs font-bold text-purple-400 hover:underline">{t('adminTableManageLink')}</Link>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {realUsers.slice(0, 4).map((u: any) => (
                  <div key={u.id} className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                    <div className="font-bold text-white text-xs">{t('name_' + u.username) !== ('name_' + u.username) ? t('name_' + u.username) : u.full_name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">@{u.username}</div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold inline-block bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      {t('role_' + u.role)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Links */}
          <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-white">{t('dashboardQuickLinks')}</h3>
            <div className="flex flex-wrap gap-3">
              <Link href="/admin/users" className="px-4 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-semibold flex items-center gap-2">
                <Users className="w-3.5 h-3.5" /> {t('navUsers')} <ArrowRight className="w-3 h-3 rtl:rotate-180" />
              </Link>
              <Link href="/admin/docker-metrics" className="px-4 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold flex items-center gap-2">
                <Server className="w-3.5 h-3.5" /> {t('navHealth')} <ArrowRight className="w-3 h-3 rtl:rotate-180" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* === TECHNICIAN DASHBOARD === */}
      {role === 'TECHNICIAN' && (
        <div className="space-y-6">
          <p className="text-sm text-slate-300">{t('dashboardTechDesc')}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { key: 'dashboardTechKpi1', value: '5', color: 'cyan', icon: <Upload className="w-3.5 h-3.5" /> },
              { key: 'dashboardTechKpi2', value: '2', color: 'amber', icon: <Activity className="w-3.5 h-3.5" /> },
              { key: 'dashboardTechKpi3', value: '4', color: 'emerald', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
              { key: 'dashboardTechKpi4', value: '1', color: 'rose', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
            ].map((kpi) => (
              <div key={kpi.key} className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
                <div className={`text-[10px] font-bold uppercase tracking-wider text-${kpi.color}-400 flex justify-between`}>
                  <span>{t(kpi.key)}</span>{kpi.icon}
                </div>
                <p className={`text-3xl font-extrabold text-${kpi.color}-400`}>{kpi.value}</p>
              </div>
            ))}
          </div>
          <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-white">{t('dashboardQuickLinks')}</h3>
            <div className="flex flex-wrap gap-3">
              <Link href="/upload" className="px-4 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold flex items-center gap-2">
                <Upload className="w-3.5 h-3.5" /> {t('navUpload')} <ArrowRight className="w-3 h-3 rtl:rotate-180" />
              </Link>
              <Link href="/certificates" className="px-4 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-2">
                <FileSpreadsheet className="w-3.5 h-3.5" /> {t('navCerts')} <ArrowRight className="w-3 h-3 rtl:rotate-180" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* === VALIDATOR DASHBOARD === */}
      {role === 'VALIDATOR' && (
        <div className="space-y-6">
          <p className="text-sm text-slate-300">{t('dashboardValDesc')}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { key: 'statTotalCerts', value: '5', color: 'cyan', icon: <FileCheck2 className="w-3.5 h-3.5" /> },
              { key: 'dashboardTechKpi2', value: '1', color: 'amber', icon: <Activity className="w-3.5 h-3.5" /> },
              { key: 'statCompliancePass', value: '80%', color: 'emerald', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
              { key: 'dashboardTechKpi4', value: '3', color: 'rose', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
            ].map((kpi) => (
              <div key={kpi.key} className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
                <div className={`text-[10px] font-bold uppercase tracking-wider text-${kpi.color}-400 flex justify-between`}>
                  <span>{t(kpi.key)}</span>{kpi.icon}
                </div>
                <p className={`text-3xl font-extrabold text-${kpi.color}-400`}>{kpi.value}</p>
              </div>
            ))}
          </div>
          <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-white">{t('dashboardQuickLinks')}</h3>
            <div className="flex flex-wrap gap-3">
              <Link href="/certificates" className="px-4 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-2">
                <FileSpreadsheet className="w-3.5 h-3.5" /> {t('navCerts')} <ArrowRight className="w-3 h-3 rtl:rotate-180" />
              </Link>
              <Link href="/eval-5certs" className="px-4 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold flex items-center gap-2">
                <Layers className="w-3.5 h-3.5" /> {t('nav5Certs')} <ArrowRight className="w-3 h-3 rtl:rotate-180" />
              </Link>
              <Link href="/reports" className="px-4 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-semibold flex items-center gap-2">
                <FileCheck className="w-3.5 h-3.5" /> {t('navReports')} <ArrowRight className="w-3 h-3 rtl:rotate-180" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* === DIRECTOR DASHBOARD === */}
      {role === 'DIRECTOR' && (
        <div className="space-y-6">
          <p className="text-sm text-slate-300">{t('dashboardDirDesc')}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { key: 'statTotalCerts', value: '5', color: 'cyan', icon: <Zap className="w-3.5 h-3.5" /> },
              { key: 'statCompliancePass', value: '80%', color: 'emerald', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
              { key: 'dashboardTechKpi4', value: '3', color: 'rose', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
              { key: 'statPassRate', value: '80%', color: 'amber', icon: <BarChart3 className="w-3.5 h-3.5" /> },
            ].map((kpi) => (
              <div key={kpi.key} className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
                <div className={`text-[10px] font-bold uppercase tracking-wider text-${kpi.color}-400 flex justify-between`}>
                  <span>{t(kpi.key)}</span>{kpi.icon}
                </div>
                <p className={`text-3xl font-extrabold text-${kpi.color}-400`}>{kpi.value}</p>
              </div>
            ))}
          </div>
          <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-white">{t('dashboardQuickLinks')}</h3>
            <div className="flex flex-wrap gap-3">
              <Link href="/director-dashboard" className="px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-2">
                <PieChart className="w-3.5 h-3.5" /> {t('navDirector')} <ArrowRight className="w-3 h-3 rtl:rotate-180" />
              </Link>
              <Link href="/reports" className="px-4 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold flex items-center gap-2">
                <FileCheck className="w-3.5 h-3.5" /> {t('navReports')} <ArrowRight className="w-3 h-3 rtl:rotate-180" />
              </Link>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
