import http from 'node:http';
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {createWorkspace,WorkspaceError} from './workspace.mjs';
import {createSocialMedia,SocialMediaError} from './social-media.mjs';

const uuid = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
const locales = ['es', 'en', 'fr'];
const placements = ['hero', 'studio', 'graphic', 'digital'];
const statuses = ['draft', 'published', 'archived'];
const textFields = 'id,label,section,source,es,en,fr,status,sort';
const mediaFields = 'id,placement,image.id,image.type,image.filename_download,alt_es,alt_en,alt_fr,status,sort';
class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }

export function createStudioServer(options = {}) {
  const config = {
    cms: process.env.DIRECTUS_URL,
    origin: process.env.STUDIO_ORIGIN,
    secret: process.env.STUDIO_SESSION_SECRET,
    publishSecret: process.env.CMS_PUBLISH_SECRET,
    publishEnabled: process.env.STUDIO_PUBLISH_ENABLED === 'true',
    website: 'https://www.eonovastudios.com',
    secure: process.env.NODE_ENV === 'production',
    fetcher: fetch,
    crm: process.env.ARM_API_URL || 'https://api.crm.o7digitalgroup.com/api',
    tenant: process.env.ARM_TENANT_ID,
    serviceEmail: process.env.ARM_SERVICE_EMAIL,
    servicePassword: process.env.ARM_SERVICE_PASSWORD,
    ownerEmail: process.env.STUDIO_OWNER_EMAIL,
    mediaReadToken: process.env.STUDIO_MEDIA_READ_TOKEN,
    ...options,
  };
  if (!config.cms || !config.origin || !config.secret || config.secret.length < 32) throw new Error('Configure DIRECTUS_URL, STUDIO_ORIGIN and STUDIO_SESSION_SECRET (32+ characters).');
  const key = createHash('sha256').update(config.secret).digest();
  const attempts = new Map(), refreshes = new Map();
  let writes = Promise.resolve();
  const write = work => { const job = writes.then(work); writes = job.catch(() => {}); return job; };
  function seal(data) {
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(data)), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
  }
  function session(req) {
    try {
      const cookie = (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith('eon_studio='))?.slice(11);
      if (!cookie || cookie.length > 3800) return null;
      const bytes = Buffer.from(cookie, 'base64url'), decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
      decipher.setAuthTag(bytes.subarray(12, 28));
      const data = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString());
      return data.until > Date.now() ? data : null;
    } catch { return null; }
  }
  function setSession(res, data) {
    const cookie = data ? seal(data) : '';
    if (cookie.length > 3800) throw new ApiError(500, 'No se pudo guardar la sesión.');
    res.setHeader('Set-Cookie', `eon_studio=${cookie}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${data ? 8 * 3600 : 0}${config.secure ? '; Secure' : ''}`);
  }
  async function cms(path, token, method = 'GET', body) {
    const response = await config.fetcher(new URL(path, config.cms), {
      method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}) },
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
      signal: AbortSignal.timeout(60000), redirect: 'error',
    });
    if (!response.ok) throw new ApiError(response.status === 401 ? 401 : response.status === 403 ? 403 : response.status === 400 ? 400 : 502,
      response.status === 401 ? 'Tu sesión expiró. Inicia sesión de nuevo.' : response.status === 403 ? 'Tu cuenta no tiene permiso para realizar esta acción.' : response.status === 400 ? 'Revisa los campos del formulario. Es posible que esta ubicación ya esté en uso.' : 'El contenido no está disponible por el momento. Intenta de nuevo.');
    return response.status === 204 ? null : (await response.json()).data;
  }
  async function authenticated(req, res) {
    const s = session(req);
    if (!s) throw new ApiError(401, 'Inicia sesión para abrir el Studio.');
    if (s.accessUntil < Date.now() + 15000) {
      const id = createHash('sha256').update(s.refresh).digest('hex');
      for (const [key, value] of refreshes) if (value.until < Date.now()) refreshes.delete(key);
      if (!refreshes.has(id)) {
        if (refreshes.size > 1000) refreshes.clear();
        refreshes.set(id, { until: Date.now() + 30000, promise: cms('/auth/refresh', null, 'POST', { refresh_token: s.refresh, mode: 'json' }) });
      }
      const data = await refreshes.get(id).promise;
      s.access = data.access_token; s.refresh = data.refresh_token; s.accessUntil = Date.now() + data.expires;
      setSession(res, s);
    }
    return s;
  }
  const socialMedia=createSocialMedia({cms:config.cms,editorToken:config.mediaReadToken,secret:config.secret,origin:config.origin,fetcher:config.fetcher});
  const workspace=createWorkspace({cms,crm:config.crm,tenant:config.tenant,serviceEmail:config.serviceEmail,servicePassword:config.servicePassword,ownerEmail:config.ownerEmail,origin:config.origin,fetcher:config.fetcher,socialMedia});
  async function body(req, limit = 262144) {
    if (Number(req.headers['content-length']) > limit) throw new ApiError(413, 'El archivo es demasiado grande (máximo 25 MB).');
    let size = 0; const chunks = [];
    for await (const chunk of req) { size += chunk.length; if (size > limit) throw new ApiError(413, 'El contenido supera el tamaño permitido.'); chunks.push(chunk); }
    return Buffer.concat(chunks);
  }
  async function jsonBody(req) {
    if (!req.headers['content-type']?.startsWith('application/json')) throw new ApiError(415, 'Formato de formulario no reconocido.');
    try { const value = JSON.parse((await body(req)).toString()); if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error(); return value; }
    catch (error) { if (error instanceof ApiError) throw error; throw new ApiError(400, 'El formulario no es válido.'); }
  }
  const send = (res, data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
  function validate(input, allowed) {
    if (Object.keys(input).some(field => !allowed.includes(field))) throw new ApiError(400, 'Este campo no se puede editar.');
    for (const value of Object.values(input)) if (typeof value !== 'string' || value.length > 12000) throw new ApiError(400, 'Revisa la longitud del texto (máximo 12 000 caracteres).');
    if (input.status !== undefined && !statuses.includes(input.status)) throw new ApiError(400, 'Elige un estado válido.');
  }
  async function serve(req, res) {
    const url = new URL(req.url, 'http://studio.local'), path = url.pathname;
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'same-origin'); res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' blob: data: https:; media-src 'self' blob:; frame-src 'self'; style-src 'self'; font-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    if (path === '/health' && req.method === 'GET') return send(res, { ok: true });
    if(/^\/social-media\/[a-f\d-]{36}$/.test(path)&&['GET','HEAD'].includes(req.method)){
      if(!config.mediaReadToken)throw new ApiError(503,'El acceso a los archivos multimedia no está configurado.');
      return socialMedia.publicStream(req,res,url);
    }
    if (path.startsWith('/api/')) {
      if (!['GET', 'POST', 'PATCH'].includes(req.method)) throw new ApiError(405, 'Método no permitido.');
      if (req.method !== 'GET' && req.headers.origin !== config.origin) throw new ApiError(403, 'Esta solicitud no proviene de tu Studio.');
      if (path === '/api/login' && req.method === 'POST') {
        const input = await jsonBody(req);
        if (typeof input.email !== 'string' || !input.email.includes('@') || input.email.length > 200 || typeof input.password !== 'string' || !input.password || input.password.length > 250) throw new ApiError(400, 'Ingresa tu correo electrónico y tu contraseña.');
        const ip = req.socket.remoteAddress + ':' + String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
        for (const [key, value] of attempts) if (value.until < Date.now()) attempts.delete(key);
        if (attempts.size > 10000) throw new ApiError(429, 'Demasiadas conexiones. Intenta de nuevo en unos minutos.');
        const attempt = attempts.get(ip) || { count: 0, until: Date.now() + 600000 };
        if (++attempt.count > 10) throw new ApiError(429, 'Demasiados intentos. Intenta de nuevo en diez minutos.');
        attempts.set(ip, attempt);
        const data = await cms('/auth/login', null, 'POST', { email: input.email, password: input.password, mode: 'json' });
        const profile = await cms('/users/me?fields=id,email,first_name,last_name', data.access_token);
        setSession(res, { access: data.access_token, refresh: data.refresh_token, accessUntil: Date.now() + data.expires, until: Date.now() + 8 * 3600000, id: profile.id });
        return send(res, { ok: true });
      }
      if (path === '/api/logout' && req.method === 'POST') {
        const s = session(req); if (s?.refresh) await cms('/auth/logout', null, 'POST', { refresh_token: s.refresh }).catch(() => {});
        setSession(res, null); return send(res, { ok: true });
      }
      const s = await authenticated(req, res);
      if(await workspace.handle({path,url,req,res,s,jsonBody,send,body}))return;
      if (path === '/api/bootstrap' && req.method === 'GET') {
        const [profile, texts, media, rights] = await Promise.all([
          cms('/users/me?fields=id,email,first_name,last_name', s.access),
          cms(`/items/site_texts?fields=${textFields}&limit=-1&sort=sort`, s.access),
          cms(`/items/section_media?fields=${mediaFields}&limit=-1&sort=sort`, s.access),
          cms('/permissions/me', s.access),
        ]);
        const permission = rights?.site_texts?.update;
        return send(res, { profile: { email: profile.email, name: [profile.first_name, profile.last_name].filter(Boolean).join(' ') }, texts, media,
          website: config.website, workspaceReady:workspace.ready(), publishReady: config.publishEnabled && Boolean(config.publishSecret), canEdit: permission?.access === 'full' || permission?.access === 'partial' || permission?.access === true });
      }
      const textId = path.match(/^\/api\/texts\/([a-f\d-]{36})$/i)?.[1];
      if (path === '/api/texts' && req.method === 'PATCH') {
        const input = await jsonBody(req);
        if (Object.keys(input).some(key => key !== 'items') || !Array.isArray(input.items) || !input.items.length || input.items.length > 150) throw new ApiError(400, 'Elige los textos que quieres guardar.');
        const ids = new Set();
        for (const row of input.items) {
          if (!row || !uuid.test(row.id) || ids.has(row.id)) throw new ApiError(400, 'Uno de los textos del formulario no es válido.');
          ids.add(row.id); const {id, ...fields} = row; validate(fields, [...locales, 'status']);
          if (locales.some(lang => fields[lang] !== undefined && !fields[lang].trim())) throw new ApiError(400, 'Conserva un texto en cada idioma.');
        }
        return send(res, await write(() => cms(`/items/site_texts?fields=${textFields}`, s.access, 'PATCH', input.items)));
      }
      if (textId && uuid.test(textId) && req.method === 'PATCH') {
        const input = await jsonBody(req); validate(input, [...locales, 'status']);
        if (locales.some(lang => input[lang] !== undefined && !input[lang].trim())) throw new ApiError(400, 'Conserva un texto en cada idioma.');
        const updated = await write(() => cms(`/items/site_texts/${textId}?fields=${textFields}`, s.access, 'PATCH', input));
        return send(res, updated);
      }
      const mediaId = path.match(/^\/api\/media\/([a-f\d-]{36})$/i)?.[1];
      if ((path === '/api/media' && req.method === 'POST') || (mediaId && uuid.test(mediaId) && req.method === 'PATCH')) {
        const input = await jsonBody(req); validate(input, ['placement', 'image', 'status', 'alt_es', 'alt_en', 'alt_fr']);
        if ((input.placement !== undefined && !placements.includes(input.placement)) || (input.image !== undefined && !uuid.test(input.image))) throw new ApiError(400, 'Elige una ubicación y una imagen válidas.');
        const previous = mediaId ? await cms(`/items/section_media/${mediaId}?fields=${mediaFields}`, s.access) : {};
        const effective = { status: 'draft', ...previous, ...input };
        if (!effective.placement || !effective.image || locales.some(lang => !effective[`alt_${lang}`]?.trim() || effective[`alt_${lang}`].length > 2000)) throw new ApiError(400, 'Agrega una imagen y su descripción en los tres idiomas.');
        const fileId = typeof effective.image === 'string' ? effective.image : effective.image.id;
        const file = await cms(`/files/${fileId}?fields=id,type,filesize`, s.access);
        if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'].includes(file.type) || Number(file.filesize) > 25 * 1024 * 1024) throw new ApiError(400, 'Elige una imagen JPG, PNG, WebP, AVIF o GIF de máximo 25 MB.');
        return send(res, await write(() => cms(`/items/section_media${mediaId ? '/' + mediaId : ''}?fields=${mediaFields}`, s.access, mediaId ? 'PATCH' : 'POST', mediaId ? input : { id: randomUUID(), status: 'draft', ...input })), mediaId ? 200 : 201);
      }
      if (path === '/api/upload' && req.method === 'POST') {
        const type = req.headers['content-type'];
        if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'].includes(type)) throw new ApiError(415, 'Este formato de imagen no es compatible.');
        const bytes = await body(req, 25 * 1024 * 1024);
        if (!bytes.length) throw new ApiError(400, 'El archivo está vacío.');
        const name = decodeURIComponent(String(req.headers['x-file-name'] || 'image')).replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 160);
        const form = new FormData(); form.set('title', name);
        // Directus requires metadata before the file. Use its actual website folder.
        const folders = await cms('/folders?fields=id,name&limit=-1', s.access);
        const folder = folders.find(item => item.name === 'EON NOVA · Médias du site');
        if (folder) form.set('folder', folder.id); else form.delete('folder');
        form.set('file', new Blob([bytes], { type }), name);
        const file = await cms('/files', s.access, 'POST', form);
        return send(res, { id: file.id, name: file.filename_download, type: file.type }, 201);
      }
      const imageId = path.match(/^\/api\/image\/([a-f\d-]{36})$/i)?.[1];
      if (imageId && uuid.test(imageId) && req.method === 'GET') {
        const file = await cms(`/files/${imageId}?fields=type`, s.access);
        if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'].includes(file.type)) throw new ApiError(415, 'No se puede mostrar este archivo.');
        const response = await config.fetcher(new URL(`/assets/${imageId}`, config.cms), { headers: { Authorization: `Bearer ${s.access}` }, redirect: 'error', signal: AbortSignal.timeout(60000) });
        if (!response.ok) throw new ApiError(502, 'La imagen no está disponible.');
        res.writeHead(200, { 'Content-Type': file.type, 'Cache-Control': 'private, max-age=60', 'Content-Disposition': 'inline' });
        for await (const chunk of response.body) { if (res.destroyed) break; res.write(chunk); } res.end(); return;
      }
      if (path === '/api/publish' && req.method === 'POST') {
        if (!config.publishEnabled || !config.publishSecret) throw new ApiError(409, 'El botón está preparado. La publicación se conectará más adelante. Tu contenido está guardado.');
        const permissions = await cms('/permissions/me', s.access);
        if (!['full', 'partial', true].includes(permissions?.site_texts?.update?.access)) throw new ApiError(403, 'Tu cuenta no tiene permiso para publicar.');
        const response = await config.fetcher(new URL('/api/cms-publish', config.website), { method: 'POST', headers: { Authorization: `Bearer ${config.publishSecret}` }, signal: AbortSignal.timeout(60000), redirect: 'error' });
        if (!response.ok) throw new ApiError(response.status === 429 ? 429 : 502, response.status === 429 ? 'Ya se inició una publicación. Espera antes de intentar de nuevo.' : 'No se pudo iniciar la publicación. Tu contenido está guardado.');
        return send(res, { ok: true, message: 'Publicación solicitada. Espera a que termine la generación antes de revisar el sitio.' }, 202);
      }
      throw new ApiError(404, 'Esta acción no existe.');
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new ApiError(405, 'Método no permitido.');
    const files = { '/': ['index.html', 'text/html; charset=utf-8'], '/app.js': ['app.js', 'text/javascript; charset=utf-8'], '/workspace-ui.js':['workspace-ui.js','text/javascript; charset=utf-8'], '/social-callback.html':['social-callback.html','text/html; charset=utf-8'], '/social-callback.js':['social-callback.js','text/javascript; charset=utf-8'], '/style.css': ['style.css', 'text/css; charset=utf-8'], '/favicon.svg': ['favicon.svg', 'image/svg+xml'], '/dm-sans.woff2': ['dm-sans.woff2', 'font/woff2'], '/space-grotesk.woff2': ['space-grotesk.woff2', 'font/woff2'] };
    if(path==='/social-callback.html')res.setHeader('Referrer-Policy','no-referrer');
    if (!files[path]) throw new ApiError(404, 'Página no encontrada.');
    const [file, mime] = files[path];
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': path === '/' ? 'no-store' : 'public, max-age=3600' });
    res.end(req.method === 'HEAD' ? undefined : await readFile(new URL(`public/${file}`, import.meta.url)));
  }
  return http.createServer((req, res) => serve(req, res).catch(error => {
    if (res.headersSent) { res.end(); return; }
    const known=error instanceof ApiError||error instanceof WorkspaceError||error instanceof SocialMediaError;
    const status = known ? error.status : 500;
    if (status === 401) setSession(res, null);
    send(res, { error: known ? error.message : 'El Studio no pudo completar esta acción. Intenta de nuevo.' }, status);
  }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createStudioServer().listen(Number(process.env.PORT || 4381), '0.0.0.0', () => console.log(`EON NOVA Studio listening on ${process.env.PORT || 4381}`));
}
