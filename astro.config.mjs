import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import {SITE_URL, publicPaths, alternateLinks} from './src/lib/seo.mjs';
const buildPaths=publicPaths();
export default defineConfig({
  site: SITE_URL,
  output: 'static',
  integrations: [sitemap({
    filter: page => buildPaths.includes(new URL(page).pathname),
    serialize: item => ({...item,links:alternateLinks(new URL(item.url).pathname)}),
  })],
});
