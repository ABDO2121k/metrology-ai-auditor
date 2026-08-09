'use client';

import Link from 'next/link';
import { 
  FileCheck, 
  AlertTriangle, 
  Activity, 
  Clock, 
  ArrowUpRight, 
  Layers, 
  ShieldCheck, 
  Cpu, 
  Server, 
  CheckCircle2, 
  FileText 
} from 'lucide-react';

export default function DashboardPage() {
  const kpiCards = [
    { title: 'Certificats Audités', val: '1,248', change: '+12.4%', icon: FileCheck, color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20' },
    { title: 'Taux de Conformité (ISO 17025)', val: '98.4%', change: '+0.8%', icon: ShieldCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    { title: 'Anomalies / Falsifications', val: '18', change: '-4', icon: AlertTriangle, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20' },
    { title: 'Temps Inférence Moyen', val: '< 12ms', change: 'ONNX CPU', icon: Clock, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
  ];

  const microservices = [
    { name: 'auth-gateway', port: 8000, type: 'Go / JWT', status: 'Healthy', color: 'emerald' },
    { name: 'document-ingestion', port: 8001, type: 'Go / MinIO', status: 'Healthy', color: 'emerald' },
    { name: 'ocr-parsing', port: 8002, type: 'Python / RapidOCR', status: 'Healthy', color: 'emerald' },
    { name: 'metrology-engine', port: 8003, type: 'Python / ISO 17025', status: 'Healthy', color: 'emerald' },
    { name: 'ai-anomaly', port: 8004, type: 'Python / ONNX ML', status: 'Healthy', color: 'emerald' },
    { name: 'reporting-notification', port: 8005, type: 'Node.js / WebSockets', status: 'Healthy', color: 'emerald' },
    { name: 'postgres', port: 5432, type: 'PostgreSQL 16', status: 'Healthy', color: 'emerald' },
    { name: 'redis', port: 6379, type: 'Redis 7 Alpine', status: 'Healthy', color: 'emerald' }
  ];

  const certModels = [
    { id: '1', cert_num: 'ARRM13388-26', title: 'Boîte de Résistance (Resistor Box)', pages: '2 Pages', domain: 'Résistance (Ω)', badge: 'Conforme ISO 17025' },
    { id: '2', cert_num: 'AETE04897-26', title: 'Capteur Température Pt100 / TC', pages: '4 Pages', domain: 'Température (°C)', badge: 'Conforme ISO 17025' },
    { id: '3', cert_num: 'ARTL05391-26/A', title: 'Multimètre Numérique (V, A, Ω)', pages: '3 Pages', domain: 'Tension / Courant', badge: 'Conforme ISO 17025' },
    { id: '4', cert_num: 'ARBI13361-26', title: 'Shunt Électrique de Précision', pages: '2 Pages', domain: 'Tension Shunt (mV)', badge: 'Conforme ISO 17025' },
    { id: '5', cert_num: 'AENS12791-26', title: 'Calibrateur de Processus Multifonction', pages: '6 Pages', domain: 'Multi-Grandeur (kΩ, Hz)', badge: 'Anomalie Détectée' }
  ];

  return (
    <div className="space-y-8">
      
      {/* Top Banner */}
      <div className="glass-panel rounded-3xl p-8 relative overflow-hidden bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-cyan-950/30 border border-slate-800 shadow-2xl">
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold">
            <Cpu className="w-4 h-4" /> Traitement d'Image OCR & Inférence ONNX Runtime
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Tableau de Bord Métrologique & Contrôle Qualité IA
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            Validation automatique de conformité ISO/IEC 17025, vérification de validité des étalons de référence, calcul de gardes de sécurité (|Correction| + U ≤ EMT) et détection de falsification pour le laboratoire Process Instruments.
          </p>

          <div className="pt-2 flex flex-wrap gap-4">
            <Link 
              href="/eval-5certs"
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/25 transition flex items-center gap-2"
            >
              <Layers className="w-4 h-4" /> Exécuter le Benchmark 5 Certificats
            </Link>
            <Link 
              href="/certificates/ARRM13388-26"
              className="px-6 py-3 rounded-2xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700 font-semibold text-xs transition flex items-center gap-2"
            >
              <FileText className="w-4 h-4 text-emerald-400" /> Ouvrir le Studio Split-View
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpiCards.map((card, idx) => {
          const IconComp = card.icon;
          return (
            <div key={idx} className={`glass-panel glass-panel-hover rounded-2xl p-5 border ${card.bg}`}>
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold text-slate-400">{card.title}</span>
                <div className={`p-2 rounded-xl bg-slate-900/60 ${card.color}`}>
                  <IconComp className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline justify-between">
                <span className="text-2xl font-black tracking-tight text-white">{card.val}</span>
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-0.5">
                  {card.change} <ArrowUpRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 5 Certificate Models Interactive Grid */}
      <div className="glass-panel rounded-3xl p-6 border border-slate-800 shadow-xl space-y-6">
        <div className="flex justify-between items-center border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-cyan-400" /> Modèles de Certificats d'Étalonnage (1 à 5)
            </h2>
            <p className="text-xs text-slate-400">Sélectionnez un modèle pour inspecter son relevé métrologique et ses règles de conformité ISO 17025</p>
          </div>
          <Link href="/eval-5certs" className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1">
            Tout évaluer <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {certModels.map((model) => (
            <Link 
              key={model.id}
              href={`/certificates/${model.cert_num}`}
              className="glass-card glass-panel-hover rounded-2xl p-4 flex flex-col justify-between space-y-4 group cursor-pointer"
            >
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold">
                    {model.cert_num}
                  </span>
                  <span className="text-[10px] text-slate-400">{model.pages}</span>
                </div>
                <h3 className="text-xs font-bold text-white group-hover:text-cyan-300 transition line-clamp-2">
                  {model.title}
                </h3>
              </div>

              <div className="pt-2 border-t border-slate-800/60 flex justify-between items-center">
                <span className="text-[10px] text-slate-400">{model.domain}</span>
                {model.badge === 'Anomalie Détectée' ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40">
                    Anomalie
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                    ISO 17025
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Architecture Microservices Health Matrix */}
      <div className="glass-panel rounded-3xl p-6 border border-slate-800 shadow-xl space-y-4">
        <div className="flex justify-between items-center border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-md font-bold text-white flex items-center gap-2">
              <Server className="w-5 h-5 text-emerald-400" /> Matrice de Santé des Microservices System (Docker Compose)
            </h2>
            <p className="text-xs text-slate-400">Architecture distribuée orchestrée avec conteneurs isolés</p>
          </div>
          <span className="text-xs font-mono text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-xl">
            Système Opérationnel 100%
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {microservices.map((ms, idx) => (
            <div key={idx} className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white font-mono">{ms.name}</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">{ms.type} | Port {ms.port}</p>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {ms.status}
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
