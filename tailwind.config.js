/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/frontend/public/**/*.{html,js}",
    "!./src/frontend/markdown-viewer/**"
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
