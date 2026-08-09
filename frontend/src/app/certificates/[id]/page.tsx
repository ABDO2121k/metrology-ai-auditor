'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  FileText, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  ShieldCheck, 
  ArrowLeft, 
  Check, 
  X 
} from 'lucide-react';

export default function SplitViewCertificateStudio({ params }: { params: { id: string } }) {
  const certId = params.id || 'ARRM13388-26';

  const isAnomalyDemo = certId.includes('AENS12791-26');

  const [decisionSubmitted, setDecisionSubmitted] = useState<string | null>(null);

  const measurements = [
    { pt: 1, nominal: 1.0, reference: 1.0000, measured: 1.0134, error: 0.0134, correction: -0.0134, u: 0.0082, emt: 0.05, conforme: true },
    { pt: 2, nominal: 10.0, reference: 10.0000, measured: 10.0042, error: 0.0042, correction: -0.0042, u: 0.0095, emt: 0.05, conforme: true },
    { pt: 3, nominal: 100.0, reference: 100.0000, measured: 100.0120, error: 0.0120, correction: -0.0120, u: 0.0150, emt: 0.10, conforme: true }
  ];

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="glass-panel rounded-3xl p-6 border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center space-x-3">
          <Link href="/eval-5certs" className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white">Certificat N° {certId}</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                isAnomalyDemo ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              }`}>
                {isAnomalyDemo ? 'Anomalie Détectée' : 'Conforme ISO 17025'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Laboratoire Process Instruments | Audit Système #SYS-{certId}</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setDecisionSubmitted('REJECTED')}
            className="px-5 py-2.5 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white font-bold text-xs transition flex items-center gap-2 shadow-lg shadow-rose-950/40"
          >
            <XCircle className="w-4 h-4" /> Rejeter
          </button>
          <button
            onClick={() => setDecisionSubmitted('VALIDATED')}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs transition flex items-center gap-2 shadow-lg shadow-emerald-950/40"
          >
            <CheckCircle2 className="w-4 h-4" /> Valider & Signer (ISO 17025)
          </button>
        </div>
      </div>

      {decisionSubmitted && (
        <div className={`p-4 rounded-2xl border text-sm font-bold flex items-center justify-between ${
          decisionSubmitted === 'VALIDATED' ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
        }`}>
          <span>
            {decisionSubmitted === 'VALIDATED' ? '✓ Certificat validé et signé électroniquement avec succès !' : '✗ Certificat rejeté. Notification envoyée au technicien.'}
          </span>
          <button onClick={() => setDecisionSubmitted(null)} className="text-xs underline opacity-80">Fermer</button>
        </div>
      )}

      {/* Split-View Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Panel: Document Viewer Mock (5 Cols) */}
        <div className="lg:col-span-5 glass-panel rounded-3xl p-5 border border-slate-800 flex flex-col h-[780px]">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400" /> Aperçu Certificat PDF Original
            </h2>
            <span className="text-[10px] text-slate-500">MinIO S3 Bucket</span>
          </div>

          <div className="flex-1 bg-slate-950/90 rounded-2xl border border-slate-800 p-6 flex flex-col justify-between overflow-y-auto font-mono text-xs">
            <div className="space-y-4">
              <div className="border-b border-slate-800 pb-4 text-center">
                <p className="text-sm font-bold text-white">PROCESS INSTRUMENTS LABORATOIRE</p>
                <p className="text-[10px] text-slate-400">CERTIFICAT D'ÉTALONNAGE N° {certId}</p>
              </div>

              <div className="space-y-1 text-slate-300">
                <p>Client : PROCESS INSTRUMENTS CLIENT</p>
                <p>Instrument : Appareil de Mesure Métrologique</p>
                <p>Date Étalonnage : 2026-07-29</p>
                <p>Température Ambiante : 23.0 °C (Humidité: 50.0%)</p>
              </div>

              <div className="pt-2">
                <p className="font-bold text-cyan-400 mb-1">Étalons de Référence Utilisés :</p>
                <p className="text-[11px] text-slate-400">• Étalon Primaire #ET-2024-001 (Valide jusqu'au 2027-01-15)</p>
              </div>

              <div className="pt-2">
                <p className="font-bold text-cyan-400 mb-1">Relevés de Mesures Extraction OCR :</p>
                <div className="space-y-1 text-[11px] text-slate-300">
                  {measurements.map(m => (
                    <p key={m.pt}>Pt #{m.pt} : Nominal {m.nominal} | Mesuré {m.measured} | Erreur {m.error}</p>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-between items-center text-[10px] text-slate-500">
              <span>Cachet & Cachet Laboratoire</span>
              <span>Signature Métrologiste</span>
            </div>
          </div>
        </div>

        {/* Right Panel: Metrological Decision & AI Risk Studio (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* AI Risk Alert Box if Anomaly */}
          {isAnomalyDemo && (
            <div className="glass-panel rounded-3xl p-5 border border-rose-800/60 bg-rose-950/30">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-6 h-6 text-rose-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-rose-300">Alertes Critiques Détectées par le Modèle IA</h3>
                  <ul className="mt-2 text-xs text-rose-200 space-y-1">
                    <li>• [CRITICAL] <strong>MISSING_SIGNATURE</strong> : Signature du responsable métrologie absente.</li>
                    <li>• [CRITICAL] <strong>PAGE_COUNT_MISMATCH</strong> : Nombre de pages extraites non conforme.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Metrological Table Check Card */}
          <div className="glass-panel rounded-3xl p-6 border border-slate-800 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-cyan-400" /> Calculs Métrologiques & Garde ISO 17025
              </h2>
              <span className="text-xs font-mono text-cyan-400">Règle: |Correction| + U ≤ EMT</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase">
                    <th className="p-2">Point</th>
                    <th className="p-2">Consigne</th>
                    <th className="p-2">Mesurée</th>
                    <th className="p-2">Erreur</th>
                    <th className="p-2">Correction</th>
                    <th className="p-2">Incertitude U</th>
                    <th className="p-2">EMT</th>
                    <th className="p-2">Décision</th>
                  </tr>
                </thead>
                <tbody>
                  {measurements.map(m => (
                    <tr key={m.pt} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="p-2 font-mono text-slate-300">#{m.pt}</td>
                      <td className="p-2 font-mono">{m.nominal}</td>
                      <td className="p-2 font-mono">{m.measured}</td>
                      <td className="p-2 font-mono text-cyan-300">{m.error}</td>
                      <td className="p-2 font-mono text-purple-300">{m.correction}</td>
                      <td className="p-2 font-mono text-amber-300">±{m.u}</td>
                      <td className="p-2 font-mono text-slate-400">{m.emt}</td>
                      <td className="p-2 font-bold">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          ✓ Conforme
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Validation Summary Card */}
          <div className="glass-panel rounded-3xl p-6 border border-slate-800 space-y-4">
            <h2 className="text-sm font-bold text-white">Traçabilité Étalons & Chronologie</h2>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">ÉTALON DE RÉFÉRENCE</span>
                <span className="font-semibold text-emerald-400 flex items-center gap-1 mt-1">
                  <Check className="w-3.5 h-3.5" /> Étalon Valide (Expiry &ge; Calib)
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">CHRONOLOGIE DES DATES</span>
                <span className="font-semibold text-emerald-400 flex items-center gap-1 mt-1">
                  <Check className="w-3.5 h-3.5" /> Conforme (Reception &le; Calib)
                </span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
