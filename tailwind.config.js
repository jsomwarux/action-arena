/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './constants/**/*.{js,jsx,ts,tsx}',
    './hooks/**/*.{js,jsx,ts,tsx}',
    './lib/**/*.{js,jsx,ts,tsx}',
    './providers/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        'amber-accent': '#FFA502',
        'arena-bg': '#0A0E1A',
        'arena-surface': '#111827',
        bronze: '#CD7F32',
        'bronze-text': '#E8A268',
        silver: '#C0C0C0',
        'silver-text': '#E5E7EB',
        'coral-red': '#FF4757',
        'cyan-accent': '#18DCFF',
        'electric-green': '#00FF87',
        gold: '#FFD700',
      },
    },
  },
  plugins: [],
};
