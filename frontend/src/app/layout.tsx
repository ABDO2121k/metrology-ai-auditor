'use client';

import './globals.css';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  ShieldCheck, 
  LayoutDashboard, 
  Upload, 
  FileSpreadsheet, 
  Layers, 
  FileCheck, 
  Users, 
  Activity, 
  KeyRound, 
  LogOut, 
  PieChart 
} from 'lucide-react';
import SelfServicePasswordModal from '@/components/SelfServicePasswordModal';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string>('');
  const [isPwdModalOpen, setIsPwdModalOpen] = useState(false);

  useEffect(() => {
    const savedToken = localStorage.getItem('jwt_token');
    const savedUser = localStorage.getItem('jwt_user');

    if (savedToken && savedUser) {
      setToken(savedToken);
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {}
    }
  }, [pathname]);

  const handleLogout = () => {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('jwt_user');
    setUser(null);
    setToken('');
    router.push('/login');
  };

  const isLoginPage = pathname === '/login';

  const role = user?.role || 'GUEST';

  return (
    <html lang="fr" className="dark">
      <body className="min-h-screen flex flex-col bg-[#0a0f1d] text-slate-100">
        
        {/* Topbar */}
        <header className="sticky top-0 z-40 glass-panel border-b border-slate-800/80 px-6 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-wide text-white">PROCESS INSTRUMENTS</span>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-full">
                  ISO/IEC 17025
                </span>
              </div>
              <p className="text-[10px] text-slate-400">Plateforme d'Audit Métrologique & Détection d'Anomalies</p>
            </div>
          </div>

          {/* User Profile Controls */}
          {user ? (
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-xs font-bold text-white">{user.full_name || user.username}</p>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  user.role === 'ADMINISTRATOR' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                  user.role === 'DIRECTOR' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                  user.role === 'VALIDATOR' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                  'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                }`}>
                  {user.role}
                </span>
              </div>

              <button
                onClick={() => setIsPwdModalOpen(true)}
                title="Changer mon mot de passe"
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition"
              >
                <KeyRound className="w-4 h-4 text-cyan-400" />
              </button>

              <button
                onClick={handleLogout}
                title="Déconnexion"
                className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link 
              href="/login"
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-md shadow-cyan-950/40 transition"
            >
              Se Connecter
            </Link>
          )}
        </header>

        {/* Main Body Layout with Dynamic Sidebar */}
        <div className="flex-1 flex">
          
          {/* Dynamic Sidebar (Hidden on Login Page) */}
          {!isLoginPage && (
            <aside className="w-64 glass-panel border-r border-slate-800/80 p-4 space-y-6 hidden md:block">
              
              <div className="space-y-1">
                <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Navigation Principale</p>
                
                <Link
                  href="/"
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                    pathname === '/' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4 text-cyan-400" /> Vue d'Ensemble
                </Link>
              </div>

              {/* TECHNICIAN Role Menu Items */}
              {(role === 'TECHNICIAN' || role === 'ADMINISTRATOR') && (
                <div className="space-y-1">
                  <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Saisie & Ingestion</p>
                  
                  <Link
                    href="/upload"
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                      pathname === '/upload' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                    }`}
                  >
                    <Upload className="w-4 h-4 text-cyan-400" /> Studio Dépôt PDF
                  </Link>
                </div>
              )}

              {/* VALIDATOR Role Menu Items */}
              {(role === 'VALIDATOR' || role === 'ADMINISTRATOR') && (
                <div className="space-y-1">
                  <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Validation & Qualité</p>
                  
                  <Link
                    href="/certificates"
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                      pathname === '/certificates' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                    }`}
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Registre Certificats
                  </Link>

                  <Link
                    href="/eval-5certs"
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                      pathname === '/eval-5certs' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                    }`}
                  >
                    <Layers className="w-4 h-4 text-cyan-400" /> Studio 5 Certificats
                  </Link>
                </div>
              )}

              {/* DIRECTOR Role Menu Items */}
              {(role === 'DIRECTOR' || role === 'ADMINISTRATOR') && (
                <div className="space-y-1">
                  <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Management & Direction</p>
                  
                  <Link
                    href="/director-dashboard"
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                      pathname === '/director-dashboard' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                    }`}
                  >
                    <PieChart className="w-4 h-4 text-amber-400" /> Dashboard Directeur (Charts)
                  </Link>

                  <Link
                    href="/reports"
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                      pathname === '/reports' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                    }`}
                  >
                    <FileCheck className="w-4 h-4 text-cyan-400" /> Archive Rapports PDF
                  </Link>
                </div>
              )}

              {/* ADMINISTRATOR Role Menu Items */}
              {role === 'ADMINISTRATOR' && (
                <div className="space-y-1">
                  <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Administration Système</p>
                  
                  <Link
                    href="/admin/users"
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                      pathname === '/admin/users' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                    }`}
                  >
                    <Users className="w-4 h-4 text-purple-400" /> Gestion Utilisateurs & Mots de Passe
                  </Link>

                  <Link
                    href="/admin/health"
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                      pathname === '/admin/health' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                    }`}
                  >
                    <Activity className="w-4 h-4 text-emerald-400" /> Santé Microservices Docker
                  </Link>
                </div>
              )}

            </aside>
          )}

          {/* Main Content Workspace */}
          <main className="flex-1 p-6 max-w-[1600px] w-full mx-auto">
            {children}
          </main>
        </div>

        {/* Self-Service Password Modal */}
        <SelfServicePasswordModal
          isOpen={isPwdModalOpen}
          onClose={() => setIsPwdModalOpen(false)}
          token={token}
        />

        {/* Footer */}
        <footer className="glass-panel border-t border-slate-800/80 px-6 py-4 text-center text-xs text-slate-500">
          <div className="flex justify-between items-center max-w-[1600px] mx-auto">
            <span>© 2026 Process Instruments — Système d'Audit Automatisé par Intelligence Artificielle</span>
            <span>Normes : NM 2018 | ISO/IEC 17025:2017 | PR.ECE V9 | PRO.MDD V23</span>
          </div>
        </footer>

      </body>
    </html>
  );
}
