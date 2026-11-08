import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import deployment from './deployment.json' with { type: 'json' };

const base = process.env.PUBLIC_URL;
if (base !== deployment.url || !process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) throw new Error('Run with the EON NOVA Railway Directus variables.');
let token;
async function api(path, method = 'GET', body) {
  const response = await fetch(new URL(path, base), {
    method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body), signal: AbortSignal.timeout(60000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${JSON.stringify(result.errors)}`);
  return result.data;
}
token = (await api('/auth/login', 'POST', { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD, mode: 'json' })).access_token;
const stable = value => { const h = createHash('sha256').update(`eon:${value}`).digest('hex'); return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`; };
const folder = stable('website-media');
if (!(await api('/folders?limit=-1')).some(row => row.id === folder)) await api('/folders', 'POST', { id: folder, name: 'EON NOVA · Médias du site' });
const field = (name, type = 'string', meta = {}, schema = {}) => ({ field: name, type, schema: { is_nullable: true, ...schema }, meta: { interface: type === 'text' ? 'input-multiline' : 'input', width: 'full', ...meta } });
const status = field('status', 'string', { interface: 'select-dropdown', width: 'half', options: { choices: [{ text: 'Publié', value: 'published', color: '#9AEE68' }, { text: 'Brouillon', value: 'draft' }, { text: 'Archivé', value: 'archived' }] } }, { default_value: 'draft' });
const translations = label => [{ language: 'fr-FR', translation: label }, { language: 'en-US', translation: label }, { language: 'es-ES', translation: label }];
const sections = { hero: '01 · Accueil', motion: '02 · Motion Lab', studio: '03 · Le studio', services: '04 · Services & contact', footer: '05 · Pied de page', interface: '06 · Navigation & interface' };
const langFields = ['es', 'en', 'fr'].map(lang => field(lang, 'text', { required: true, translations: translations({ es: 'Español', en: 'English', fr: 'Français' }[lang]), note: 'Texte du site. Mise en forme autorisée : `<br>`, `<em>`, `<strong>`, `<span>`. Conserver les trois langues.' }));
const definitions = {
  site_texts: { label: 'Textes & traductions', icon: 'translate', display: '{{label}}', fields: [
    field('section', 'string', { interface: 'select-dropdown', readonly: true, width: 'half', options: { choices: Object.entries(sections).map(([value, text]) => ({ value, text })) }, translations: translations('Rubrique') }),
    field('label', 'string', { readonly: true, translations: translations('Texte à modifier') }, { max_length: 300 }),
    field('source', 'text', { hidden: true, readonly: true }), ...langFields,
  ] },
  section_media: { label: 'Images du site', icon: 'photo_library', display: '{{placement}}', fields: [
    field('placement', 'string', { required: true, interface: 'select-dropdown', translations: translations('Emplacement'), options: { choices: [{text:'Accueil · grand visuel',value:'hero'},{text:'Le studio',value:'studio'},{text:'Service · design graphique',value:'graphic'},{text:'Service · design digital',value:'digital'}] }, note: 'Une seule image publiée par emplacement. Sans image, le visuel animé original est conservé.' }, { is_unique: true }),
    field('image', 'uuid', { interface: 'file-image', special: ['file'], required: true, options: { folder }, note: 'JPG, PNG, WebP, AVIF ou GIF, 25 Mo maximum.' }),
    ...['es','en','fr'].map(lang => field(`alt_${lang}`, 'string', { required: true, translations: translations(`Description accessible · ${lang.toUpperCase()}`) }, { max_length: 2000 })),
  ] },
};
const collections = await api('/collections');
for (const [name, definition] of Object.entries(definitions)) {
  if (!collections.some(row => row.collection === name)) {
    await api('/collections', 'POST', { collection: name, schema: {}, meta: { icon: definition.icon, color: '#9AEE68', translations: translations(definition.label), display_template: definition.display, sort_field: 'sort', archive_field: 'status', archive_value: 'archived', unarchive_value: 'draft', versioning: true }, fields: [field('id', 'uuid', { hidden: true, special: ['uuid'] }, { is_primary_key: true, is_nullable: false }), status, field('sort', 'integer', { hidden: true }, { default_value: 0 }), ...definition.fields] });
    if (name === 'section_media') await api('/relations', 'POST', { collection: name, field: 'image', related_collection: 'directus_files', schema: { on_delete: 'SET NULL' } });
    console.log('Created', name);
  } else {
    for (const definitionField of definition.fields) await api(`/fields/${name}/${definitionField.field}`, 'PATCH', {meta:definitionField.meta});
  }
}
const dictionary = JSON.parse(await readFile(new URL('../src/i18n/translations.json', import.meta.url), 'utf8'));
const sources = {};
for (const [section, file] of Object.entries({ hero:'HeroMotion', studio:'Studio', services:'Services', footer:'Footer', motion:'MotionLab', interface:'Header' })) sources[section] = await readFile(new URL(`../src/components/${file}.astro`, import.meta.url), 'utf8');
sources.motion += await readFile(new URL('../src/scripts/studio.js', import.meta.url), 'utf8');
const existing = new Set((await api('/items/site_texts?fields=id&limit=-1')).map(row => row.id));
let added = 0;
const rows = Object.entries(dictionary).map(([source, values], sort) => ({ id: stable(source), source, es: source, en: values.en, fr: values.fr, sort, status: 'published', label: source.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 280), section: Object.keys(sources).find(key => sources[key].includes(source)) ?? 'interface' }));
for (let offset = 0; offset < rows.length; offset += 50) {
  const missing = rows.slice(offset, offset + 50).filter(row => !existing.has(row.id));
  if (missing.length) { await api('/items/site_texts', 'POST', missing); added += missing.length; }
}
async function brand(name) {
  const id = stable(name);
  if (!(await api(`/files?filter[id][_eq]=${id}&fields=id`)).length) {
    const form = new FormData(); form.set('id', id); form.set('title', `EON NOVA · ${name}`);
    form.set('file', new Blob([await readFile(new URL(`brand/${name}.svg`, import.meta.url))], { type: 'image/svg+xml' }), `${name}.svg`);
    await api('/files', 'POST', form);
  }
  return id;
}
await api('/settings', 'PATCH', {
  project_name: 'EON NOVA · Studio', project_url: deployment.website, project_color: '#9AEE68', default_language: 'fr-FR',
  default_appearance: 'dark',
  project_logo: await brand('mark'), public_background: await brand('background'), public_foreground: await brand('wordmark'),
  public_note: 'DESIGN · ANIMATION · IMAGINATION\n\nVotre espace pour donner vie au prochain frame.',
  custom_css: ':root { --theme--primary: #9aee68; --theme--primary-foreground: #101010; } .public-view .content { backdrop-filter: blur(16px); }',
});
const policies = await api('/policies?limit=-1');
let reader = policies.find(row => row.name === 'Website build');
if (!reader) reader = await api('/policies', 'POST', { name:'Website build', icon:'public', app_access:false, admin_access:false });
const permissions = await api('/permissions?limit=-1');
for (const collection of ['site_texts', 'section_media', 'directus_files']) {
  if (!permissions.some(row => row.policy === reader.id && row.collection === collection && row.action === 'read')) await api('/permissions', 'POST', { policy:reader.id, collection, action:'read', permissions:{}, fields:['*'] });
}
const roles = await api('/roles?limit=-1');
let role = roles.find(row => row.name === 'Website build');
if (!role) role = await api('/roles', 'POST', { name:'Website build', icon:'public', policies:[{policy:reader.id}] });
if (!(await api('/users?filter[first_name][_eq]=Website%20build&limit=-1')).length) {
  if (!process.env.WEBSITE_READ_TOKEN) throw new Error('Missing WEBSITE_READ_TOKEN.');
  await api('/users', 'POST', { first_name:'Website build', status:'active', role:role.id, token:process.env.WEBSITE_READ_TOKEN });
}
const dashboardId = stable('dashboard');
await api('/users/me', 'PATCH', {appearance:'dark',language:'fr-FR'});
if (!(await api('/dashboards?limit=-1')).some(row => row.id === dashboardId)) {
  await api('/dashboards', 'POST', {id:dashboardId,name:'EON NOVA · Votre studio',icon:'auto_awesome',color:'#9AEE68'});
}
{
  const existingPanels = await api(`/panels?filter[dashboard][_eq]=${dashboardId}&limit=-1`);
  const panels = [
    {name:'Le prochain frame commence ici.',x:1,y:1,width:36,height:13,text:'EON NOVA / CONTENT STUDIO\n\nImaginer. Créer. Publier.\n\nVos textes. Vos images. Trois langues.',hero:true},
    {name:'01 / Les mots',x:1,y:15,width:17,height:17,text:'Contenu → Textes & traductions\n\nFiltrez par rubrique, puis modifiez les champs Español, English et Français.\n\nEnregistrez en Publié. Les brouillons restent hors du site.\n\nLes textes du Motion Lab sont également modifiables ici.'},
    {name:'02 / Les images',x:20,y:15,width:17,height:17,text:'Contenu → Images du site\n\nAjoutez un visuel, choisissez son emplacement et renseignez les descriptions dans les trois langues.\n\nUne image par emplacement. Archivez-la pour retrouver le visuel animé original.'},
    {name:'03 / Donner vie',x:1,y:33,width:36,height:11,text: process.env.CMS_PUBLISH_READY === 'true' ? 'Depuis une liste ou une fiche, utilisez le bouton ⚡ Publier le site et confirmez.\n\nAttendez le build réussi avant de recharger eonovastudios.com. Une erreur de contenu conserve la dernière version en ligne.' : 'La publication automatique attend le jeton Vercel permanent.\n\nRenseigner VERCEL_DEPLOY_TOKEN dans les variables Production du projet eon2, puis redéployer le site.\n\nVous pouvez déjà préparer et enregistrer vos contenus ici.'},
  ];
  for (const panel of panels) {
    const {text,x,y,hero,...layout}=panel;
    const record = { ...layout, position_x:x, position_y:y, dashboard:dashboardId, type:'label', show_header:true, color:'#9AEE68', options:{text,whiteSpace:'pre-wrap',textAlign:'start',fontSize:hero ? '24px' : '16px',fontWeight:hero ? 600 : 400,color:hero ? '#9AEE68' : undefined} };
    const existingPanel = existingPanels.find(row => row.name === panel.name);
    await api(existingPanel ? `/panels/${existingPanel.id}` : '/panels', existingPanel ? 'PATCH' : 'POST', record);
  }
}
for (const [collection, fields] of [['site_texts',['label','section','status']],['section_media',['placement','image','status']]]) {
  if (!(await api(`/presets?filter[collection][_eq]=${collection}&limit=-1`)).some(row => !row.user && !row.role)) await api('/presets','POST',{collection,layout:'tabular',layout_query:{tabular:{fields,sort:['sort'],limit:50}}});
}
if (process.env.VERCEL_PUBLISH_SECRET) {
  const flows = await api('/flows?limit=-1');
  if (!flows.some(row => row.name === 'Publier le site')) {
    const flow = await api('/flows','POST',{name:'Publier le site',icon:'publish',status:'active',trigger:'manual',accountability:'all',options:{collections:Object.keys(definitions),location:'both',requireSelection:false,requireConfirmation:true,confirmationDescription:'Publier les textes et images marqués Publié sur eonovastudios.com. La version précédente reste en ligne pendant la génération.',async:true}});
    const operation = await api('/operations','POST',{flow:flow.id,key:'publish_website',name:'Publier EON NOVA',type:'request',position_x:20,position_y:1,options:{method:'POST',url:`${deployment.website}/api/cms-publish`,headers:[{header:'Authorization',value:`Bearer ${process.env.VERCEL_PUBLISH_SECRET}`}],body:'{}'}});
    await api(`/flows/${flow.id}`,'PATCH',{operation:operation.id});
  }
}
console.log(`EON NOVA configured: ${added} texts added; existing edits preserved. No secrets printed.`);
