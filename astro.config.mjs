import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
export default defineConfig({ site: 'https://eonovastudios.com', output: 'static', integrations: [sitemap()] });
