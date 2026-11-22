import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import {SITE_URL, PUBLIC_PATHS, alternateLinks} from './src/lib/seo.mjs';
export default defineConfig({
  site: SITE_URL,
  output: 'static',
  integrations: [sitemap({
    filter: page => PUBLIC_PATHS.includes(new URL(page).pathname),
    serialize: item => ({...item,links:alternateLinks(new URL(item.url).pathname)}),
  })],
});
