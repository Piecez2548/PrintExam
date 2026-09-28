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
        brand: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#bae0fd',
          300: '#7cc7fb',
          400: '#36a8f6',
          500: '#0c8de4',
          600: '#026fc3',
          700: '#03589e',
          800: '#074b82',
          900: '#0c3f6c',
          950: '#082847',
        },
        navy: {
          800: '#0f172a',
          900: '#090d16',
        }
      },
      fontFamily: {
        sans: ['Prompt', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
