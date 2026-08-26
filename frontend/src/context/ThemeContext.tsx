'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type Theme = 'dark' | 'light' | 'system';

interface ThemeContextType {
  theme: Theme;
  /** What is actually on screen once "system" has been resolved. */
  resolved: 'dark' | 'light';
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'app_theme';

function systemPrefers(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

/**
 * Light/dark theming.
 *
 * The class goes on <html>, where Tailwind's slate scale is redefined (see
 * globals.css), so one attribute re-themes every screen.
 *
 * "system" is a real third state rather than a default: a technician on a
 * bright workshop floor and one reviewing at a desk want different things, and
 * following the OS is usually the right answer until they say otherwise.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [resolved, setResolved] = useState<'dark' | 'light'>('dark');

  const apply = useCallback((next: Theme) => {
    const effective = next === 'system' ? systemPrefers() : next;
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    root.classList.add(effective);
    // Themes the browser's own chrome — scrollbars, form controls, the URL bar
    // on mobile — which would otherwise stay dark on a light page.
    root.style.colorScheme = effective;
    setResolved(effective);
  }, []);

  useEffect(() => {
    let initial: Theme = 'dark';
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
      if (saved === 'dark' || saved === 'light' || saved === 'system') initial = saved;
    } catch {
      /* private mode, or storage disabled */
    }
    setThemeState(initial);
    apply(initial);
  }, [apply]);

  // Follow the OS while the preference is "system".
  useEffect(() => {
    if (theme !== 'system' || typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => apply('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme, apply]);

  const setTheme = useCallback(
    (next: Theme) => {
      setThemeState(next);
      apply(next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* nothing to do; the choice simply will not persist */
      }
    },
    [apply],
  );

  const toggle = useCallback(() => {
    setTheme(resolved === 'dark' ? 'light' : 'dark');
  }, [resolved, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

/**
 * Applies the saved theme before first paint.
 *
 * Without this the page renders dark, then swaps to light once React hydrates —
 * a white flash on every navigation for anyone using light mode.
 */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var t = localStorage.getItem('${STORAGE_KEY}') || 'dark';
    var e = t === 'system'
      ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : t;
    document.documentElement.classList.add(e);
    document.documentElement.style.colorScheme = e;
  } catch (_) {
    document.documentElement.classList.add('dark');
  }
})();
`;
