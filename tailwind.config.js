/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
      },
      colors: {
        ink: {
          50: '#f6f8fb',
          100: '#eef2f7',
          200: '#dbe2ec',
          300: '#c2cdda',
          400: '#9aa5b1',
          500: '#6b7684',
          600: '#4a5563',
          700: '#334155',
          800: '#1f2a3a',
          900: '#18212f',
        },
        brand: {
          50: '#eafaf4',
          100: '#d0f2e3',
          200: '#a3e5c9',
          300: '#6bd3aa',
          400: '#36b887',
          500: '#16a371',
          600: '#0c8559',
          700: '#0a6a48',
          800: '#0a563b',
          900: '#094530',
        },
        accent: {
          400: '#f59e0b',
          500: '#d97706',
          600: '#b45309',
        },
        danger: {
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
        },
      },
      boxShadow: {
        soft: '0 1px 3px rgba(24,33,47,0.06), 0 1px 2px rgba(24,33,47,0.04)',
        card: '0 4px 24px -8px rgba(24,33,47,0.10), 0 2px 6px rgba(24,33,47,0.04)',
        pop: '0 12px 40px -12px rgba(24,33,47,0.22)',
      },
    },
  },
  plugins: [],
};
