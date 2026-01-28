/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",          // Vite kök HTML
    "./admin.html",          // admin sayfan varsa
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: { extend: {} },
  darkMode: "class",
  plugins: [require("@tailwindcss/typography")],
}
