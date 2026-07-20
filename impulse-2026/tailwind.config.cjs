module.exports = {
  content: ['./index.html'],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#040e11',
          surface: '#0a2d48',
          darkgray: '#040e11',
          navy: '#0a2d48',
          blue: '#00509c',
          blueMid: '#0067b7',
          cyan: '#00c1fd',
          goldLight: '#00c1fd',
          goldDeep: '#0067b7',
          brownDark: '#0a2d48',
          brownMid: '#00509c',
          light: '#E7F6FD',
          primary: '#00c1fd',
          primaryHover: '#0067b7',
          accent: '#0067b7',
          textPrimary: '#FDFEFE',
          textSecondary: '#8eb4c9',
          textMuted: '#6a8fa6',
          border: 'rgba(0, 193, 253, 0.12)'
        }
      },
      fontFamily: {
        sans: ['Nova Pro', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Liferdas', 'Georgia', 'serif']
      },
      animation: {
        shimmer: 'shimmer 1.6s infinite',
        pulse: 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow-pulse': 'glow-pulse 4s ease-in-out infinite'
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(340%)' }
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '0.9' }
        }
      },
      maxWidth: { content: '1200px' }
    }
  },
  plugins: []
};
