import dictionary from './translations.json';
export type Language = 'es' | 'en' | 'fr';
export const languages: Language[] = ['es', 'en', 'fr'];
export const home = (lang: Language) => lang === 'es' ? '/' : `/${lang}/`;
export const privacy = (lang: Language) => `${home(lang)}${lang === 'es' ? 'aviso-de-privacidad' : lang === 'fr' ? 'confidentialite' : 'privacy-policy'}/`;
const entries = dictionary as Record<string, {en: string; fr: string}>;
const pattern = new RegExp(Object.keys(entries).sort((a,b)=>b.length-a.length).map(s=>s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
export function translate(text: string, lang: Language): string {
 return lang === 'es' ? text : text.replace(pattern, match => entries[match][lang]);
}
