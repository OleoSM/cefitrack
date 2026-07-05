/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        /* Paleta institucional SIGA CEFIMAT — azul marino del logo (#1E3A6E) */
        navy: {
          50:  '#f0f4fa',
          100: '#dce6f4',
          200: '#c0d2ea',
          300: '#96b3da',
          400: '#658dc6',
          500: '#446fb2',
          600: '#2f5495',
          700: '#1e3a6e',
          800: '#182e57',
          900: '#122343',
          950: '#0a1428',
        },
        /* Rojo carmesí del logo (#A11C33) */
        crimson: {
          50:  '#fbf1f3',
          100: '#f6dfe3',
          200: '#eec0c8',
          300: '#de92a0',
          400: '#c95f72',
          500: '#b23348',
          600: '#a11c33',
          700: '#88182b',
          800: '#701424',
          900: '#5a1220',
        },
        gold: {
          50:  '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Manrope', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card:     '0 1px 3px rgba(0,0,0,.05), 0 1px 2px rgba(0,0,0,.04)',
        'card-md':'0 4px 16px rgba(0,0,0,.08), 0 2px 6px rgba(0,0,0,.04)',
        'card-lg':'0 12px 40px rgba(0,0,0,.10), 0 4px 12px rgba(0,0,0,.05)',
        'glow-gold':'0 0 0 3px rgba(251,191,36,.35)',
        'glow-navy':'0 0 0 3px rgba(15,43,91,.25)',
        'inner-sm':'inset 0 1px 2px rgba(0,0,0,.06)',
      },
    },
  },
  plugins: [],
}
