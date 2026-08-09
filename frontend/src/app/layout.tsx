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
  PieChart, 
  Globe,
  LogIn
} from 'lucide-react';
import { LanguageProvider, useLanguage, Language } from '@/context/LanguageContext';
import SelfServicePasswordModal from '@/components/SelfServicePasswordModal';

function LayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { lang, dir, setLang, t } = useLanguage();

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
    } else {
      setUser(null);
      setToken('');
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
    <div className="min-h-screen flex flex-col bg-[#0a0f1d] text-slate-100" dir={dir}>
      
      {/* Topbar Navigation */}
      <header className="sticky top-0 z-40 glass-panel border-b border-slate-800/80 px-6 py-3.5 flex justify-between items-center">
        
        {/* Left Branding */}
        <Link href="/" className="flex items-center space-x-3 rtl:space-x-reverse group">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/25 group-hover:scale-105 transition">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 rtl:gap-2">
              <span className="font-extrabold text-base tracking-wide text-white group-hover:text-cyan-300 transition">
                {t('appName')}
              </span>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-full">
                {t('isoBadge')}
              </span>
            </div>
            <p className="text-[10px] text-slate-400">{t('appSub')}</p>
          </div>
        </Link>

        {/* Right Action Controls & Language Selector */}
        <div className="flex items-center space-x-4 rtl:space-x-reverse">
          
          {/* Language Selector Dropdown */}
          <div className="flex items-center bg-slate-950/80 border border-slate-800 rounded-xl p-1 text-xs">
            <Globe className="w-4 h-4 text-cyan-400 mx-2" />
            <button
              onClick={() => setLang('fr')}
              className={`px-2 py-1 rounded-lg font-bold transition ${lang === 'fr' ? 'bg-cyan-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
            >
              FR
            </button>
            <button
              onClick={() => setLang('en')}
              className={`px-2 py-1 rounded-lg font-bold transition ${lang === 'en' ? 'bg-cyan-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
            >
              EN
            </button>
            <button
              onClick={() => setLang('ar')}
              className={`px-2 py-1 rounded-lg font-bold transition ${lang === 'ar' ? 'bg-cyan-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
            >
              عربي
            </button>
          </div>

          {/* User Logged In Controls OR Login Button */}
          {user ? (
            <div className="flex items-center space-x-3 rtl:space-x-reverse">
              <div className="text-right rtl:text-left">
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
                title={t('profilePwd')}
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition"
              >
                <KeyRound className="w-4 h-4 text-cyan-400" />
              </button>

              <button
                onClick={handleLogout}
                title={t('logoutBtn')}
                className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link 
              href="/login"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 flex items-center gap-2 transition"
            >
              <LogIn className="w-4 h-4" /> {t('loginBtn')}
            </Link>
          )}

        </div>
      </header>

      {/* Main Container with Dynamic Sidebar */}
      <div className="flex-1 flex">
        
        {/* Dynamic Sidebar (Hidden on Login page) */}
        {!isLoginPage && (
          <aside className="w-64 glass-panel border-r rtl:border-r-0 rtl:border-l border-slate-800/80 p-4 space-y-6 hidden md:block">
            
            <div className="space-y-1">
              <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('navHome')}</p>
              <Link
                href="/"
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                  pathname === '/' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 text-cyan-400" /> {t('navHome')}
              </Link>
            </div>

            {/* TECHNICIAN Role Sidebar Links */}
            {(role === 'TECHNICIAN' || role === 'ADMINISTRATOR') && (
              <div className="space-y-1">
                <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Technician Portal</p>
                <Link
                  href="/upload"
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                    pathname === '/upload' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                  }`}
                >
                  <Upload className="w-4 h-4 text-cyan-400" /> {t('navUpload')}
                </Link>
              </div>
            )}

            {/* VALIDATOR Role Sidebar Links */}
            {(role === 'VALIDATOR' || role === 'ADMINISTRATOR') && (
              <div className="space-y-1">
                <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Validator Portal</p>
                <Link
                  href="/certificates"
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                    pathname === '/certificates' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> {t('navCerts')}
                </Link>
                <Link
                  href="/eval-5certs"
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                    pathname === '/eval-5certs' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                  }`}
                >
                  <Layers className="w-4 h-4 text-cyan-400" /> {t('nav5Certs')}
                </Link>
              </div>
            )}

            {/* DIRECTOR Role Sidebar Links */}
            {(role === 'DIRECTOR' || role === 'ADMINISTRATOR') && (
              <div className="space-y-1">
                <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Director Portal</p>
                <Link
                  href="/director-dashboard"
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                    pathname === '/director-dashboard' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                  }`}
                >
                  <PieChart className="w-4 h-4 text-amber-400" /> {t('navDirector')}
                </Link>
                <Link
                  href="/reports"
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                    pathname === '/reports' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                  }`}
                >
                  <FileCheck className="w-4 h-4 text-cyan-400" /> {t('navReports')}
                </Link>
              </div>
            )}

            {/* ADMINISTRATOR Role Sidebar Links */}
            {role === 'ADMINISTRATOR' && (
              <div className="space-y-1">
                <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Admin Portal</p>
                <Link
                  href="/admin/users"
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                    pathname === '/admin/users' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                  }`}
                >
                  <Users className="w-4 h-4 text-purple-400" /> {t('navUsers')}
                </Link>
                <Link
                  href="/admin/health"
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                    pathname === '/admin/health' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                  }`}
                >
                  <Activity className="w-4 h-4 text-emerald-400" /> {t('navHealth')}
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
          <span>© 2026 Process Instruments — Système Intelligent d'Audit Métrologique</span>
          <span>NM 2018 | ISO/IEC 17025:2017 | PR.ECE V9 | PRO.MDD V23</span>
        </div>
      </footer>

    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="dark">
      <body>
        <LanguageProvider>
          <LayoutInner>{children}</LayoutInner>
        </LanguageProvider>
      </body>
    </html>
  );
}
