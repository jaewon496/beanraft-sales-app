/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Noto Sans KR', 'sans-serif'],
        // Stitch Card 5 디자인용 폰트 토큰
        manrope: ['Manrope', 'Inter', 'Noto Sans KR', 'sans-serif'],
        h1: ['Manrope', 'Inter', 'Noto Sans KR', 'sans-serif'],
        h2: ['Manrope', 'Inter', 'Noto Sans KR', 'sans-serif'],
        'data-tabular': ['Inter', 'Noto Sans KR', 'sans-serif'],
        'body-sm': ['Inter', 'Noto Sans KR', 'sans-serif'],
        'body-lg': ['Inter', 'Noto Sans KR', 'sans-serif'],
        'label-caps': ['Inter', 'Noto Sans KR', 'sans-serif'],
      },
      fontSize: {
        // Stitch Card 5 typography tokens
        'h1': ['32px', { lineHeight: '40px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'h2': ['24px', { lineHeight: '32px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'body-lg': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'body-sm': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'data-tabular': ['14px', { lineHeight: '20px', fontWeight: '500' }],
        'label-caps': ['12px', { lineHeight: '16px', letterSpacing: '0.05em', fontWeight: '600' }],
      },
      spacing: {
        'sm': '8px',
        'gutter': '16px',
        'container-margin': '24px',
        'lg': '24px',
        'xs': '4px',
        'md': '16px',
        'xl': '32px',
      },
      colors: {
        brand: {
          purple: '#8b5cf6',
          blue: '#3b82f6',
          gold: '#f59e0b',
        },
        // Stitch Midnight Foundry palette (Card02 결제 섹션용)
        'surface-container-lowest': '#0b0e15',
        'surface-container-low': '#191b23',
        'surface-container': '#1d2027',
        'surface-container-high': '#272a31',
        'surface-container-highest': '#32353c',
        'surface-dim': '#10131a',
        'surface-bright': '#363941',
        'surface': '#10131a',
        'surface-variant': '#32353c',
        'on-surface': '#e1e2ec',
        'on-surface-variant': '#c2c6d6',
        'on-background': '#e1e2ec',
        'background': '#0E1117',
        'outline': '#8c909f',
        'outline-variant': '#424754',
        // Stitch Card 5 핵심 색상
        'primary': '#3B82F6',
        'on-primary': '#002e6a',
        'secondary': '#4edea3',
        'on-secondary': '#003824',
        'secondary-container': '#00a572',
        'primary-container': '#4d8eff',
        'on-primary-container': '#00285d',
        'tertiary': '#ffb786',
        'error': '#ffb4ab',
        'card-bg': '#1A1F2C',
        'border-subtle': '#2D3748',
      },
      borderRadius: {
        'lg': '0.5rem',
        'xl': '0.75rem',
        '2xl': '1rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
