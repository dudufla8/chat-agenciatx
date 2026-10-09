/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#0a111a',
          surface: '#101c2b',
          card: '#101c2b',
          bubbleRecv: '#142030',
          bubbleSent: '#173b64',
          border: 'rgba(255, 255, 255, 0.08)',
        },
        brand: {
          orange: '#ff5722',
          orangeHover: '#ff6b35',
          navy: '#0d1724',
          blueSent: '#173b64',
          textMuted: '#8a9ba8',
          online: '#22c55e',
        }
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
      }
    },
  },
  plugins: [],
};
