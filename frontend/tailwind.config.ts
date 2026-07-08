import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:      '#f7f8fa',
        surface: '#ffffff',
        'surface-alt': '#f1f5f9',
        accent: {
          DEFAULT: '#0e7490',
          dim: '#155e75',
          tint: '#ecfeff',
        },
        alert: '#dc2626',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(15, 23, 42, 0.06), 0 1px 3px 0 rgba(15, 23, 42, 0.06)',
      },
    },
  },
  plugins: [],
}

export default config
