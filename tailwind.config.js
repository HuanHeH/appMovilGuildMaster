/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,tsx}', './components/**/*.{js,ts,tsx}', './lib/**/*.{js,ts,tsx}'],

  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        gm: {
          black: '#000000',
          background: '#131313',
          surface: '#111111',
          'surface-container': '#0a0a0a',
          outline: '#333333',
          primary: '#ef4444',
          'primary-container': '#ff5451',
          tertiary: '#c6c6c6',
          error: '#b91c1c',
        },
      },
    },
  },
  plugins: [],
};
