'use client';

import { useState, useEffect } from 'react';
import { Users, UserPlus, KeyRound, CheckCircle2, AlertCircle, RefreshCw, ShieldAlert } from 'lucide-react';
import PasswordInput from '@/components/PasswordInput';
import { useLanguage } from '@/context/LanguageContext';

export default function AdminUsersPage() {
  const { t } = useLanguage();
  const [users, setUsers] = useState<any[]>([]);
  const [token, setToken] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New User Modal State
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [regForm, setRegForm] = useState({
    username: '',
    email: '',
    password: '',
    full_name: '',
    role: 'TECHNICIAN'
  });

  // Admin Password Override Modal State
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [targetUser, setTargetUser] = useState<any>(null);
  const [newPasswordOverride, setNewPasswordOverride] = useState('');

  useEffect(() => {
    const t = localStorage.getItem('jwt_token');
    if (t) {
      setToken(t);
      fetchUsers(t);
    } else {
      setIsLoading(false);
    }
  }, []);

  const fetchUsers = async (authToken: string) => {
    setIsLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/v1/admin/users', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (e) {
      console.error('Fetch users error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    try {
      const res = await fetch('http://localhost:8000/api/v1/admin/users/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(regForm)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Échec de création');

      setMsg({ type: 'success', text: `Compte utilisateur ${data.username} créé avec succès !` });
      setIsRegisterOpen(false);
      setRegForm({ username: '', email: '', password: '', full_name: '', role: 'TECHNICIAN' });
      fetchUsers(token);
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message });
    }
  };

  const handleAdminResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    if (!targetUser || !newPasswordOverride) return;

    try {
      const res = await fetch(`http://localhost:8000/api/v1/admin/users/${targetUser.id}/reset-password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ new_password: newPasswordOverride })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Échec du réinitialisation');

      setMsg({ type: 'success', text: `Mot de passe réinitialisé pour l'utilisateur ${targetUser.username} !` });
      setIsResetOpen(false);
      setTargetUser(null);
      setNewPasswordOverride('');
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-white">{t('adminUserTitle')}</h1>
            <p className="text-xs text-slate-400">{t('adminUserSub')}</p>
          </div>
        </div>

        <button
          onClick={() => setIsRegisterOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-500/20 flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" /> {t('btnNewUser')}
        </button>
      </div>

      {msg && (
        <div className={`p-4 rounded-2xl border text-xs font-semibold flex items-center gap-2 ${
          msg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Users Table */}
      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
          <span className="text-xs font-bold text-slate-300">{t('adminUserTitle')}</span>
          <button onClick={() => fetchUsers(token)} className="text-slate-400 hover:text-white p-1">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left rtl:text-right text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-4">{t('tableUser')}</th>
                <th className="p-4">{t('tableEmail')}</th>
                <th className="p-4">{t('tableRole')}</th>
                <th className="p-4">{t('tableStatus')}</th>
                <th className="p-4 text-right rtl:text-left">{t('tableActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-850/50 transition">
                  <td className="p-4 font-bold text-white">
                    {u.full_name}
                    <div className="text-[10px] text-slate-400 font-mono">@{u.username}</div>
                  </td>
                  <td className="p-4 text-slate-300 font-mono">{u.email}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      u.role === 'ADMINISTRATOR' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                      u.role === 'DIRECTOR' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                      u.role === 'VALIDATOR' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                      'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {t('statusActive')}
                    </span>
                  </td>
                  <td className="p-4 text-right rtl:text-left">
                    <button
                      onClick={() => {
                        setTargetUser(u);
                        setIsResetOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-semibold flex items-center gap-1.5 ml-auto rtl:mr-auto rtl:ml-0"
                    >
                      <KeyRound className="w-3.5 h-3.5" /> {t('btnOverridePass')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Register User */}
      {isRegisterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="glass-panel rounded-3xl p-6 max-w-md w-full border border-slate-800 space-y-4 shadow-2xl">
            <h2 className="text-sm font-bold text-white border-b border-slate-800 pb-2">{t('btnNewUser')}</h2>
            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400">{t('tableUser')}</label>
                <input
                  type="text"
                  required
                  value={regForm.username}
                  onChange={(e) => setRegForm({ ...regForm, username: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none"
                />
              </div>
              <div>
                <label className="text-slate-400">Nom Complet</label>
                <input
                  type="text"
                  required
                  value={regForm.full_name}
                  onChange={(e) => setRegForm({ ...regForm, full_name: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none"
                />
              </div>
              <div>
                <label className="text-slate-400">{t('tableEmail')}</label>
                <input
                  type="email"
                  required
                  value={regForm.email}
                  onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none"
                />
              </div>
              <div>
                <label className="text-slate-400">Mot de Passe Initial</label>
                <PasswordInput
                  value={regForm.password}
                  onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                />
              </div>
              <div>
                <label className="text-slate-400">{t('tableRole')}</label>
                <select
                  value={regForm.role}
                  onChange={(e) => setRegForm({ ...regForm, role: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none"
                >
                  <option value="TECHNICIAN">TECHNICIAN (Technicien Étalonneur)</option>
                  <option value="VALIDATOR">VALIDATOR (Responsable Validation)</option>
                  <option value="DIRECTOR">DIRECTOR (Directeur du Laboratoire)</option>
                  <option value="ADMINISTRATOR">ADMINISTRATOR (Admin Système)</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end space-x-2 rtl:space-x-reverse">
                <button type="button" onClick={() => setIsRegisterOpen(false)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300">Annuler</button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-purple-600 text-white font-bold">Créer Compte</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Admin Password Reset */}
      {isResetOpen && targetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="glass-panel rounded-3xl p-6 max-w-md w-full border border-slate-800 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2 text-amber-400 font-bold text-sm">
              <ShieldAlert className="w-5 h-5" /> {t('btnOverridePass')}
            </div>
            <p className="text-xs text-slate-300">Réinitialiser le mot de passe pour <span className="font-bold text-white">{targetUser.full_name}</span> (@{targetUser.username}):</p>
            <form onSubmit={handleAdminResetPassword} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400">Nouveau Mot de Passe Forcé</label>
                <PasswordInput
                  value={newPasswordOverride}
                  onChange={(e) => setNewPasswordOverride(e.target.value)}
                  placeholder="Saisissez le nouveau mot de passe..."
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2 rtl:space-x-reverse">
                <button type="button" onClick={() => setIsResetOpen(false)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300">Annuler</button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-amber-600 text-white font-bold">Forcer la Réinitialisation</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
