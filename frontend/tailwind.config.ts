import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#0a0e1a',
        cyan: {
          DEFAULT: '#00d4ff',
          dim: '#0099bb',
        },
        alert: '#ff3b3b',
        panel: '#1a2035',
        'panel-light': '#232b45',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        cyan: '0 0 8px 1px rgba(0, 212, 255, 0.35)',
        'cyan-lg': '0 0 16px 2px rgba(0, 212, 255, 0.45)',
      },
    },
  },
  plugins: [],
}

export default config
