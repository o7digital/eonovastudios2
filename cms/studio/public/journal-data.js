export const journalDefinitions=[
 {id:'blog',labels:{es:'Blog',en:'Blog',fr:'Blog'},paths:{es:'blog',en:'blog',fr:'blog'}},
 {id:'book',labels:{es:'Mi Book',en:'My Book',fr:'Mon Book'},paths:{es:'mi-book',en:'portfolio',fr:'portfolio'}},
 {id:'news',labels:{es:'Noticias',en:'News',fr:'Actualités'},paths:{es:'noticias',en:'news',fr:'actualites'}},
];
export const journalText=(value,lang='es')=>value?.[lang]?.trim()?value[lang]:value?.es||'';
export const journalPath=(section,lang='es',slug='')=>`${lang==='es'?'/':'/'+lang+'/'}${journalDefinitions.find(item=>item.id===section).paths[lang]}/${slug?slug+'/':''}`;
export function journalAlternates(path){
 for(const definition of journalDefinitions)for(const lang of ['es','en','fr']){
  const base=journalPath(definition.id,lang);
  if(path===base||path.startsWith(base)&&/^[a-z0-9]+(?:-[a-z0-9]+)*\/$/.test(path.slice(base.length))){
   const slug=path.slice(base.length).replace(/\/$/,'');
   return {section:definition.id,slug,lang,paths:Object.fromEntries(['es','en','fr'].map(key=>[key,journalPath(definition.id,key,slug)]))};
  }
 }
 return null;
}
export const journalSlug=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100).replace(/-$/,'');
export const journalImageTypes=['image/jpeg','image/png','image/webp','image/avif','image/gif'];
export const journalVideoTypes=['video/mp4','video/webm'];
