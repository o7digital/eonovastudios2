export const SITE_URL = 'https://www.eonovastudios.com';
import {journalBuildPaths} from './journal.mjs';
import {journalAlternates} from '../../cms/studio/public/journal-data.js';
export const LANGUAGES = ['es', 'en', 'fr'];
export const HOME_PATHS = {es:'/', en:'/en/', fr:'/fr/'};
export const PRIVACY_PATHS = {es:'/aviso-de-privacidad/', en:'/en/privacy-policy/', fr:'/fr/confidentialite/'};
export const PUBLIC_PATHS = [...Object.values(HOME_PATHS), ...Object.values(PRIVACY_PATHS)];
export const publicPaths=()=>[...PUBLIC_PATHS,...journalBuildPaths()];

// A production opt-in never makes a local build or a Vercel preview indexable.
export const isIndexable = (env = process.env) => env.VERCEL_ENV === 'production' && env.SITE_INDEXABLE === 'true';
export function robotsText(env = process.env) {
  return isIndexable(env)
    ? `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${SITE_URL}/sitemap-index.xml\n`
    : 'User-agent: *\nDisallow: /\n';
}
export function alternateLinks(path) {
  const group = journalAlternates(path)?.paths || (Object.values(PRIVACY_PATHS).includes(path) ? PRIVACY_PATHS : HOME_PATHS);
  return [...LANGUAGES.map(lang => ({lang,url:SITE_URL+group[lang]})),{lang:'x-default',url:SITE_URL+group.es}];
}
const titles = {
  es:'EON NOVA STUDIOS · Diseño digital y animación',
  en:'EON NOVA STUDIOS · Digital design & animation',
  fr:'EON NOVA STUDIOS · Design digital & animation',
};
const descriptions = {
  es:'Estudio de diseño gráfico, digital y animación 2D y 3D. Identidad de marca, diseño web y narrativa visual.',
  en:'Graphic design, digital design and 2D and 3D animation studio. Brand identity, web design and visual storytelling.',
  fr:'Studio de design graphique, digital et d’animation 2D et 3D. Identité de marque, design web et narration visuelle.',
};
const privacyDescriptions = {
  es:'Información sobre el uso de tus datos, el alojamiento del sitio y las conversaciones con Olivia IA en EON NOVA STUDIOS.',
  en:'How EON NOVA STUDIOS uses your information, hosts its website and processes conversations with Olivia AI.',
  fr:'Utilisation de vos données, hébergement du site et traitement des conversations avec Olivia IA chez EON NOVA STUDIOS.',
};
export function pageSeo({lang='es',legal=false,pageTitle,logo,path:customPath,description:customDescription} = {}) {
  if (!LANGUAGES.includes(lang)) throw new Error('Unsupported SEO language.');
  const path=customPath||(legal?PRIVACY_PATHS:HOME_PATHS)[lang],url=SITE_URL+path;
  const title=pageTitle?`${pageTitle} · EON NOVA STUDIOS`:titles[lang];
  const description=customDescription||(legal?privacyDescriptions:descriptions)[lang];
  const language={es:'es-MX',en:'en',fr:'fr'}[lang];
  const organization={'@type':'Organization','@id':SITE_URL+'/#organization',name:'EON NOVA STUDIOS',url:SITE_URL+'/',email:'info@eonovastudios.com',...(logo?{logo:new URL(logo,SITE_URL).href}:{})};
  return {url,title,description,alternates:alternateLinks(path),locale:{es:'es_MX',en:'en_US',fr:'fr_FR'}[lang],image:SITE_URL+'/og-image.png',imageAlt:'EON NOVA STUDIOS · Diseño digital & animación',schema:{
    '@context':'https://schema.org',
    '@graph':[
      organization,
      {'@type':'WebSite','@id':SITE_URL+'/#website',url:SITE_URL+'/',name:'EON NOVA STUDIOS',inLanguage:['es-MX','en','fr'],publisher:{'@id':organization['@id']}},
      {'@type':'WebPage','@id':url+'#webpage',url,name:title,description,inLanguage:language,isPartOf:{'@id':SITE_URL+'/#website'},about:{'@id':organization['@id']}},
    ],
  }};
}

// Keep inline JSON safe even if a future title contains an HTML closing tag.
export const schemaJson = value => JSON.stringify(value).replace(/</g,String.fromCharCode(92)+'u003c');
