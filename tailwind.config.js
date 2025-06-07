/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#E6F8FA',
          100: '#CCF1F5',
          200: '#99E3EB',
          300: '#66D5E0',
          400: '#33C7D6',
          500: '#00B9CC', // primary turquoise
          600: '#00949F',
          700: '#006F77',
          800: '#004A50',
          900: '#002528',
        },
        secondary: {
          50: '#E6F8FF',
          100: '#CCF1FF',
          200: '#99E3FF',
          300: '#66D5FF',
          400: '#33C7FF',
          500: '#00B9FF', // secondary light blue
          600: '#0094CC',
          700: '#006F99',
          800: '#004A66',
          900: '#002533',
        },
        dark: {
          50: '#E6E6E6',
          100: '#CCCCCC',
          200: '#999999',
          300: '#666666',
          400: '#333333',
          500: '#000000', // black
          600: '#000000',
          700: '#000000',
          800: '#000000',
          900: '#000000',
        },
        gold: {
          50: '#FFF9E6',
          100: '#FFF3CC',
          200: '#FFE799',
          300: '#FFDB66',
          400: '#FFCF33',
          500: '#FFC300', // primary gold
          600: '#CC9C00',
          700: '#997500',
          800: '#664E00',
          900: '#332700',
        },
        orange: {
          50: '#FFF0E6',
          100: '#FFE1CC',
          200: '#FFC399',
          300: '#FFA566',
          400: '#FF8733',
          500: '#FF6900', // secondary orange
          600: '#CC5400',
          700: '#993F00',
          800: '#662A00',
          900: '#331500',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        'glow': '0 0 15px rgba(0, 185, 204, 0.5)',
        'glow-lg': '0 0 30px rgba(0, 185, 204, 0.5)',
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};