'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, User, Key, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';
import PasswordInput from '@/components/PasswordInput';
import { useLanguage } from '@/context/LanguageContext';
import { api, setSession } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const { t } = useLanguage();

  const [username, setUsername] = useState('fati_sadiki');
  const [password, setPassword] = useState('fati2004@');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    try {
      const data = await api.login(username, password);
      setSession(data.token, data.user);
      // One role, one destination. The old per-role switch sent every branch
      // to the same place anyway.
      router.push('/dashboard');
    } catch (err: any) {
      setErrorMsg(err?.message || "Nom d'utilisateur ou mot de passe incorrect.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center relative overflow-hidden py-8">
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-center z-10">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" /> PROCESS INSTRUMENTS DÉPARTEMENT ÉLECTRIQUE
          </div>

          <h1 className="text-4xl font-extrabold text-white leading-tight">
            Système Intelligent d'Audit Métrologique{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
              ISO 17025
            </span>
          </h1>

          <p className="text-slate-400 text-xs leading-relaxed">
            Validation automatique des résultats métrologiques, contrôle d'accréditation,
            vérification d'incertitudes et détection des anomalies par Intelligence Artificielle.
          </p>

          <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-3">
            <p className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-cyan-400" /> {t('loginDemoTitle')}
            </p>
            {/* A single account: the technician role covers every task. */}
            <button
              type="button"
              onClick={() => {
                setUsername('fati_sadiki');
                setPassword('fati2004@');
              }}
              className="w-full p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-left rtl:text-right hover:bg-cyan-500/20 transition"
            >
              <div className="font-bold text-cyan-300 text-xs">{t('role_TECHNICIAN')}</div>
              <div className="text-[10px] text-slate-400 font-mono">fati_sadiki</div>
            </button>
            <p className="text-[10px] text-slate-500 leading-relaxed">{t('loginDemoNote')}</p>
          </div>
        </div>

        <div className="glass-panel rounded-3xl p-8 border border-slate-800 space-y-6 shadow-2xl">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center mx-auto shadow-lg shadow-cyan-500/30">
              <ShieldCheck className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white">{t('loginBtn')}</h2>
            <p className="text-xs text-slate-400">
              Entrez vos identifiants pour accéder à votre espace d'audit
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="text-slate-300 font-semibold">Nom d'Utilisateur</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3 rtl:left-auto rtl:right-3.5" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ex: fati_sadiki"
                  className="w-full pl-10 pr-4 rtl:pl-4 rtl:pr-10 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white outline-none focus:border-cyan-500 font-medium"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-slate-300 font-semibold">Mot de Passe</label>
              <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/25 flex items-center justify-center space-x-2 transition disabled:opacity-50"
            >
              <span>{isLoading ? 'Authentification...' : t('loginBtn')}</span>
              {!isLoading && <ArrowRight className="w-4 h-4 rtl:rotate-180" />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
