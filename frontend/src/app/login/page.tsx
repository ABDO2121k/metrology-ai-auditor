'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, UserCheck, Lock, ArrowRight, User } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<'ROLE_TECHNICIAN' | 'ROLE_VALIDATOR' | 'ROLE_ADMIN'>('ROLE_VALIDATOR');
  const [username, setUsername] = useState('fatimaezzahrae.sadiki');
  const [password, setPassword] = useState('Password123!');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      router.push('/');
    }, 600);
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center">
      <div className="glass-panel rounded-3xl p-8 max-w-md w-full border border-slate-800 space-y-6 shadow-2xl relative overflow-hidden">
        
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center mx-auto shadow-lg shadow-cyan-500/20">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-wide">Connexion Sécurisée Process Instruments</h1>
          <p className="text-xs text-slate-400">Authentification RBAC — Norme ISO/IEC 17025 (PR.ECE V9)</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4 text-xs">
          
          {/* Role Selector */}
          <div className="space-y-1">
            <label className="text-slate-400 font-semibold">Rôle Métrologique (RBAC)</label>
            <select
              value={role}
              onChange={(e: any) => setRole(e.target.value)}
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold focus:border-cyan-500 outline-none"
            >
              <option value="ROLE_TECHNICIAN">Technicien d'Étalonnage (Saisie / OCR)</option>
              <option value="ROLE_VALIDATOR">Responsable de Validation (Qualité / Signataire)</option>
              <option value="ROLE_ADMIN">Administrateur Système (Audit Logs & Users)</option>
            </select>
          </div>

          {/* Username */}
          <div className="space-y-1">
            <label className="text-slate-400 font-semibold">Identifiant Utilisateur</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label className="text-slate-400 font-semibold">Mot de Passe</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20"
          >
            {isLoading ? 'Connexion en cours...' : 'Se Connecter à Auth-Gateway (Port 8000)'} <ArrowRight className="w-4 h-4" />
          </button>
        </form>

      </div>
    </div>
  );
}
