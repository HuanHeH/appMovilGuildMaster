/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,tsx}', './components/**/*.{js,ts,tsx}'],

  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        gm: {
          black: '#000000',
          primary: '#ef4444',
          surface: '#111111',
          outline: '#333333',
        },
      },
    },
  },
  plugins: [],
};
