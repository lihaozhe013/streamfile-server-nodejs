/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./public/**/*.{html,js}",
    "!./src/frontend/markdown-viewer/**"
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
