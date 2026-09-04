/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Ported 1:1 from the mobile app's tailwind.config.js + constants/theme.ts.
        // Any token added here must be added there too, and vice versa.
        'amber-accent': '#FFA502', // parlay bet type accent
        'arena-bg': '#0A0E1A',
        'arena-surface': '#111827',
        bronze: '#CD7F32',
        'bronze-text': '#E8A268',
        'coral-red': '#FF4757', // losses, negative states, destructive
        'cyan-accent': '#18DCFF', // teaser bet type accent
        'electric-green': '#00FF87', // profits, wins, positive actions
        gold: '#FFD700', // achievements, trophies, rankings
        silver: '#C0C0C0',
        'silver-text': '#E5E7EB',
        surfaceMuted: '#182235',
        textPrimary: '#F8FAFC',
        textMuted: 'rgba(255,255,255,0.58)',
        border: 'rgba(255,255,255,0.12)',
      },
      fontFamily: {
        // Display: Bebas Neue (self-hosted via @fontsource). Condensed caps,
        // the sports-broadcast feel called for in AGENTS.md.
        display: ['"Bebas Neue"', '"Anton"', '"Impact"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['ui-monospace', '"SF Mono"', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      transitionTimingFunction: {
        arena: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      transitionDuration: {
        650: '650ms',
      },
      keyframes: {
        // Skeleton shimmer — the web stand-in for the mobile Animated.loop.
        'arena-shimmer': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'arena-shimmer': 'arena-shimmer 1.3s ease-in-out infinite',
      },
      spacing: {
        sidebar: '15rem', // fixed left nav width; main content offsets by this
        topbar: '4rem',
      },
      maxWidth: {
        // Two content width tiers. See AppShell's ShellWidth doc comment.
        content: '80rem', // 1280px — reading-oriented screens
        'content-wide': '120rem', // 1920px — dense, data-heavy screens
      },
    },
  },
  plugins: [],
};
