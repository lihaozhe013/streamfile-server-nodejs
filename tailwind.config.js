/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./public/**/*.{html,js}",
    "!./src/frontend/markdown-viewer/**"
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
