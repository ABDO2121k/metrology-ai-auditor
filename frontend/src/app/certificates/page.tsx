'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FileText, Search, ArrowLeft, Eye, ShieldCheck, AlertTriangle } from 'lucide-react';

export default function CertificatesGridPage() {
  const [filter, setFilter] = useState('ALL');

  const certs = [
    { id: '1', number: 'ARRM13388-26', client: 'PROCESS INSTRUMENTS CLIENT', instrument: 'Boîte de Résistance', date: '2026-07-29', status: 'VALIDATED_CONFORME', score: 0.05 },
    { id: '2', number: 'AETE04897-26', client: 'SOCIETE DE THERMIE', instrument: 'Capteur Température Pt100 / TC', date: '2026-07-29', status: 'VALIDATED_CONFORME', score: 0.05 },
    { id: '3', number: 'ARTL05391-26/A', client: 'LABORATOIRE METROLOGIE', instrument: 'Multimètre Numérique', date: '2026-07-29', status: 'VALIDATED_CONFORME', score: 0.05 },
    { id: '4', number: 'ARBI13361-26', client: 'ELECTRO TECH', instrument: 'Shunt Électrique de Précision', date: '2026-07-29', status: 'VALIDATED_CONFORME', score: 0.05 },
    { id: '5', number: 'AENS12791-26', client: 'PROCESS CALIBRATION S.A.', instrument: 'Calibrateur Multifonction', date: '2026-07-29', status: 'FLAGGED_ANOMALY', score: 0.90 }
  ];

  const filteredCerts = certs.filter(c => {
    if (filter === 'CONFORME') return c.status === 'VALIDATED_CONFORME';
    if (filter === 'ANOMALIE') return c.status === 'FLAGGED_ANOMALY';
    return true;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center glass-panel rounded-3xl p-6 border border-slate-800 gap-4">
        <div className="flex items-center space-x-3">
          <Link href="/" className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-cyan-400" /> Registre Général des Certificats d'Étalonnage
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">Base de données d'audit métrologique et historique de validation (ISO 17025)</p>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center space-x-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 text-xs">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition ${filter === 'ALL' ? 'bg-cyan-500 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Tous (5)
          </button>
          <button
            onClick={() => setFilter('CONFORME')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition ${filter === 'CONFORME' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Conformes (4)
          </button>
          <button
            onClick={() => setFilter('ANOMALIE')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition ${filter === 'ANOMALIE' ? 'bg-rose-500 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Anomalies (1)
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="glass-panel rounded-3xl p-6 border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold">
                <th className="p-3">N° Certificat</th>
                <th className="p-3">Client</th>
                <th className="p-3">Instrument</th>
                <th className="p-3">Date</th>
                <th className="p-3">Statut ISO 17025</th>
                <th className="p-3">Score IA</th>
                <th className="p-3 text-right">Studio Split-View</th>
              </tr>
            </thead>
            <tbody>
              {filteredCerts.map((c) => (
                <tr key={c.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="p-3 font-mono font-bold text-cyan-400">{c.number}</td>
                  <td className="p-3 text-slate-300">{c.client}</td>
                  <td className="p-3 font-semibold text-white">{c.instrument}</td>
                  <td className="p-3 text-slate-400">{c.date}</td>
                  <td className="p-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      c.status === 'VALIDATED_CONFORME' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    }`}>
                      {c.status === 'VALIDATED_CONFORME' ? 'CONFORME' : 'ANOMALIE BLOQUÉE'}
                    </span>
                  </td>
                  <td className="p-3 font-mono font-bold">
                    <span className={c.score > 0.5 ? 'text-rose-400' : 'text-emerald-400'}>
                      {c.score.toFixed(2)}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <Link
                      href={`/certificates/${c.number}`}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 transition"
                    >
                      <Eye className="w-3.5 h-3.5 text-cyan-400" /> Inspecter Studio
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
