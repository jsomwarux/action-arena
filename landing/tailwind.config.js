/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand / accent — mapped 1:1 from TOKENS.md
        'electric-green': '#00FF87',
        'coral-red': '#FF4757',
        gold: '#FFD700',
        'amber-accent': '#FFA502',
        'cyan-accent': '#18DCFF',
        // Surfaces / text
        'arena-bg': '#0A0E1A',
        'arena-surface': '#111827',
        surfaceMuted: '#182235',
        textPrimary: '#F8FAFC',
        textMuted: 'rgba(255,255,255,0.58)',
        border: 'rgba(255,255,255,0.12)',
      },
      fontFamily: {
        // Display: Bebas Neue (self-hosted via @fontsource). Caps-only broadcast face.
        display: ['"Bebas Neue"', '"Anton"', '"Impact"', 'system-ui', 'sans-serif'],
        // Body: Inter (self-hosted via @fontsource).
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['ui-monospace', '"SF Mono"', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      transitionTimingFunction: {
        arena: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      transitionDuration: {
        650: '650ms',
      },
    },
  },
  plugins: [],
};
