'use client';

import { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, RefreshCw, Search, CheckCircle2, Clock, 
  AlertTriangle, Eye, Hash, Calendar, Upload
} from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';

interface Certificate {
  id: string;
  certificate_number: string;
  original_filename: string;
  file_path_s3: string;
  file_hash_sha256: string;
  status: string;
  uploaded_by: string;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING_OCR: { 
    label: 'Pending OCR', 
    color: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
    icon: <Clock className="w-3 h-3" />
  },
  OCR_COMPLETE: { 
    label: 'OCR Complete', 
    color: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/30',
    icon: <CheckCircle2 className="w-3 h-3" />
  },
  VALIDATED_CONFORME: { 
    label: 'Conforme ISO 17025', 
    color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
    icon: <CheckCircle2 className="w-3 h-3" />
  },
  VALIDATED_NON_CONFORME: { 
    label: 'Non-Conforme', 
    color: 'text-rose-400 bg-rose-500/15 border-rose-500/30',
    icon: <AlertTriangle className="w-3 h-3" />
  },
  FLAGGED_ANOMALY: { 
    label: 'Anomaly Detected', 
    color: 'text-orange-400 bg-orange-500/15 border-orange-500/30',
    icon: <AlertTriangle className="w-3 h-3" />
  },
};

export default function CertificatesPage() {
  const { t } = useLanguage();
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    fetchCerts();
  }, []);

  const fetchCerts = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('jwt_token');
      const res = await fetch('http://localhost:8000/api/v1/certificates/', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCerts(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Failed to fetch certificates:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = certs.filter(c => {
    const matchSearch = !search || 
      c.certificate_number?.toLowerCase().includes(search.toLowerCase()) ||
      c.original_filename?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusCounts = certs.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6 py-2">

      {/* Header */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-white">{t('navCerts')}</h1>
            <p className="text-xs text-slate-400">{t('certsSubtitle')}</p>
          </div>
        </div>

        <div className="flex gap-2 items-center">
          <Link
            href="/upload"
            className="px-4 py-2.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-xs font-semibold flex items-center gap-2 transition"
          >
            <Upload className="w-3.5 h-3.5" /> {t('navUpload')}
          </Link>
          <button
            onClick={fetchCerts}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 transition"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
          <p className="text-[10px] text-slate-400 uppercase font-bold">{t('certsTotal')}</p>
          <p className="text-2xl font-extrabold text-white">{certs.length}</p>
        </div>
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
          <p className="text-[10px] text-emerald-400 uppercase font-bold">{t('certsConforme')}</p>
          <p className="text-2xl font-extrabold text-emerald-400">{statusCounts['VALIDATED_CONFORME'] || 0}</p>
        </div>
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
          <p className="text-[10px] text-amber-400 uppercase font-bold">{t('certsPending')}</p>
          <p className="text-2xl font-extrabold text-amber-400">{statusCounts['PENDING_OCR'] || 0}</p>
        </div>
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
          <p className="text-[10px] text-rose-400 uppercase font-bold">{t('certsAnomaly')}</p>
          <p className="text-2xl font-extrabold text-rose-400">
            {(statusCounts['VALIDATED_NON_CONFORME'] || 0) + (statusCounts['FLAGGED_ANOMALY'] || 0)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 rtl:left-auto rtl:right-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('certsSearch')}
            className="w-full pl-9 pr-4 rtl:pl-4 rtl:pr-9 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs outline-none focus:border-cyan-500 transition"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs outline-none focus:border-cyan-500"
        >
          <option value="ALL">{t('certsFilterAll')}</option>
          <option value="PENDING_OCR">PENDING_OCR</option>
          <option value="OCR_COMPLETE">OCR_COMPLETE</option>
          <option value="VALIDATED_CONFORME">CONFORME</option>
          <option value="VALIDATED_NON_CONFORME">NON-CONFORME</option>
          <option value="FLAGGED_ANOMALY">ANOMALY</option>
        </select>
      </div>

      {/* Table */}
      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left rtl:text-right">
            <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-4">{t('certColNumber')}</th>
                <th className="p-4">{t('certColFilename')}</th>
                <th className="p-4">{t('certColStatus')}</th>
                <th className="p-4">{t('certColHash')}</th>
                <th className="p-4">{t('certColDate')}</th>
                <th className="p-4 text-right rtl:text-left">{t('tableActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    {t('certsLoading')}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-slate-500">
                    <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    <p className="font-semibold">{t('certsEmpty')}</p>
                    <p className="text-[10px] mt-1">{t('certsEmptySub')}</p>
                  </td>
                </tr>
              ) : (
                filtered.map((cert) => {
                  const statusCfg = STATUS_CONFIG[cert.status] || STATUS_CONFIG['PENDING_OCR'];
                  return (
                    <tr key={cert.id} className="hover:bg-slate-800/30 transition">
                      <td className="p-4">
                        <span className="font-mono font-bold text-cyan-300">
                          {cert.certificate_number || `CERT-${cert.id.slice(0, 8)}`}
                        </span>
                      </td>
                      <td className="p-4 text-slate-300 max-w-[180px] truncate">
                        {cert.original_filename}
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border flex items-center gap-1 w-fit ${statusCfg.color}`}>
                          {statusCfg.icon} {cert.status}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-slate-500 text-[10px]">
                        <div className="flex items-center gap-1">
                          <Hash className="w-3 h-3" />
                          {cert.file_hash_sha256?.slice(0, 12)}...
                        </div>
                      </td>
                      <td className="p-4 text-slate-400">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {cert.created_at ? new Date(cert.created_at).toLocaleDateString('fr-MA') : '—'}
                        </div>
                      </td>
                      <td className="p-4 text-right rtl:text-left">
                        <button
                          className="p-2 rounded-xl bg-slate-800 hover:bg-cyan-500/20 text-slate-400 hover:text-cyan-400 transition"
                          title={t('certViewBtn')}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
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
