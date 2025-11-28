import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'rootstock-orange': '#FF9100',
        'rootstock-black': '#000000',
        'rootstock-off-white': '#FAF9F5',
        'rootstock-pink': '#FF71E1',
        'rootstock-green': '#79C600',
        'rootstock-purple': '#9E76FF',
        'rootstock-cyan': '#08FFD0',
        'rootstock-lime': '#DEFF1A',
      },
    },
  },
  plugins: [],
}
export default config
