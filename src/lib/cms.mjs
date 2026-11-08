import { createHash } from 'node:crypto';
import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseFragment, serialize } from 'parse5';
import sanitizeHtml from 'sanitize-html';

export const cleanCopy = value => sanitizeHtml(String(value), {
  allowedTags: ['br', 'em', 'strong', 'span'], allowedAttributes: {},
});
export const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const canonical = html => serialize(parseFragment(html));

// Match complete text/inline fragments, never attributes, JavaScript or CSS.
export function applyCopy(html, rows, lang, dictionary) {
  const replacements = new Map(rows.map(row => [
    canonical(lang === 'es' ? row.source : (dictionary[row.source]?.[lang] ?? row.source)),
    cleanCopy(row[lang]),
  ]));
  const tree = parseFragment(html);
  function visit(node) {
    if (['script', 'style', 'textarea', 'code'].includes(node.tagName)) return;
    if (node.childNodes?.length) {
      const match = replacements.get(serialize(node));
      if (match !== undefined) {
        node.childNodes = parseFragment(match).childNodes;
        for (const child of node.childNodes) child.parentNode = node;
        return;
      }
      for (const child of node.childNodes) visit(child);
    } else if (node.nodeName === '#text') {
      const trimmed = node.value.trim();
      const match = replacements.get(canonical(escapeHtml(trimmed)));
      if (match !== undefined && trimmed) {
        const parent = node.parentNode;
        const index = parent.childNodes.indexOf(node);
        const children = parseFragment(node.value.slice(0, node.value.indexOf(trimmed)) + match + node.value.slice(node.value.indexOf(trimmed) + trimmed.length)).childNodes;
        for (const child of children) child.parentNode = parent;
        parent.childNodes.splice(index, 1, ...children);
      }
    }
  }
  visit(tree);
  return serialize(tree);
}

export function validateRows(rows) {
  const ids = new Set();
  for (const row of rows) {
    if (!row.source || ids.has(row.source) || !['es', 'en', 'fr'].every(lang => typeof row[lang] === 'string' && row[lang].trim() && row[lang].length <= 12000)) {
      throw new Error('Invalid or duplicate CMS copy. Check the three language fields.');
    }
    ids.add(row.source);
  }
  return rows;
}

export async function loadCms({ url, token, fetcher = fetch, output = pathToFileURL(resolve('public/_cms') + '/') } = {}) {
  if (!url) return { rows: [], media: {} };
  if (!token) throw new Error('DIRECTUS_READ_TOKEN is required when DIRECTUS_URL is set.');
  const base = new URL(url);
  if (base.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(base.hostname)) throw new Error('The CMS requires HTTPS.');
  async function api(path) {
    const response = await fetcher(new URL(path, base), { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`CMS request failed (${response.status}). Previous deployment is preserved.`);
    return response.json();
  }
  const [copy, images] = await Promise.all([
    api('/items/site_texts?filter[status][_eq]=published&fields=source,es,en,fr&limit=-1&sort=sort'),
    api('/items/section_media?filter[status][_eq]=published&fields=placement,image.id,image.type,image.modified_on,image.uploaded_on,alt_es,alt_en,alt_fr&limit=-1'),
  ]);
  if (!Array.isArray(copy.data) || !copy.data.length || !Array.isArray(images.data)) throw new Error('CMS content is missing.');
  const rows = validateRows(copy.data);
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  const media = {};
  for (const row of images.data) {
    if (!['hero', 'studio', 'graphic', 'digital'].includes(row.placement) || media[row.placement]) throw new Error('Invalid or duplicate media placement.');
    if (!row.image?.id || !['es', 'en', 'fr'].every(lang => row[`alt_${lang}`]?.trim())) throw new Error('Published media requires an image and three alternative texts.');
    const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif', 'image/gif': 'gif' }[row.image.type];
    if (!extension) throw new Error('Use JPG, PNG, WebP, AVIF or GIF for website images.');
    const response = await fetcher(new URL(`/assets/${encodeURIComponent(row.image.id)}`, base), { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`CMS image unavailable (${response.status}).`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 25 * 1024 * 1024 || !bytes.length) throw new Error('Website images must be between 1 byte and 25 MB.');
    const name = `${createHash('sha256').update(bytes).digest('hex').slice(0, 24)}.${extension}`;
    await writeFile(new URL(name, output), bytes);
    media[row.placement] = { src: `/_cms/${name}`, alt: { es: row.alt_es, en: row.alt_en, fr: row.alt_fr } };
  }
  return { rows, media };
}

let content;
export function getCms() {
  return content ??= readFile(resolve('.cms/content.json'), 'utf8').then(text => {
    const snapshot = JSON.parse(text);
    if (snapshot.url !== (process.env.DIRECTUS_URL || null)) throw new Error('CMS configuration changed. Run npm run build or npm run dev.');
    return snapshot.content;
  });
}
