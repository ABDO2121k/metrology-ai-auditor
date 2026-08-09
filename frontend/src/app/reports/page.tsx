'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FileCheck, Download, ExternalLink, ArrowLeft, Search, ShieldCheck } from 'lucide-react';

export default function ReportsArchivePage() {
  const [searchTerm, setSearchTerm] = useState('');

  const reports = [
    { cert_num: 'ARRM13388-26', title: 'Boîte de Résistance', date: '2026-07-29', status: 'PASSED', size: '2.8 KB', minio_path: 'audit-reports/ARRM13388-26_audit.pdf' },
    { cert_num: 'AETE04897-26', title: 'Capteur Température Pt100 / TC', date: '2026-07-29', status: 'PASSED', size: '2.8 KB', minio_path: 'audit-reports/AETE04897-26_audit.pdf' },
    { cert_num: 'ARTL05391-26/A', title: 'Multimètre Numérique (V, A, Ω)', date: '2026-07-29', status: 'PASSED', size: '2.8 KB', minio_path: 'audit-reports/ARTL05391-26_A_audit.pdf' },
    { cert_num: 'ARBI13361-26', title: 'Shunt Électrique de Précision', date: '2026-07-29', status: 'PASSED', size: '2.8 KB', minio_path: 'audit-reports/ARBI13361-26_audit.pdf' },
    { cert_num: 'AENS12791-26', title: 'Calibrateur de Processus Multifonction', date: '2026-07-29', status: 'CRITICAL_REJECT', size: '2.9 KB', minio_path: 'audit-reports/AENS12791-26_audit.pdf' }
  ];

  const filteredReports = reports.filter(r => 
    r.cert_num.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
              <FileCheck className="w-5 h-5 text-cyan-400" /> Archive des Rapports d'Audit PDF (MinIO S3)
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Générés automatiquement par le microservice reporting-notification (Port 8005)
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Rechercher certificat..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Reports Table */}
      <div className="glass-panel rounded-3xl p-6 border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold">
                <th className="p-3">N° Certificat</th>
                <th className="p-3">Instrument</th>
                <th className="p-3">Date d'Audit</th>
                <th className="p-3">Statut Global</th>
                <th className="p-3">Taille PDF</th>
                <th className="p-3 text-right">Action MinIO</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.map((r, idx) => (
                <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="p-3 font-mono font-bold text-cyan-400">{r.cert_num}</td>
                  <td className="p-3 font-semibold text-white">{r.title}</td>
                  <td className="p-3 text-slate-300">{r.date}</td>
                  <td className="p-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      r.status === 'PASSED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    }`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-slate-400">{r.size}</td>
                  <td className="p-3 text-right">
                    <button 
                      onClick={() => alert(`Téléchargement MinIO : http://localhost:8005/api/v1/reports/download/${r.minio_path}`)}
                      className="px-3 py-1.5 rounded-xl bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 border border-cyan-500/40 text-xs font-semibold inline-flex items-center gap-1.5 transition"
                    >
                      <Download className="w-3.5 h-3.5" /> Télécharger PDF
                    </button>
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
