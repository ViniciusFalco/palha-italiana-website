/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#000000',
        primary: '#FF007F',
      },
      fontFamily: {
        'bebas': ['Bebas Neue', 'sans-serif'],
        'serif': ['DM Serif Text', 'serif'],
        'gummy': ['Sour Gummy', 'sans-serif'],
      },
    },
  },
  plugins: [],
} 