'use client';

import Link from 'next/link';
import { Sparkles, LogIn, Zap, FileCheck, Cpu, Layers } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export default function HomePage() {
  const { t } = useLanguage();

  return (
    <div className="space-y-14 py-4">

      {/* HERO SECTION — Full Width, No Sidebar */}
      <section className="glass-panel p-8 md:p-14 rounded-3xl border border-slate-800 relative overflow-hidden shadow-2xl">

        <div className="absolute -top-24 -right-24 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-purple-500/15 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 max-w-3xl mx-auto text-center space-y-8">

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold tracking-wide">
            <Sparkles className="w-4 h-4" /> {t('heroBadge')}
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold text-white leading-tight">
            {t('heroTitle')} <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500">
              {t('heroTitleGradient')}
            </span>
          </h1>

          <p className="text-slate-300 text-sm md:text-base leading-relaxed max-w-2xl mx-auto">
            {t('heroDesc')}
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap pt-2">
            <Link
              href="/login"
              className="px-8 py-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-on-accent font-extrabold text-sm shadow-xl shadow-cyan-500/30 flex items-center gap-2.5 transition"
            >
              <LogIn className="w-5 h-5" /> {t('ctaLogin')}
            </Link>
          </div>

        </div>
      </section>

      {/* CORE FEATURES GRID */}
      <section className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-extrabold text-white">{t('featuresTitle')}</h2>
          <p className="text-xs text-slate-400 max-w-lg mx-auto">{t('featuresSubtitle')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-3 hover:border-cyan-500/40 transition group">
            <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:bg-cyan-500/20 transition">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-sm">{t('featOcrTitle')}</h3>
            <p className="text-xs text-slate-400 leading-relaxed">{t('featOcrDesc')}</p>
          </div>

          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-3 hover:border-emerald-500/40 transition group">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500/20 transition">
              <FileCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-sm">{t('featMathTitle')}</h3>
            <p className="text-xs text-slate-400 leading-relaxed">{t('featMathDesc')}</p>
          </div>

          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-3 hover:border-amber-500/40 transition group">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:bg-amber-500/20 transition">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-sm">{t('featAiTitle')}</h3>
            <p className="text-xs text-slate-400 leading-relaxed">{t('featAiDesc')}</p>
          </div>

          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-3 hover:border-purple-500/40 transition group">
            <div className="w-11 h-11 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:bg-purple-500/20 transition">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-sm">{t('featReportTitle')}</h3>
            <p className="text-xs text-slate-400 leading-relaxed">{t('featReportDesc')}</p>
          </div>

        </div>
      </section>

      {/* ISO STANDARDS BADGE STRIP */}
      <section className="glass-panel p-6 rounded-3xl border border-slate-800 flex flex-wrap justify-center gap-4 md:gap-8">
        {['ISO/IEC 17025:2017', 'NM 2018', 'PR.ECE V9', 'PRO.MDD V23', 'ONNX AI Engine', 'MinIO S3'].map((badge) => (
          <span key={badge} className="px-4 py-1.5 rounded-full bg-slate-900 border border-slate-700 text-slate-400 text-xs font-semibold">
            {badge}
          </span>
        ))}
      </section>

    </div>
  );
}
