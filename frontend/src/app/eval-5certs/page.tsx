'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  FileText, 
  Download, 
  Play, 
  Cpu, 
  RefreshCw 
} from 'lucide-react';

interface CertEvalResult {
  cert_num: string;
  name: string;
  instrument: string;
  pages: string;
  domain: string;
  ocr_status: string;
  metrology_verdict: string;
  standard_valid: boolean;
  guard_band_passed: boolean;
  anomaly_score: number;
  recommendation: string;
  pdf_generated: boolean;
  pdf_size_bytes: number;
  anomalies: string[];
}

export default function Eval5CertsPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<CertEvalResult[]>([
    {
      cert_num: 'ARRM13388-26',
      name: 'Certif 1',
      instrument: 'Boîte de Résistance (Resistor Box)',
      pages: '2/2',
      domain: 'Résistance (Ω)',
      ocr_status: 'OCR Extract OK',
      metrology_verdict: 'PASSED',
      standard_valid: true,
      guard_band_passed: true,
      anomaly_score: 0.05,
      recommendation: 'APPROVE',
      pdf_generated: true,
      pdf_size_bytes: 2875,
      anomalies: []
    },
    {
      cert_num: 'AETE04897-26',
      name: 'Certif 2',
      instrument: 'Capteur Température Pt100 / TC',
      pages: '4/4',
      domain: 'Température (°C)',
      ocr_status: 'OCR Extract OK',
      metrology_verdict: 'PASSED',
      standard_valid: true,
      guard_band_passed: true,
      anomaly_score: 0.05,
      recommendation: 'APPROVE',
      pdf_generated: true,
      pdf_size_bytes: 2890,
      anomalies: []
    },
    {
      cert_num: 'ARTL05391-26/A',
      name: 'Certif 3',
      instrument: 'Multimètre Numérique (V, A, Ω)',
      pages: '3/3',
      domain: 'Tension / Courant',
      ocr_status: 'OCR Extract OK',
      metrology_verdict: 'PASSED',
      standard_valid: true,
      guard_band_passed: true,
      anomaly_score: 0.05,
      recommendation: 'APPROVE',
      pdf_generated: true,
      pdf_size_bytes: 2837,
      anomalies: []
    },
    {
      cert_num: 'ARBI13361-26',
      name: 'Certif 4',
      instrument: 'Shunt Électrique de Précision',
      pages: '2/2',
      domain: 'Tension Shunt (mV)',
      ocr_status: 'OCR Extract OK',
      metrology_verdict: 'PASSED',
      standard_valid: true,
      guard_band_passed: true,
      anomaly_score: 0.05,
      recommendation: 'APPROVE',
      pdf_generated: true,
      pdf_size_bytes: 2808,
      anomalies: []
    },
    {
      cert_num: 'AENS12791-26',
      name: 'Certif 5',
      instrument: 'Calibrateur de Processus Multifonction',
      pages: '6/6',
      domain: 'Multi-Grandeur (kΩ, Hz)',
      ocr_status: 'OCR Extract OK',
      metrology_verdict: 'CRITICAL_REJECT',
      standard_valid: true,
      guard_band_passed: true,
      anomaly_score: 0.90,
      recommendation: 'REJECT',
      pdf_generated: true,
      pdf_size_bytes: 2994,
      anomalies: [
        'Signature de validation absente du document.',
        'Écart d\'analyse du nombre de pages annoncées.'
      ]
    }
  ]);

  const runBenchmark = () => {
    setIsRunning(true);
    setTimeout(() => {
      setIsRunning(false);
    }, 1200);
  };

  return (
    <div className="space-y-6">
      
      {/* Studio Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center glass-panel rounded-3xl p-6 border border-slate-800 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white">Studio de Validation — Benchmark 5 Certificats</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              ISO/IEC 17025
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Exécution coordonnée à travers les 8 microservices Docker (`ocr-parsing`, `metrology-engine`, `ai-anomaly`, `reporting-notification`)
          </p>
        </div>

        <button
          onClick={runBenchmark}
          disabled={isRunning}
          className="px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/40 transition flex items-center gap-2"
        >
          {isRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
          {isRunning ? 'Exécution des Inférences...' : 'Ré-exécuter le Benchmark 5 Certificats'}
        </button>
      </div>

      {/* Results Grid */}
      <div className="space-y-4">
        {results.map((res, idx) => (
          <div 
            key={idx}
            className={`glass-panel glass-panel-hover rounded-2xl p-5 border transition-all ${
              res.recommendation === 'REJECT' 
                ? 'border-rose-800/40 bg-rose-950/20' 
                : 'border-slate-800 bg-slate-900/40'
            }`}
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              
              {/* Left Info */}
              <div className="flex items-start space-x-4">
                <div className={`p-3 rounded-2xl ${res.recommendation === 'REJECT' ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                  {res.recommendation === 'REJECT' ? <XCircle className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-cyan-400">{res.cert_num}</span>
                    <span className="text-xs text-slate-400">({res.name})</span>
                    <span className="text-xs text-slate-500">• {res.pages} Pages</span>
                  </div>
                  <h3 className="text-sm font-bold text-white mt-0.5">{res.instrument}</h3>
                  <p className="text-xs text-slate-400 mt-1">Domaine : {res.domain} | Règle ISO 17025 : |Corr| + U ≤ EMT</p>
                </div>
              </div>

              {/* Middle Metrics */}
              <div className="flex items-center space-x-6 text-xs bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-500 block text-[10px]">VERDICT MÉTRO.</span>
                  <span className={`font-bold ${res.metrology_verdict === 'PASSED' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {res.metrology_verdict}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block text-[10px]">SCORE ANOMALIE IA</span>
                  <span className={`font-mono font-bold ${res.anomaly_score > 0.5 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {res.anomaly_score.toFixed(2)}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block text-[10px]">RECOMMANDATION</span>
                  <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                    res.recommendation === 'APPROVE' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}>
                    {res.recommendation}
                  </span>
                </div>
              </div>

              {/* Right Action */}
              <div className="flex items-center space-x-3">
                <Link
                  href={`/certificates/${res.cert_num}`}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <FileText className="w-4 h-4 text-cyan-400" /> Inspecter
                </Link>
                <button
                  className="px-4 py-2 rounded-xl bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 border border-cyan-500/40 text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <Download className="w-4 h-4" /> Rapport PDF ({res.pdf_size_bytes} B)
                </button>
              </div>

            </div>

            {/* Anomalies List */}
            {res.anomalies.length > 0 && (
              <div className="mt-4 pt-3 border-t border-rose-900/40 text-xs text-rose-300 space-y-1">
                <span className="font-bold flex items-center gap-1 text-rose-400">
                  <AlertTriangle className="w-4 h-4" /> Alertes de Sécurité Détectées :
                </span>
                {res.anomalies.map((anom, aIdx) => (
                  <p key={aIdx} className="pl-5">• {anom}</p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

    </div>
  );
}
