import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './hooks/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-main':   '#0c0d0e',
        'bg-card':   '#161617',
        'bg-input':  '#1c1d1e',
        'txt-muted': '#7e7f82',
        'accent':    '#e1f970',
        'border-thin': '#242526',
      },
      fontFamily: {
        sans: ['Inter', 'SF Pro Display', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
