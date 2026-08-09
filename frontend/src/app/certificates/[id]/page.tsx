'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileText, RefreshCw, ScanLine } from 'lucide-react';

interface Certificate {
  id: string;
  certificate_number: string;
  original_filename: string;
  file_path_s3: string;
  status: string;
  created_at: string;
  client_name?: string;
  instrument_name?: string;
  instrument_serial?: string;
}

interface OCRMeasurement {
  point_index: number;
  nominal_value: number;
  reference_value: number;
  measured_value: number;
  unit: string;
  calculated_error: number;
  calculated_correction: number;
  uncertainty_u: number;
  emt_limit: number;
}

interface OCRData {
  certificate_id: string;
  certificate_number: string;
  client_name: string;
  instrument_name: string;
  instrument_serial: string;
  announced_page_count: number;
  actual_extracted_pages: number;
  issue_date?: string;
  calibration_date?: string;
  next_calibration_date?: string;
  ambient_temperature?: string;
  ambient_humidity?: string;
  has_stamp_logo: boolean;
  has_signature: boolean;
  measurements: OCRMeasurement[];
}

export default function CertificateDetailsPage() {
  const params = useParams<{ id: string }>();
  const certificateId = useMemo(() => params?.id || '', [params]);

  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [ocrData, setOcrData] = useState<OCRData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingOcr, setLoadingOcr] = useState(false);
  const [error, setError] = useState('');

  const fetchCertificate = async () => {
    const token = localStorage.getItem('jwt_token');
    const res = await fetch(`http://localhost:8000/api/v1/certificates/${certificateId}`, {
      headers: { Authorization: `Bearer ${token || ''}` },
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to load certificate');
    }
    setCertificate(data);
    return data as Certificate;
  };

  const fetchOCR = async (cert: Certificate) => {
    setLoadingOcr(true);
    try {
      const token = localStorage.getItem('jwt_token');
      const res = await fetch('http://localhost:8000/api/v1/ocr/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`,
        },
        body: JSON.stringify({
          certificate_id: cert.id,
          s3_path: cert.file_path_s3,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.error || 'OCR request failed');
      }
      setOcrData(data);
    } finally {
      setLoadingOcr(false);
    }
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const cert = await fetchCertificate();
      await fetchOCR(cert);
    } catch (err: any) {
      setError(err.message || 'Failed to load certificate details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (certificateId) {
      load();
    }
  }, [certificateId]);

  if (loading) {
    return (
      <div className="glass-panel rounded-3xl border border-slate-800 p-8 text-center text-slate-300">
        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-3" />
        Loading certificate details...
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link href="/certificates" className="inline-flex items-center gap-2 text-cyan-300 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to certificates
        </Link>
        <div className="glass-panel rounded-3xl border border-rose-500/30 p-6 text-rose-300">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-2">
      <div className="flex items-center justify-between">
        <Link href="/certificates" className="inline-flex items-center gap-2 text-cyan-300 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to certificates
        </Link>
        <button
          onClick={load}
          className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingOcr ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="glass-panel rounded-3xl border border-slate-800 p-6 space-y-4">
        <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-cyan-400" />
          {certificate?.certificate_number || `CERT-${certificate?.id.slice(0, 8)}`}
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-slate-400">Filename</div>
            <div className="text-white font-semibold">{certificate?.original_filename}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-slate-400">Status</div>
            <div className="text-cyan-300 font-semibold">{certificate?.status}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-slate-400">S3 Path</div>
            <div className="text-slate-300 font-mono break-all">{certificate?.file_path_s3}</div>
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-3xl border border-slate-800 p-6 space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <ScanLine className="w-5 h-5 text-emerald-400" />
          OCR Extracted Data
        </h2>
        {!ocrData ? (
          <p className="text-slate-400 text-sm">No OCR data available.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-slate-400">Client</div>
                <div className="text-white font-semibold">{ocrData.client_name || '—'}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-slate-400">Instrument</div>
                <div className="text-white font-semibold">{ocrData.instrument_name || '—'}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-slate-400">Serial</div>
                <div className="text-white font-semibold">{ocrData.instrument_serial || '—'}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-slate-400">Pages (announced)</div>
                <div className="text-white font-semibold">{ocrData.announced_page_count}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-slate-400">Pages (extracted)</div>
                <div className="text-white font-semibold">{ocrData.actual_extracted_pages}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-slate-400">Stamp</div>
                <div className={`font-semibold ${ocrData.has_stamp_logo ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {ocrData.has_stamp_logo ? 'Present' : 'Missing'}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-slate-400">Signature</div>
                <div className={`font-semibold ${ocrData.has_signature ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {ocrData.has_signature ? 'Present' : 'Missing'}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-800 rounded-2xl">
              <table className="w-full text-xs">
                <thead className="bg-slate-950 text-slate-300">
                  <tr>
                    <th className="p-3 text-left">#</th>
                    <th className="p-3 text-left">Ref</th>
                    <th className="p-3 text-left">Measured</th>
                    <th className="p-3 text-left">Error</th>
                    <th className="p-3 text-left">Correction</th>
                    <th className="p-3 text-left">U</th>
                    <th className="p-3 text-left">EMT</th>
                  </tr>
                </thead>
                <tbody>
                  {ocrData.measurements.map((m) => (
                    <tr key={`${m.point_index}-${m.reference_value}`} className="border-t border-slate-800 text-slate-200">
                      <td className="p-3">{m.point_index}</td>
                      <td className="p-3">{m.reference_value}</td>
                      <td className="p-3">{m.measured_value}</td>
                      <td className="p-3">{m.calculated_error}</td>
                      <td className="p-3">{m.calculated_correction}</td>
                      <td className="p-3">{m.uncertainty_u}</td>
                      <td className="p-3">{m.emt_limit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
