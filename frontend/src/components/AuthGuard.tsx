'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { getToken, getUser } from '@/lib/api';

// Routes reachable without a session.
const PUBLIC_ROUTES = ['/', '/login'];

/**
 * Gate on authentication only.
 *
 * The platform runs on a single role: every signed-in user is a technician
 * with full rights, so there is no per-route role table to consult any more.
 *
 * Children are held back until the check completes. Rendering them first and
 * redirecting afterwards briefly exposed protected pages to signed-out
 * visitors, and fired their data requests with no token attached.
 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  const isPublic = PUBLIC_ROUTES.includes(pathname);

  useEffect(() => {
    if (isPublic) {
      setChecked(true);
      return;
    }

    if (!getToken() || !getUser()) {
      router.replace('/login');
      return;
    }

    setChecked(true);
  }, [pathname, router, isPublic]);

  if (!checked) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        <span className="text-xs font-semibold">Vérification de la session…</span>
      </div>
    );
  }

  return <>{children}</>;
}
