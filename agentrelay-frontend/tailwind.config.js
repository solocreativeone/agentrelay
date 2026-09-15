/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0B0F17',
        surface: '#141B26',
        border: '#1F2937',
        primary: {
          DEFAULT: '#4C7CF0',
          hover: '#3E68D6',
        },
        verified: '#2FBF87',
        pending: '#F5A623',
        disputed: '#EF5B5B',
        text: {
          primary: '#E7ECF3',
          secondary: '#8B96A5',
        },
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
