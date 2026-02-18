import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#667eea',
          dark: '#5568d3',
          bg: 'rgba(102, 126, 234, 0.05)',
        },
      },
      boxShadow: {
        card: '0 10px 40px rgba(0, 0, 0, 0.2)',
        sm: '0 4px 12px rgba(0, 0, 0, 0.1)',
      },
      borderRadius: {
        card: '12px',
      },
    },
  },
} satisfies Config;
