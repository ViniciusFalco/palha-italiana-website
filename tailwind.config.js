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
        admin: {
          shell: '#12060C',
          shellSoft: '#231019',
          sidebar: '#18070F',
          sidebarSoft: '#2B0F1C',
          content: '#FBF4F6',
          contentSoft: '#FFF9FB',
          card: '#FFFDFD',
          cardAlt: '#FFF3F7',
          ink: '#24161D',
          muted: '#7D6672',
          stroke: '#E8D5DC',
          strokeStrong: '#F0A5C5',
          success: '#4B8F6A',
          successSoft: '#E8F4EC',
          danger: '#B34763',
          dangerSoft: '#FCECF1',
          warning: '#A2711B',
          warningSoft: '#FFF1D6',
        },
      },
      fontFamily: {
        'sans': ['DM Sans', 'sans-serif'],
        'bebas': ['Bebas Neue', 'sans-serif'],
        'serif': ['DM Serif Text', 'serif'],
        'gummy': ['Sour Gummy', 'sans-serif'],
      },
      borderRadius: {
        admin: '30px',
        'admin-sm': '24px',
        'admin-xs': '18px',
      },
      boxShadow: {
        'admin-shell': '0 40px 90px rgba(18, 6, 12, 0.34)',
        'admin-card': '0 26px 60px rgba(36, 22, 29, 0.12)',
        'admin-soft': '0 18px 36px rgba(36, 22, 29, 0.08)',
      },
    },
  },
  plugins: [],
} 
