'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/', '/login'];

// Route → required role(s). Empty array = any authenticated user
const PROTECTED_ROUTES: Record<string, string[]> = {
  '/dashboard': [],
  '/upload': ['TECHNICIAN'],
  '/certificates': ['TECHNICIAN', 'VALIDATOR'],
  '/eval-5certs': ['VALIDATOR'],
  '/reports': ['VALIDATOR', 'DIRECTOR'],
  '/director-dashboard': ['DIRECTOR'],
  '/admin/users': ['ADMINISTRATOR'],
  '/admin/docker-metrics': ['ADMINISTRATOR'],
};

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = localStorage.getItem('jwt_token');
    const userStr = localStorage.getItem('jwt_user');

    // Allow public routes always
    if (PUBLIC_ROUTES.includes(pathname)) return;

    // No token → redirect to login
    if (!token || !userStr) {
      router.replace('/login');
      return;
    }

    // Parse user
    let user: any = null;
    try {
      user = JSON.parse(userStr);
    } catch {
      router.replace('/login');
      return;
    }

    const role: string = user?.role || '';

    // Find if current route has role restrictions
    // Match exact route or prefix (e.g. /admin/users matches /admin/*)
    const matchedRoute = Object.keys(PROTECTED_ROUTES).find((r) =>
      pathname === r || pathname.startsWith(r + '/')
    );

    if (matchedRoute) {
      const allowedRoles = PROTECTED_ROUTES[matchedRoute];
      // If roles array is non-empty, check membership
      if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
        // Unauthorized role → redirect to their dashboard
        router.replace('/dashboard');
        return;
      }
    }
  }, [pathname, router]);

  return <>{children}</>;
}
