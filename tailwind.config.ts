import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ['"Inter"', "system-ui", "sans-serif"] },
      colors: {
        brand: {
          ink: "var(--brand-ink)",
          slate: "var(--brand-slate)",
          line: "var(--brand-line)",
          cream: "var(--brand-cream)",
          red: "var(--brand-red)",
          redDeep: "var(--brand-red-deep)",
        },
      },
    },
  },
  plugins: [],
};
export default config;
