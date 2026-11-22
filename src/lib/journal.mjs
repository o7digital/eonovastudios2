import {readFile,writeFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {prepareImage} from './images.mjs';
import {journalDefinitions,journalPath,journalImageTypes,journalVideoTypes} from '../../cms/studio/public/journal-data.js';
export const emptyJournal=()=>({sections:journalDefinitions.map(d=>({id:d.id,enabled:false})),entries:[]});
export function journalRoutes(data){
 return data.sections.filter(s=>s.enabled).flatMap(s=>['es','en','fr'].flatMap(lang=>[{path:journalPath(s.id,lang),section:s.id,lang},...data.entries.filter(e=>e.section===s.id&&e.status==='published').map(entry=>({path:journalPath(s.id,lang,entry.slug),section:s.id,lang,entry}))]));
}
export function journalBuildPaths(){try{return journalRoutes(JSON.parse(readFileSync(resolve('.cms/journal.json'),'utf8')).content).map(route=>route.path);}catch(error){if(error.code==='ENOENT')return [];throw error;}}
export async function loadJournal({url,token,fetcher=fetch,output=pathToFileURL(resolve('public/_cms')+'/')}={}){
 if(!url)return emptyJournal();if(!token)throw Error('DIRECTUS_READ_TOKEN is required.');
 const headers={Authorization:'Bearer '+token};
 async function request(path){const r=await fetcher(new URL(path,url),{headers,signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error('Editorial CMS request failed ('+r.status+').');return (await r.json()).data;}
 const sections=await request('/items/journal_sections?filter[enabled][_eq]=true&fields=id,enabled&limit=-1');
 if(!Array.isArray(sections)||sections.some(s=>!journalDefinitions.some(d=>d.id===s.id)||s.enabled!==true))throw Error('Invalid editorial sections.');
 const entries=sections.length?await request('/items/journal_entries?filter[status][_eq]=published&fields=id,section,slug,title,summary,blocks,status,published_on&limit=-1&sort=-published_on'):[];
 if(!Array.isArray(entries))throw Error('Invalid editorial contents.');
 const assets=new Map(),slugs=new Set();
 const published=[];
 for(const entry of entries){
  if(!sections.some(s=>s.id===entry.section)||entry.status!=='published')continue;
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.slug)||slugs.has(entry.slug)||!entry.title?.es?.trim()||!Array.isArray(entry.blocks)||!entry.blocks.length||entry.blocks.length>60)throw Error('Invalid published editorial entry.');
  slugs.add(entry.slug);
  const blocks=[];
  for(const block of entry.blocks){
   if(block.kind==='text'){if(!block.text?.es?.trim())throw Error('Empty text block.');blocks.push({kind:'text',text:block.text});continue;}
   if(!['image','video'].includes(block.kind)||!/^[a-f\d-]{36}$/i.test(block.file))throw Error('Invalid editorial media.');
   if(!assets.has(block.file))assets.set(block.file,(async()=>{
    const file=await request('/files/'+block.file+'?fields=id,type,filesize'),types=block.kind==='image'?journalImageTypes:journalVideoTypes;
    if(!types.includes(file.type)||Number(file.filesize)>(block.kind==='image'?25:100)*1024*1024)throw Error('Invalid editorial file type or size.');
    const response=await fetcher(new URL('/assets/'+block.file,url),{headers,signal:AbortSignal.timeout(60000)});if(!response.ok)throw Error('Editorial file unavailable.');
    const bytes=Buffer.from(await response.arrayBuffer());if(!bytes.length||bytes.length>(block.kind==='image'?25:100)*1024*1024)throw Error('Invalid editorial file size.');
    const extension={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/avif':'avif','image/gif':'gif','video/mp4':'mp4','video/webm':'webm'}[file.type];
    if(block.kind==='image')return prepareImage(bytes,{output,placement:'editorial',extension});
    const filename=createHash('sha256').update(bytes).digest('hex').slice(0,24)+'.'+extension;await writeFile(new URL(filename,output),bytes);return {type:file.type,src:'/_cms/'+filename};
   })());
   const media=await assets.get(block.file);
   if(media.type.startsWith('video/')!==(block.kind==='video'))throw Error('Editorial block type mismatch.');
   blocks.push({kind:block.kind,media,caption:block.caption||{es:''}});
  }
  published.push({id:entry.id,section:entry.section,slug:entry.slug,title:entry.title,summary:entry.summary||{},blocks,status:'published',published_on:entry.published_on});
 }
 return {sections,entries:published};
}
let snapshot;
export function getJournal(){return snapshot??=readFile(resolve('.cms/journal.json'),'utf8').then(text=>{const data=JSON.parse(text);if(data.url!==(process.env.DIRECTUS_URL||null))throw Error('CMS configuration changed. Run the build.');return data.content;}).catch(error=>{if(error.code==='ENOENT')return emptyJournal();throw error;});}
