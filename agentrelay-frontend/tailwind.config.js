/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#080C14',
        surface: {
          DEFAULT: '#0F1626',
          card: '#121B2D',
          hover: '#182338',
          subtle: '#0B101C',
        },
        border: {
          DEFAULT: '#1C273C',
          subtle: '#141D2D',
          accent: '#2B3D5D',
        },
        primary: {
          DEFAULT: '#3B82F6',
          hover: '#2563EB',
          muted: 'rgba(59, 130, 246, 0.12)',
        },
        verified: {
          DEFAULT: '#10B981',
          hover: '#059669',
          muted: 'rgba(16, 185, 129, 0.12)',
        },
        pending: {
          DEFAULT: '#F59E0B',
          muted: 'rgba(245, 158, 11, 0.12)',
        },
        disputed: {
          DEFAULT: '#EF4444',
          muted: 'rgba(239, 68, 68, 0.12)',
        },
        text: {
          primary: '#F0F4FA',
          secondary: '#8797AB',
          muted: '#52647C',
        },
        arbitrum: '#28A0F0',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
