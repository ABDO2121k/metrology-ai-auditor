'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, Upload, FileSpreadsheet, Layers, PieChart, Users, ArrowRight } from 'lucide-react';

export default function HomePage() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const u = localStorage.getItem('jwt_user');
    if (u) {
      try {
        setUser(JSON.parse(u));
      } catch (e) {}
    }
  }, []);

  return (
    <div className="space-y-8">
      
      {/* Hero Welcome Banner */}
      <div className="glass-panel p-8 rounded-3xl border border-slate-800 relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="max-w-3xl space-y-4 relative z-10">
          <span className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold">
            PLATEFORME WEB INTELLECTUELLE · DÉPARTEMENT ÉLECTRIQUE
          </span>
          <h1 className="text-3xl font-extrabold text-white">
            Bienvenue sur Process Instruments Métrologie
          </h1>
          <p className="text-slate-300 text-xs leading-relaxed">
            Système automatisé de contrôle métrologique, d'analyse d'incertitudes (ISO/IEC 17025) et de détection des anomalies par Intelligence Artificielle pour certificats d'étalonnage.
          </p>

          {user && (
            <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80 inline-flex items-center gap-3 text-xs">
              <span className="text-slate-400">Connecté en tant que:</span>
              <span className="font-bold text-white">{user.full_name}</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                {user.role}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Quick Action Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        <Link href="/upload" className="glass-panel p-6 rounded-3xl border border-slate-800 glass-panel-hover group block space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Upload className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm group-hover:text-cyan-300 transition">Studio Dépôt PDF</h3>
            <p className="text-xs text-slate-400 mt-1">Ingestion PDF, dédoublonnage SHA-256 et grille de codification PRO.MDD V23</p>
          </div>
          <div className="flex items-center gap-1 text-xs font-bold text-cyan-400 pt-2">
            <span>Accéder</span> <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        <Link href="/certificates" className="glass-panel p-6 rounded-3xl border border-slate-800 glass-panel-hover group block space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm group-hover:text-emerald-300 transition">Registre Certificats</h3>
            <p className="text-xs text-slate-400 mt-1">Split-view studio d'audit mathématique ISO 17025 et signature électronique</p>
          </div>
          <div className="flex items-center gap-1 text-xs font-bold text-emerald-400 pt-2">
            <span>Accéder</span> <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        <Link href="/director-dashboard" className="glass-panel p-6 rounded-3xl border border-slate-800 glass-panel-hover group block space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <PieChart className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm group-hover:text-amber-300 transition">Dashboard Directeur</h3>
            <p className="text-xs text-slate-400 mt-1">Analytics graphiques (Line & Pie charts), taux de conformité et audit trail</p>
          </div>
          <div className="flex items-center gap-1 text-xs font-bold text-amber-400 pt-2">
            <span>Accéder</span> <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        <Link href="/admin/users" className="glass-panel p-6 rounded-3xl border border-slate-800 glass-panel-hover group block space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm group-hover:text-purple-300 transition">Gestion Utilisateurs</h3>
            <p className="text-xs text-slate-400 mt-1">Provisionnement des rôles et réinitialisation forcé de mots de passe</p>
          </div>
          <div className="flex items-center gap-1 text-xs font-bold text-purple-400 pt-2">
            <span>Accéder</span> <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>

      </div>

    </div>
  );
}
