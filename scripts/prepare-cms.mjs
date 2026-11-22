import { mkdir, rm, writeFile } from 'node:fs/promises';
import { loadCms } from '../src/lib/cms.mjs';
import {loadJournal} from '../src/lib/journal.mjs';
import {loadSocialLinks} from '../src/lib/social-links.mjs';

// Download before Astro copies public/. A failed preparation never starts a build.
const url = process.env.DIRECTUS_URL || null;
await rm('.cms/content.json', { force: true });
if (!url) await rm('public/_cms', { recursive: true, force: true });
const content = await loadCms({ url, token: process.env.DIRECTUS_READ_TOKEN });
await mkdir('.cms', { recursive: true });
await writeFile('.cms/content.json', JSON.stringify({ url, content }));
const journal=await loadJournal({url,token:process.env.DIRECTUS_READ_TOKEN});
await writeFile('.cms/journal.json',JSON.stringify({url,content:journal}));
const socialLinks=await loadSocialLinks({url,token:process.env.DIRECTUS_READ_TOKEN});
await writeFile('.cms/social-links.json',JSON.stringify({url,content:socialLinks}));
console.log(url ? `CMS ready: ${content.rows.length} texts, ${Object.keys(content.media).length} images.` : 'Using local website content.');
