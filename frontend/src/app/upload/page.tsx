'use client';

import { useState, useRef, useCallback } from 'react';
import { 
  Upload, FileText, CheckCircle2, XCircle, AlertTriangle, 
  Loader2, UploadCloud, Hash, Clock, ArrowRight, Trash2, RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { api } from '@/lib/api';

interface UploadResult {
  certificate_id: string;
  s3_path: string;
  hash: string;
  status: string;
  message: string;
  filename: string;
}

interface QueuedFile {
  id: string;
  file: File;
  state: 'queued' | 'uploading' | 'success' | 'error' | 'duplicate';
  result?: UploadResult;
  errorMsg?: string;
  progress?: number;
}

export default function UploadPage() {
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [queue, setQueue] = useState<QueuedFile[]>([]);

  const getToken = () => localStorage.getItem('jwt_token') || '';

  const updateQueueItem = (id: string, updates: Partial<QueuedFile>) => {
    setQueue(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q));
  };

  const addFilesToQueue = useCallback((files: FileList | File[]) => {
    const MAX_BYTES = 50 * 1024 * 1024; // matches the gateway's BodyLimit
    const newItems: QueuedFile[] = Array.from(files)
      .filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
      .map((f) => ({
        id: `${Date.now()}-${Math.random()}`,
        file: f,
        // Flag an oversized file here rather than letting the gateway reject
        // it after a long upload.
        state: (f.size > MAX_BYTES ? 'error' : 'queued') as QueuedFile['state'],
        errorMsg: f.size > MAX_BYTES ? 'Fichier trop volumineux (max 50 Mo)' : undefined,
      }));
    setQueue((prev) => [...prev, ...newItems]);
  }, []);

  const uploadFile = async (item: QueuedFile) => {
    updateQueueItem(item.id, { state: 'uploading', progress: 20 });

    try {
      // The gateway answers 202 as soon as the file is stored; OCR then runs
      // in the background. The certificates registry polls for the result.
      const data = await api.uploadCertificate(item.file);
      updateQueueItem(item.id, {
        state: 'success',
        result: { ...data, filename: item.file.name } as UploadResult,
        progress: 100,
      });
    } catch (err: any) {
      if (err?.status === 409) {
        updateQueueItem(item.id, {
          state: 'duplicate',
          errorMsg: t('uploadDuplicateMsg'),
          progress: 100,
        });
      } else {
        updateQueueItem(item.id, {
          state: 'error',
          errorMsg: err?.message || 'Upload failed',
          progress: 0,
        });
      }
    }
  };

  const uploadAll = async () => {
    const queued = queue.filter(q => q.state === 'queued' || q.state === 'error');
    for (const item of queued) {
      await uploadFile(item);
    }
  };

  const removeItem = (id: string) => {
    setQueue(prev => prev.filter(q => q.id !== id));
  };

  const clearCompleted = () => {
    setQueue(prev => prev.filter(q => q.state === 'queued' || q.state === 'uploading'));
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFilesToQueue(e.dataTransfer.files);
  };

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFilesToQueue(e.target.files);
    e.target.value = '';
  };

  const successCount = queue.filter(q => q.state === 'success').length;
  const errorCount = queue.filter(q => q.state === 'error' || q.state === 'duplicate').length;
  const uploadingCount = queue.filter(q => q.state === 'uploading').length;
  const queuedCount = queue.filter(q => q.state === 'queued').length;

  return (
    <div className="space-y-6 py-2">

      {/* Page Header */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <UploadCloud className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-white">{t('navUpload')}</h1>
            <p className="text-xs text-slate-400">{t('uploadSubtitle')}</p>
          </div>
        </div>

        {/* Summary badges */}
        <div className="flex gap-2">
          {successCount > 0 && (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> {successCount} {t('uploadOk')}
            </span>
          )}
          {errorCount > 0 && (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30 flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5" /> {errorCount} {t('uploadFailed')}
            </span>
          )}
          {uploadingCount > 0 && (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> {uploadingCount}
            </span>
          )}
        </div>
      </div>

      {/* Drag & Drop Zone */}
      <div
        className={`rounded-3xl border-2 border-dashed transition-all duration-200 p-12 text-center cursor-pointer relative
          ${isDragging 
            ? 'border-cyan-400 bg-cyan-500/10 scale-[1.01]' 
            : 'border-slate-700 hover:border-cyan-500/60 hover:bg-cyan-500/5'
          }`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          accept=".pdf,application/pdf"
          multiple
          className="hidden"
          onChange={onFileInput}
        />

        <div className="space-y-4">
          <div className={`w-16 h-16 rounded-3xl mx-auto flex items-center justify-center transition-all
            ${isDragging ? 'bg-cyan-500/30 scale-110' : 'bg-slate-800/80'}`}>
            <Upload className={`w-8 h-8 transition-colors ${isDragging ? 'text-cyan-300' : 'text-slate-400'}`} />
          </div>

          <div>
            <p className="text-base font-bold text-white">{t('uploadDropTitle')}</p>
            <p className="text-xs text-slate-400 mt-1">{t('uploadDropSub')}</p>
          </div>

          <div className="flex justify-center gap-4 text-[11px] text-slate-500">
            <span className="flex items-center gap-1"><Hash className="w-3 h-3" /> {t('uploadSHA256Check')}</span>
            <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> PDF Only</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Max 50MB</span>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      {queue.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={uploadAll}
            disabled={queuedCount === 0 || uploadingCount > 0}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/25 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition"
          >
            {uploadingCount > 0
              ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('uploadUploading')}...</>
              : <><UploadCloud className="w-4 h-4" /> {t('uploadAllBtn')} ({queuedCount})</>
            }
          </button>

          <button
            onClick={clearCompleted}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> {t('uploadClearDone')}
          </button>

          {successCount > 0 && (
            <Link
              href="/certificates"
              className="px-4 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              {t('navCerts')} <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
            </Link>
          )}
        </div>
      )}

      {/* Upload Queue */}
      {queue.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-300">{t('uploadQueue')} ({queue.length})</h2>
          <div className="space-y-2">
            {queue.map((item) => (
              <div
                key={item.id}
                className={`glass-panel rounded-2xl border p-4 flex items-center gap-4 transition ${
                  item.state === 'success' ? 'border-emerald-500/30 bg-emerald-500/5' :
                  item.state === 'error' ? 'border-rose-500/30 bg-rose-500/5' :
                  item.state === 'duplicate' ? 'border-amber-500/30 bg-amber-500/5' :
                  item.state === 'uploading' ? 'border-cyan-500/30 bg-cyan-500/5' :
                  'border-slate-800'
                }`}
              >
                {/* Status Icon */}
                <div className="shrink-0">
                  {item.state === 'queued' && <FileText className="w-5 h-5 text-slate-500" />}
                  {item.state === 'uploading' && <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />}
                  {item.state === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                  {item.state === 'error' && <XCircle className="w-5 h-5 text-rose-400" />}
                  {item.state === 'duplicate' && <AlertTriangle className="w-5 h-5 text-amber-400" />}
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">{item.file.name}</p>
                  <p className="text-[10px] text-slate-400">
                    {(item.file.size / 1024 / 1024).toFixed(2)} MB
                    {item.state === 'success' && item.result && (
                      <> · ID: <span className="font-mono text-cyan-400">{item.result.certificate_id.slice(0, 12)}...</span></>
                    )}
                    {item.errorMsg && <> · <span className="text-rose-400">{item.errorMsg}</span></>}
                  </p>

                  {/* Progress Bar */}
                  {item.state === 'uploading' && (
                    <div className="mt-1.5 w-full bg-slate-900 rounded-full h-1 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${item.progress || 0}%` }}
                      />
                    </div>
                  )}

                  {/* State Badge */}
                  <div className="mt-1">
                    {item.state === 'success' && (
                      <span className="text-[10px] font-bold text-emerald-400">{t('uploadStatusPendingOCR')}</span>
                    )}
                    {item.state === 'duplicate' && (
                      <span className="text-[10px] font-bold text-amber-400">{t('uploadStatusDuplicate')}</span>
                    )}
                    {item.state === 'queued' && (
                      <span className="text-[10px] font-semibold text-slate-500">{t('uploadStatusQueued')}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 shrink-0">
                  {item.state === 'queued' && (
                    <button
                      onClick={() => uploadFile(item)}
                      className="p-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-400 text-xs font-bold transition"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {item.state !== 'uploading' && (
                    <button
                      onClick={() => removeItem(item.id)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {queue.length === 0 && (
        <div className="glass-panel rounded-3xl border border-slate-800 p-8 text-center space-y-2">
          <FileText className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-sm text-slate-500 font-semibold">{t('uploadEmptyState')}</p>
          <p className="text-xs text-slate-600">{t('uploadDropSub')}</p>
        </div>
      )}

    </div>
  );
}
