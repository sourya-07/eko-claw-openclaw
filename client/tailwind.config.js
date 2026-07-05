/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        darkNavy: {
          light: '#1e293b',
          DEFAULT: '#0F1624',
          dark: '#0b0f19',
        },
        electricBlue: {
          DEFAULT: '#3B82F6',
          hover: '#2563EB',
          glow: 'rgba(59, 130, 246, 0.15)',
        },
        severity: {
          LOW: '#22C55E',
          MEDIUM: '#EAB308',
          HIGH: '#F97316',
          CRITICAL: '#EF4444',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
