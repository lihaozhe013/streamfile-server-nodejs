/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Microsoft YaHei"',
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Noto Sans CJK SC"',
          '"Apple SD Gothic Neo"',
          '"Malgun Gothic"',
          '"Noto Sans KR"',
          '"Hiragino Sans"',
          'Meiryo',
          '"Noto Sans JP"',
          '"Segoe UI"',
          'Roboto',
          'Arial',
          '"Helvetica Neue"',
          'Helvetica',
          'sans-serif',
        ],
        mono: [
          '"Fira Mono"',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
    },
  },
};
