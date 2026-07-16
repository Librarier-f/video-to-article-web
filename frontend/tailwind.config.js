/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Flat colors are 100% compatible and bug-free across Tailwind versions
        'notion-bg-base': '#191919',
        'notion-bg-surface': '#202020',
        'notion-bg-elevated': '#2f2f2f',
        'notion-border': '#2e2e2e',
        'notion-text-primary': '#e3e3e3',
        'notion-text-secondary': '#9b9b9b',
        'notion-text-muted': '#555555',
        'notion-blue-text': '#4a7ab5',
        'notion-blue-bg': '#0e1f3b',
        'notion-green-text': '#518c5a',
        'notion-green-bg': '#122215',
        'notion-orange-text': '#c07a3d',
        'notion-orange-bg': '#2e1e0f',
        'notion-yellow-text': '#b8a030',
        'notion-yellow-bg': '#292306',
        'notion-pink-text': '#b05c83',
        'notion-pink-bg': '#2e1020',
        'notion-gold': '#E2B53E',
        'notion-purple': '#A78BFA',
        'notion-neonBlue': '#60A5FA',
      },
      fontFamily: {
        serif: ['Noto Serif SC', 'Georgia', 'serif'],
        sans: ['Noto Sans SC', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['SFMono-Regular', 'Menlo', 'monospace'],
      }
    },
  },
  plugins: [],
}
