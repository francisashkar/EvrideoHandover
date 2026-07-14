/** @type {import('tailwindcss').Config} */
export default {
  // Dark is the default; the `.light` class on <html> switches to light mode
  darkMode: ['selector', ':root:not(.light)'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        noc: {
          bg: 'rgb(var(--noc-bg) / <alpha-value>)',
          panel: 'rgb(var(--noc-panel) / <alpha-value>)',
          panel2: 'rgb(var(--noc-panel2) / <alpha-value>)',
          panel3: 'rgb(var(--noc-panel3) / <alpha-value>)',
          border: 'rgb(var(--noc-border) / <alpha-value>)',
          borderLight: 'rgb(var(--noc-border-light) / <alpha-value>)',
          accent: '#00a884',
          accent2: 'rgb(var(--noc-accent2) / <alpha-value>)',
          accent3: '#06cf9c',
          bubbleOut: 'rgb(var(--noc-bubble-out) / <alpha-value>)',
          bubbleIn: 'rgb(var(--noc-bubble-in) / <alpha-value>)',
          teal: '#008069',
          t1: 'rgb(var(--noc-t1) / <alpha-value>)',
          t2: 'rgb(var(--noc-t2) / <alpha-value>)',
          t3: 'rgb(var(--noc-t3) / <alpha-value>)',
          t4: 'rgb(var(--noc-t4) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['"Heebo"', '"Segoe UI"', 'Tahoma', 'Arial', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      backgroundImage: {
        'noc-gradient': 'linear-gradient(135deg, #00a884 0%, #06cf9c 100%)',
      },
    },
  },
  plugins: [],
}
