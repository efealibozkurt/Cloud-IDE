/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Koyu tema temel paleti (Arduino IDE benzeri)
        panel: {
          DEFAULT: '#1e1e1e',
          light: '#252526',
          border: '#3c3c3c'
        },
        accent: {
          DEFAULT: '#0e7fc4',
          hover: '#1a8fd6'
        }
      }
    }
  },
  plugins: []
}
