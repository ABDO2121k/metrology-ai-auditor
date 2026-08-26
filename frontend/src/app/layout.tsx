'use client';

import './globals.css';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ShieldCheck,
  LayoutDashboard,
  Upload,
  FileSpreadsheet,
  Users,
  Server,
  KeyRound,
  LogOut,
  Globe,
  LogIn,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';
import { LanguageProvider, useLanguage } from '@/context/LanguageContext';
import SelfServicePasswordModal from '@/components/SelfServicePasswordModal';
import AuthGuard from '@/components/AuthGuard';
import { AuthUser, clearSession, getToken, getUser } from '@/lib/api';
import { ThemeProvider, useTheme, THEME_INIT_SCRIPT } from '@/context/ThemeContext';

/**
 * Navigation for the single technician role.
 *
 * Every signed-in user sees the same sections: the role no longer partitions
 * the app. Links to /eval-5certs, /reports and /director-dashboard were
 * removed because no such pages exist — they rendered a 404 on click.
 */
const NAV_ITEMS = [
  { href: '/dashboard', labelKey: 'navHome', Icon: LayoutDashboard, accent: 'text-cyan-400' },
  { href: '/upload', labelKey: 'navUpload', Icon: Upload, accent: 'text-cyan-400' },
  { href: '/certificates', labelKey: 'navCerts', Icon: FileSpreadsheet, accent: 'text-emerald-400' },
  { href: '/admin/users', labelKey: 'navUsers', Icon: Users, accent: 'text-purple-400' },
  { href: '/admin/docker-metrics', labelKey: 'navHealth', Icon: Server, accent: 'text-amber-400' },
];

/** Dark / light / follow-the-system, in one control. */
function ThemeControl() {
  const { theme, setTheme } = useTheme();
  const options = [
    { id: 'light' as const, Icon: Sun, label: 'Clair' },
    { id: 'dark' as const, Icon: Moon, label: 'Sombre' },
    { id: 'system' as const, Icon: Monitor, label: 'Système' },
  ];
  return (
    <div className="flex items-center bg-slate-950/80 border border-slate-800 rounded-xl p-1">
      {options.map(({ id, Icon, label }) => (
        <button
          key={id}
          onClick={() => setTheme(id)}
          title={label}
          aria-label={label}
          aria-pressed={theme === id}
          className={`p-1.5 rounded-lg transition ${
            theme === id ? 'bg-cyan-500 text-on-accent' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Icon className="w-3.5 h-3.5" />
        </button>
      ))}
    </div>
  );
}

function LayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { lang, dir, setLang, t } = useLanguage();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string>('');
  const [isPwdModalOpen, setIsPwdModalOpen] = useState(false);

  const syncSession = useCallback(() => {
    setUser(getUser());
    setToken(getToken());
  }, []);

  useEffect(() => {
    syncSession();
    // Keep the header in step when another tab signs in or out.
    window.addEventListener('storage', syncSession);
    return () => window.removeEventListener('storage', syncSession);
  }, [pathname, syncSession]);

  const handleLogout = () => {
    clearSession();
    setUser(null);
    setToken('');
    router.push('/login');
  };

  const isSignedIn = Boolean(user);
  // The landing and login pages are full-bleed marketing/auth surfaces.
  const hideSidebar = pathname === '/' || pathname === '/login' || !isSignedIn;

  return (
    <div className="min-h-screen flex flex-col text-slate-100" dir={dir}>
      <header className="sticky top-0 z-40 glass-panel border-b border-slate-800/80 px-6 py-3.5 flex justify-between items-center">
        <Link href={isSignedIn ? '/dashboard' : '/'} className="flex items-center space-x-3 rtl:space-x-reverse group">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/25 group-hover:scale-105 transition">
            <ShieldCheck className="w-6 h-6 text-on-accent" />
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

        <div className="flex items-center space-x-3 rtl:space-x-reverse">
          <ThemeControl />

          <div className="flex items-center bg-slate-950/80 border border-slate-800 rounded-xl p-1 text-xs">
            <Globe className="w-4 h-4 text-cyan-400 mx-2" />
            {(['fr', 'en', 'ar'] as const).map((code) => (
              <button
                key={code}
                onClick={() => setLang(code)}
                className={`px-2 py-1 rounded-lg font-bold transition ${
                  lang === code ? 'bg-cyan-500 text-on-accent shadow-sm' : 'text-slate-400 hover:text-on-accent'
                }`}
              >
                {code === 'ar' ? 'عربي' : code.toUpperCase()}
              </button>
            ))}
          </div>

          {isSignedIn ? (
            <div className="flex items-center space-x-3 rtl:space-x-reverse">
              <div className="text-right rtl:text-left">
                <p className="text-xs font-bold text-white">{user?.full_name || user?.username}</p>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {t('role_TECHNICIAN')}
                </span>
              </div>

              {/* Dashboard shortcut. This previously sat in the signed-out
                  branch, so it appeared only to visitors who could not use it. */}
              <Link
                href="/dashboard"
                title={t('navHome')}
                className="p-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/30 transition"
              >
                <LayoutDashboard className="w-4 h-4" />
              </Link>

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
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-on-accent font-bold text-xs shadow-lg shadow-cyan-500/20 flex items-center gap-2 transition"
            >
              <LogIn className="w-4 h-4" /> {t('loginBtn')}
            </Link>
          )}
        </div>
      </header>

      <div className="flex-1 flex">
        {!hideSidebar && (
          <aside className="w-64 glass-panel border-r rtl:border-r-0 rtl:border-l border-slate-800/80 p-4 space-y-1 hidden md:block">
            <p className="px-3 pb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              {t('sidebarWorkspace')}
            </p>
            {NAV_ITEMS.map(({ href, labelKey, Icon, accent }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                    active
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${accent}`} /> {t(labelKey)}
                </Link>
              );
            })}
          </aside>
        )}

        <main className="flex-1 p-6 max-w-[1600px] w-full mx-auto">
          <AuthGuard>{children}</AuthGuard>
        </main>
      </div>

      <SelfServicePasswordModal
        isOpen={isPwdModalOpen}
        onClose={() => setIsPwdModalOpen(false)}
        token={token}
      />

      <footer className="glass-panel border-t border-slate-800/80 px-6 py-4 text-center text-xs text-slate-500">
        <div className="flex flex-wrap gap-2 justify-between items-center max-w-[1600px] mx-auto">
          <span>© 2026 Process Instruments — Système Intelligent d'Audit Métrologique</span>
          <span>NM 2018 | ISO/IEC 17025:2017 | PR.ECE V9 | PRO.MDD V23</span>
        </div>
      </footer>
    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/* Applies the saved theme before first paint; without it a light-mode
            user gets a dark flash on every navigation. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>
          <LanguageProvider>
            <LayoutInner>{children}</LayoutInner>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
