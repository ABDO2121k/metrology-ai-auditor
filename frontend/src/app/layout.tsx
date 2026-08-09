import './globals.css';
import Link from 'next/link';
import { ShieldCheck, Cpu, FileSpreadsheet, LayoutDashboard, Layers, Server } from 'lucide-react';

export const metadata = {
  title: 'Process Instruments — Plateforme d\'Audit Métrologique IA (ISO 17025)',
  description: 'Système d\'analyse, d\'OCR, de contrôle de conformité et de détection d\'anomalies pour certificats d\'étalonnage',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className="dark">
      <body className="min-h-screen flex flex-col bg-[#0a0f1d] text-slate-100">
        
        {/* Glassmorphism Navigation Bar */}
        <header className="sticky top-0 z-50 glass-panel border-b border-slate-800/80 px-6 py-3.5 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-wide text-white">PROCESS INSTRUMENTS</span>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 rounded-full">
                  ISO 17025 IA
                </span>
              </div>
              <p className="text-xs text-slate-400">Plateforme d'Audit Métrologique & Détection d'Anomalies</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center space-x-2">
            <Link
              href="/"
              className="px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition hover:bg-slate-800/60 text-slate-300 hover:text-white"
            >
              <LayoutDashboard className="w-4 h-4 text-cyan-400" /> Dashboard
            </Link>

            <Link
              href="/eval-5certs"
              className="px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-cyan-300 border border-cyan-500/30 hover:border-cyan-400 shadow-md shadow-cyan-950/40"
            >
              <Layers className="w-4 h-4 text-cyan-400" /> Studio 5 Certificats
            </Link>

            <Link
              href="/certificates/ARRM13388-26"
              className="px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition hover:bg-slate-800/60 text-slate-300 hover:text-white"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Studio Split-View
            </Link>
          </nav>

          {/* Microservices Live Status Indicator */}
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>8 Microservices Docker En Ligne</span>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 p-6 max-w-[1600px] w-full mx-auto">
          {children}
        </main>

        {/* Glassmorphism Footer */}
        <footer className="glass-panel border-t border-slate-800/80 px-6 py-4 mt-12 text-center text-xs text-slate-500">
          <div className="flex justify-between items-center max-w-[1600px] mx-auto">
            <span>© 2026 Process Instruments — Système d'Audit Automatisé par Intelligence Artificielle</span>
            <span>Normes : NM 2018 | ISO/IEC 17025:2017 | PR.ECE V9 | PRO.MDD V23</span>
          </div>
        </footer>

      </body>
    </html>
  );
}
