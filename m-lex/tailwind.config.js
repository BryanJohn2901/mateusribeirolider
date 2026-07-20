/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/js/**/*.js'],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#050506',
          surface: '#19191B',
          goldLight: '#E2BE7C',
          goldDeep: '#A38846',
          brownDark: '#704323',
          brownMid: '#946240',
          light: '#E7E6F6',
          primary: '#E2BE7C',
          primaryHover: '#A38846',
          accent: '#A38846',
          textPrimary: '#FDFEFE',
          textSecondary: '#A1A0A4',
          textMuted: '#A1A0A4',
          border: 'rgba(255, 255, 255, 0.1)',
        },
      },
      fontFamily: {
        sans: ['Nova Pro', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Avantique', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        shimmer: 'shimmer 1.6s infinite',
        marquee: 'marquee 55s linear infinite',
        'marquee-reverse': 'marquee-reverse 55s linear infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(340%)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'marquee-reverse': {
          '0%': { transform: 'translateX(-50%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
      maxWidth: {
        content: '1300px',
      },
    },
  },
  plugins: [],
};
