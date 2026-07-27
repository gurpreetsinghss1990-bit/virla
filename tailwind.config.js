/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  content: [
    "./src/app/**/*.{js,jsx,ts,tsx}",
    "./src/presentation/components/**/*.{js,jsx,ts,tsx}",
    "./src/components/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#4F46E5",
        secondary: "#6D5EF7",
        dark: "#101828",
        success: "#16C784",
        gold: "#F5B942",
        warning: "#FF8A00",
        danger: "#FF4D4F",
        bgLuxury: "#F7F8FC",
        pureWhite: "#FFFFFF",
      },
    },
  },
  plugins: [],
}
