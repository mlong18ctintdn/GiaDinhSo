import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        fg: 'var(--fg)',
        card: 'var(--card)',
        muted: 'var(--muted)',
        accent: 'var(--accent)',
        'accent-fg': 'var(--accent-fg)',
        border: 'var(--border)',
        leaf: 'var(--leaf)',
        fruit: 'var(--fruit)',
        trunk: 'var(--trunk)',
      },
      borderRadius: { theme: 'var(--radius)' },
      fontFamily: { sans: ['var(--font-active)', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
export default config;
