/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./public/**/*.{html,ts,tsx,js}",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
} 