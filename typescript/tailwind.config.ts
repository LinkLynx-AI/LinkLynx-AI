import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        discord: {
          primary: '#5865F2',
          green: '#57F287',
          yellow: '#FEE75C',
          fuchsia: '#EB459E',
          red: '#ED4245',
          dark: '#23272A',
          darker: '#2C2F33',
          darkest: '#1E1E1E',
        },
      },
    },
  },
  plugins: [],
};

export default config;
