import {randomUUID} from 'node:crypto';
import {journalDefinitions,journalImageTypes,journalVideoTypes} from './public/journal-data.js';
const uuid=/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
const sectionIds=journalDefinitions.map(item=>item.id);
export class JournalError extends Error{constructor(status,message){super(message);this.status=status;}}
const fail=message=>{throw new JournalError(400,message);};
function translations(value,maximum,required=false){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['es','en','fr'].includes(key)))fail('Revisa los textos de los idiomas.');
 for(const text of Object.values(value))if(typeof text!=='string'||text.length>maximum)fail('El texto supera el tamaño permitido.');
 if(required&&!value.es?.trim())fail('Escribe el contenido en español. Los otros idiomas son opcionales.');
 return Object.fromEntries(['es','en','fr'].map(lang=>[lang,value[lang]?.trim()||'']));
}
export function validateJournalEntry(input){
 if(!input||Object.keys(input).some(key=>!['section','slug','title','summary','blocks','status'].includes(key)))fail('Este campo no se puede editar.');
 if(!sectionIds.includes(input.section)||!['draft','published','archived'].includes(input.status)||typeof input.slug!=='string'||input.slug.length>100||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug))fail('Elige una sección, un estado y una dirección válidos.');
 const title=translations(input.title,200,true),summary=translations(input.summary||{},1500);
 if(!Array.isArray(input.blocks)||input.blocks.length>60)fail('Usa un máximo de 60 bloques por publicación.');
 const ids=new Set();
 const blocks=input.blocks.map(block=>{
  if(!block||!uuid.test(block.id)||ids.has(block.id)||!['text','image','video'].includes(block.kind)||Object.keys(block).some(key=>!['id','kind','text','file','caption'].includes(key)))fail('Revisa los bloques de contenido.');
  ids.add(block.id);
  if(block.kind==='text')return {id:block.id,kind:'text',text:translations(block.text,12000,true)};
  if(!uuid.test(block.file))fail('Selecciona una foto o video para cada bloque.');
  return {id:block.id,kind:block.kind,file:block.file,caption:translations(block.caption||{},500)};
 });
 if(input.status==='published'&&!blocks.length)fail('Añade contenido antes de marcar la publicación como lista.');
 const output={section:input.section,slug:input.slug,title,summary,blocks,status:input.status};
 if(Buffer.byteLength(JSON.stringify(output))>850000)fail('Esta publicación es demasiado larga. Divídela en varias publicaciones.');
 return output;
}
export function createJournal({cms,write}){
 return {async handle({path,req,res,s,jsonBody,send}){
  if(!path.startsWith('/api/journal'))return false;
  if(path==='/api/journal'&&req.method==='GET'){
   const [sections,entries]=await Promise.all([cms('/items/journal_sections?fields=id,enabled&limit=-1',s.access),cms('/items/journal_entries?fields=id,section,slug,title,summary,blocks,status,published_on&limit=-1&sort=-published_on',s.access)]);
   send(res,{sections,entries});return true;
  }
  const section=path.match(/^\/api\/journal\/sections\/(blog|book|news)$/)?.[1];
  if(section&&req.method==='PATCH'){
   const input=await jsonBody(req);if(Object.keys(input).length!==1||typeof input.enabled!=='boolean')fail('Elige activar o desactivar la sección.');
   send(res,await write(()=>cms('/items/journal_sections/'+section,s.access,'PATCH',input)));return true;
  }
  const entry=path.match(/^\/api\/journal\/entries\/([a-f\d-]{36})$/i)?.[1];
  if((path==='/api/journal/entries'&&req.method==='POST')||(entry&&req.method==='PATCH')){
   const input=validateJournalEntry(await jsonBody(req,1048576));
   for(const block of input.blocks.filter(block=>block.kind!=='text')){
    const file=await cms(`/files/${block.file}?fields=id,type,filesize`,s.access),types=block.kind==='image'?journalImageTypes:journalVideoTypes;
    if(!types.includes(file.type)||!Number(file.filesize)||Number(file.filesize)>(block.kind==='image'?25:100)*1024*1024)fail('Fotos: 25 MB. Videos MP4/WebM: 100 MB. Revisa el tipo de cada archivo.');
   }
   const duplicates=await cms(`/items/journal_entries?filter[slug][_eq]=${encodeURIComponent(input.slug)}&fields=id&limit=-1`,s.access);
   if(duplicates.some(row=>row.id!==entry))throw new JournalError(409,'Esta dirección ya existe. Cambia la dirección de la publicación.');
   const previous=entry?await cms('/items/journal_entries/'+entry+'?fields=id,published_on',s.access):null;
   const data={...input,...(!entry?{id:randomUUID()}:{}),...(!previous?.published_on&&input.status==='published'?{published_on:new Date().toISOString()}:{})};
   send(res,await write(()=>cms('/items/journal_entries'+(entry?'/'+entry:''),s.access,entry?'PATCH':'POST',data)),entry?200:201);return true;
  }
  throw new JournalError(404,'Esta publicación no existe.');
 }};
}
