/**
 * StackPipeline design system — corporate automation-tooling theme.
 *
 * Tailwind v4 is CSS-first, but this legacy-format config is loaded explicitly from
 * `src/styles/global.css` via `@config "../../tailwind.config.js"`, so it is the real,
 * single source of truth for the palette. Keeping it in JS means the same tokens can be
 * imported by scripts (OG image generation, email templates) without parsing CSS.
 *
 * Palette:
 *   ink     — deep slate blue, the structural/corporate base (backgrounds, chrome)
 *   emerald — crisp accent reserved for CTAs, affiliate actions and links
 *   signal  — semantic states for callouts (pro tip / warning / editor's choice)
 */

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}',
    './public/**/*.html',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f5f7fa',
          100: '#e9eef5',
          200: '#cfdae9',
          300: '#a6bbd4',
          400: '#7695bb',
          500: '#5476a3',
          600: '#405e88',
          700: '#354c6e',
          800: '#2f415d',
          900: '#152238',
          950: '#0b1220',
        },
        emerald: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          950: '#022c22',
        },
        signal: {
          info: '#38bdf8',
          tip: '#34d399',
          warn: '#fbbf24',
          danger: '#f87171',
          choice: '#a78bfa',
        },
      },
      fontFamily: {
        // System stack: zero network requests, zero layout shift, perfect CWV.
        sans: [
          'InterVariable',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'Liberation Mono',
          'Courier New',
          'monospace',
        ],
      },
      maxWidth: {
        prose: '72ch',
        content: '46rem',
        shell: '84rem',
      },
      spacing: {
        header: '4rem',
        18: '4.5rem',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(11 18 32 / 0.06), 0 8px 24px -12px rgb(11 18 32 / 0.18)',
        lift: '0 12px 40px -16px rgb(11 18 32 / 0.35)',
        'emerald-glow': '0 12px 32px -12px rgb(16 185 129 / 0.55)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.35s cubic-bezier(0.22, 1, 0.36, 1) both',
        'pulse-dot': 'pulse-dot 2.4s ease-in-out infinite',
      },
      typography: (/** @type {(path: string) => string} */ theme) => ({
        DEFAULT: {
          css: {
            '--tw-prose-body': theme('colors.ink[700]'),
            '--tw-prose-headings': theme('colors.ink[950]'),
            '--tw-prose-lead': theme('colors.ink[600]'),
            '--tw-prose-links': theme('colors.emerald[700]'),
            '--tw-prose-bold': theme('colors.ink[900]'),
            '--tw-prose-counters': theme('colors.ink[500]'),
            '--tw-prose-bullets': theme('colors.emerald[400]'),
            '--tw-prose-hr': theme('colors.ink[200]'),
            '--tw-prose-quotes': theme('colors.ink[900]'),
            '--tw-prose-quote-borders': theme('colors.emerald[400]'),
            '--tw-prose-captions': theme('colors.ink[500]'),
            '--tw-prose-code': theme('colors.ink[900]'),
            '--tw-prose-pre-code': theme('colors.ink[100]'),
            '--tw-prose-pre-bg': theme('colors.ink[950]'),
            '--tw-prose-th-borders': theme('colors.ink[300]'),
            '--tw-prose-td-borders': theme('colors.ink[200]'),
            maxWidth: '72ch',
          },
        },
      }),
    },
  },
  plugins: [],
};
