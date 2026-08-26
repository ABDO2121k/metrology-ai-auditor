/** @type {import('tailwindcss').Config} */

/**
 * The palette resolves through CSS variables so the whole app can switch theme
 * without touching a single component.
 *
 * Every screen was written against the dark palette directly — `bg-slate-950`,
 * `text-slate-400`, `border-slate-800` appear hundreds of times. Rewriting each
 * one with a `dark:` counterpart would have been a large, error-prone edit that
 * would also have to be repeated for every new component. Redefining what those
 * scale steps *mean* per theme themes the entire surface at once, and keeps the
 * class names readable.
 *
 * In light mode the scale is inverted: slate-950 becomes the lightest surface
 * and slate-100 the darkest text, so "dark background, light text" written in
 * the components stays true in both themes.
 */
const withVar = (name) => `rgb(var(${name}) / <alpha-value>)`;

module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          50: withVar('--slate-50'),
          100: withVar('--slate-100'),
          200: withVar('--slate-200'),
          300: withVar('--slate-300'),
          400: withVar('--slate-400'),
          500: withVar('--slate-500'),
          600: withVar('--slate-600'),
          700: withVar('--slate-700'),
          800: withVar('--slate-800'),
          850: withVar('--slate-850'),
          900: withVar('--slate-900'),
          950: withVar('--slate-950'),
        },
        // Components use text-white for primary text on a dark ground; in light
        // mode that has to become near-black or every heading disappears.
        white: withVar('--text-strong'),
      },
    },
  },
  plugins: [],
};
