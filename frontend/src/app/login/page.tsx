'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, User, Key, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';
import PasswordInput from '@/components/PasswordInput';
import { useLanguage } from '@/context/LanguageContext';

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
      const res = await fetch('http://localhost:8000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Nom d\'utilisateur ou mot de passe incorrect.');
      }

      localStorage.setItem('jwt_token', data.token);
      localStorage.setItem('jwt_user', JSON.stringify(data.user));

      // SMART REDIRECTION based on JWT Role
      const role = data.user?.role;
      if (role === 'ADMINISTRATOR') {
        router.push('/admin/docker-metrics');
      } else if (role === 'TECHNICIAN') {
        router.push('/upload');
      } else if (role === 'VALIDATOR') {
        router.push('/certificates');
      } else if (role === 'DIRECTOR') {
        router.push('/director-dashboard');
      } else {
        router.push('/');
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fillCredentials = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center relative overflow-hidden py-8">
      
      {/* Background Lighting Orbs */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-center z-10">
        
        {/* Left Branding Card */}
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" /> PROCESS INSTRUMENTS DÉPARTEMENT ÉLECTRIQUE
          </div>

          <h1 className="text-4xl font-extrabold text-white leading-tight">
            Système Intelligent d'Audit Métrologique <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">ISO 17025</span>
          </h1>

          <p className="text-slate-400 text-xs leading-relaxed">
            Validation automatique des résultats métrologiques, contrôle d'accréditation, vérification d'incertitudes et détection des anomalies par Intelligence Artificielle.
          </p>

          {/* Quick Preset Accounts Panel */}
          <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-3">
            <p className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-cyan-400" /> Comptes de Démonstration Disponibles
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              
              <button
                type="button"
                onClick={() => fillCredentials('fati_sadiki', 'fati2004@')}
                className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-left rtl:text-right hover:bg-purple-500/20 transition group"
              >
                <div className="font-bold text-purple-300">Root Admin</div>
                <div className="text-[10px] text-slate-400">fati_sadiki</div>
              </button>

              <button
                type="button"
                onClick={() => fillCredentials('tech_fati', 'TechPassword123!')}
                className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-left rtl:text-right hover:bg-cyan-500/20 transition group"
              >
                <div className="font-bold text-cyan-300">Technicien</div>
                <div className="text-[10px] text-slate-400">tech_fati</div>
              </button>

              <button
                type="button"
                onClick={() => fillCredentials('val_fati', 'ValPassword123!')}
                className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-left rtl:text-right hover:bg-emerald-500/20 transition group"
              >
                <div className="font-bold text-emerald-300">Responsable Qualité</div>
                <div className="text-[10px] text-slate-400">val_fati</div>
              </button>

              <button
                type="button"
                onClick={() => fillCredentials('director_fati', 'DirectorPassword123!')}
                className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-left rtl:text-right hover:bg-amber-500/20 transition group"
              >
                <div className="font-bold text-amber-300">Directeur Labo</div>
                <div className="text-[10px] text-slate-400">director_fati</div>
              </button>

            </div>
          </div>

        </div>

        {/* Right Glassmorphism Login Form */}
        <div className="glass-panel rounded-3xl p-8 border border-slate-800 space-y-6 shadow-2xl">
          
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center mx-auto shadow-lg shadow-cyan-500/30">
              <ShieldCheck className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white">{t('loginBtn')}</h2>
            <p className="text-xs text-slate-400">Entrez vos identifiants pour accéder à votre espace d'audit</p>
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
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/25 flex items-center justify-center space-x-2 transition"
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
