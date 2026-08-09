'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ShieldCheck, 
  Sparkles, 
  Upload, 
  FileSpreadsheet, 
  Layers, 
  PieChart, 
  Users, 
  ArrowRight, 
  Cpu, 
  CheckCircle2, 
  FileCheck, 
  Zap, 
  Lock, 
  LogIn,
  Activity
} from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export default function HomePage() {
  const { t } = useLanguage();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const u = localStorage.getItem('jwt_user');
    if (u) {
      try {
        setUser(JSON.parse(u));
      } catch (e) {}
    }
  }, []);

  const role = user?.role || 'GUEST';

  return (
    <div className="space-y-12 py-4">
      
      {/* HERO SECTION - Inspired by Modern Figma AI Web Application Layout */}
      <section className="glass-panel p-10 md:p-14 rounded-3xl border border-slate-800 relative overflow-hidden shadow-2xl">
        
        {/* Glow ambient background graphics */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-purple-500/15 rounded-full blur-3xl pointer-events-none"></div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
          
          {/* Left Text Block */}
          <div className="lg:col-span-7 space-y-6">
            
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold tracking-wide shadow-sm">
              <Sparkles className="w-4 h-4" /> {t('heroBadge')}
            </div>

            <h1 className="text-4xl md:text-5xl font-extrabold text-white leading-tight tracking-tight">
              {t('heroTitle')} <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500">
                {t('heroTitleGradient')}
              </span>
            </h1>

            <p className="text-slate-300 text-sm md:text-base leading-relaxed max-w-2xl">
              {t('heroDesc')}
            </p>

            {/* Dynamic CTA Buttons based on Login Status & Role */}
            <div className="pt-2 flex flex-wrap items-center gap-4">
              
              {!user ? (
                <>
                  <Link 
                    href="/login"
                    className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-extrabold text-xs md:text-sm shadow-xl shadow-cyan-500/25 flex items-center gap-2.5 transition transform hover:-translate-y-0.5"
                  >
                    <LogIn className="w-4 h-4" /> {t('ctaLogin')}
                  </Link>
                </>
              ) : (
                <>
                  {role === 'TECHNICIAN' && (
                    <Link href="/upload" className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-extrabold text-xs md:text-sm shadow-xl shadow-cyan-500/25 flex items-center gap-2.5 transition">
                      <Upload className="w-4 h-4" /> {t('navUpload')} <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                    </Link>
                  )}
                  {role === 'VALIDATOR' && (
                    <Link href="/certificates" className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-extrabold text-xs md:text-sm shadow-xl shadow-emerald-500/25 flex items-center gap-2.5 transition">
                      <FileSpreadsheet className="w-4 h-4" /> {t('navCerts')} <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                    </Link>
                  )}
                  {role === 'DIRECTOR' && (
                    <Link href="/director-dashboard" className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-extrabold text-xs md:text-sm shadow-xl shadow-amber-500/25 flex items-center gap-2.5 transition">
                      <PieChart className="w-4 h-4" /> {t('navDirector')} <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                    </Link>
                  )}
                  {role === 'ADMINISTRATOR' && (
                    <Link href="/admin/users" className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-extrabold text-xs md:text-sm shadow-xl shadow-purple-500/25 flex items-center gap-2.5 transition">
                      <Users className="w-4 h-4" /> {t('navUsers')} <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                    </Link>
                  )}
                </>
              )}

            </div>

          </div>

          {/* Right Floating AI Graphic Card */}
          <div className="lg:col-span-5 relative">
            <div className="glass-panel p-6 rounded-3xl border border-slate-700/80 space-y-5 shadow-2xl relative">
              
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-cyan-400" />
                  <span className="text-xs font-extrabold text-white">ONNX Neural Model Runtime</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  ONLINE
                </span>
              </div>

              {/* Sample AI Audit Score Box */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-semibold">Score de Conformité ISO 17025</span>
                  <span className="font-extrabold text-emerald-400">99.8% PASS</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-full w-[99.8%] rounded-full shadow-sm"></div>
                </div>
              </div>

              {/* Verified Checklist */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2 text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Sceaux d'Accréditation & Logo Valides</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Calcul Garde-Bande |Corr| + U ≤ EMT</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Contrôle Hystérésis & Étalons Météorologiques</span>
                </div>
              </div>

            </div>
          </div>

        </div>

      </section>

      {/* USER ROLE WELCOME & TAILORED ACTIONS BANNER (If Logged In) */}
      {user && (
        <section className="glass-panel p-6 rounded-3xl border border-slate-800/80 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold text-white">{t('welcomeUser')}, {user.full_name}!</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                {user.role}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {role === 'TECHNICIAN' && t('roleTechnicianText')}
              {role === 'VALIDATOR' && t('roleValidatorText')}
              {role === 'DIRECTOR' && t('roleDirectorText')}
              {role === 'ADMINISTRATOR' && t('roleAdminText')}
            </p>
          </div>
        </section>
      )}

      {/* LIVE METRICS WIDGETS GRID */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-2">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('statCerts')}</p>
          <p className="text-3xl font-extrabold text-white tracking-tight">1,248</p>
          <p className="text-[10px] text-cyan-400 font-semibold">Département Électrique</p>
        </div>

        <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-2">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('statAccuracy')}</p>
          <p className="text-3xl font-extrabold text-emerald-400 tracking-tight">99.8%</p>
          <p className="text-[10px] text-emerald-400 font-semibold">Validation ISO 17025</p>
        </div>

        <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-2">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('statPassRate')}</p>
          <p className="text-3xl font-extrabold text-amber-400 tracking-tight">98.4%</p>
          <p className="text-[10px] text-amber-400 font-semibold">Taux de Conformation</p>
        </div>

        <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-2">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('statSpeed')}</p>
          <p className="text-3xl font-extrabold text-cyan-400 tracking-tight">&lt; 12 ms</p>
          <p className="text-[10px] text-slate-400 font-semibold">Traitement Microservices</p>
        </div>

      </section>

      {/* CORE FEATURES GRID - Inspired by Figma AI Platform Cards */}
      <section className="space-y-6">
        <h2 className="text-xl font-extrabold text-white">Fonctionnalités Clés du Système</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-3 glass-panel-hover">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-sm">{t('featOcrTitle')}</h3>
            <p className="text-xs text-slate-400 leading-relaxed">{t('featOcrDesc')}</p>
          </div>

          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-3 glass-panel-hover">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FileCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-sm">{t('featMathTitle')}</h3>
            <p className="text-xs text-slate-400 leading-relaxed">{t('featMathDesc')}</p>
          </div>

          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-3 glass-panel-hover">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-sm">{t('featAiTitle')}</h3>
            <p className="text-xs text-slate-400 leading-relaxed">{t('featAiDesc')}</p>
          </div>

          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-3 glass-panel-hover">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-sm">{t('featReportTitle')}</h3>
            <p className="text-xs text-slate-400 leading-relaxed">{t('featReportDesc')}</p>
          </div>

        </div>
      </section>

    </div>
  );
}
