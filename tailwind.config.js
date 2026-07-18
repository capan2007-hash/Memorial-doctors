/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#F0FDFA', 100: '#CCFBF1', 600: '#0F766E', 700: '#115E59' },
        accent: { 100: '#FEF3C7', 600: '#D97706', 700: '#B45309' },
        surface: { DEFAULT: '#F8FAFC', card: '#FFFFFF' },
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: { card: '0 1px 3px rgba(15,23,42,.08), 0 4px 12px rgba(15,23,42,.05)' },
    },
  },
  plugins: [],
}
