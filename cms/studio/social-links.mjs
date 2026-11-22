import {randomUUID} from 'node:crypto';
import {socialLinkDefinitions,normalizeSocialUrl} from './public/social-links-data.js';
export class SocialLinksError extends Error{constructor(status,message){super(message);this.status=status;}}
const fields='id,platform,label,url,enabled,sort';
export function validateSocialLinks(items,previous){
 if(!Array.isArray(items)||!items.length||items.length>50)throw new SocialLinksError(400,'Revisa la lista de redes sociales.');
 const ids=new Set();
 return items.map(item=>{
  if(!item||Object.keys(item).some(key=>!['id','url','enabled','label'].includes(key))||typeof item.id!=='string'||ids.has(item.id)||typeof item.enabled!=='boolean')throw new SocialLinksError(400,'Revisa los campos de la red social.');
  ids.add(item.id);const original=previous.find(row=>row.id===item.id);if(!original)throw new SocialLinksError(404,'Esta red social no existe.');
  const preset=socialLinkDefinitions.find(row=>row.id===original.platform),label=preset?.label||(typeof item.label==='string'?item.label.trim():original.label);
  if(!label||label.length>60)throw new SocialLinksError(400,'Escribe un nombre de hasta 60 caracteres para la red social.');
  const url=normalizeSocialUrl(item.url);
  if(url===null||item.enabled&&!url)throw new SocialLinksError(400,'Añade una URL válida para activar '+label+'. Por ejemplo: https://www.instagram.com/tu-cuenta/');
  return {id:item.id,label,url,enabled:item.enabled};
 });
}
export function createSocialLinks({cms,write}){return {async handle({path,req,res,s,jsonBody,send}){
 if(path!=='/api/social-links')return false;
 if(req.method==='GET'){send(res,await cms('/items/social_links?fields='+fields+'&limit=-1&sort=sort',s.access));return true;}
 if(req.method==='PATCH'){
  const input=await jsonBody(req);if(Object.keys(input).length!==1||!('items'in input))throw new SocialLinksError(400,'Revisa la lista de redes sociales.');
  const previous=await cms('/items/social_links?fields='+fields+'&limit=-1',s.access),items=validateSocialLinks(input.items,previous);
  send(res,await write(()=>cms('/items/social_links?fields='+fields,s.access,'PATCH',items)));return true;
 }
 if(req.method==='POST'){
  const input=await jsonBody(req);if(Object.keys(input).some(key=>key!=='label')||input.label!==undefined&&(typeof input.label!=='string'||!input.label.trim()||input.label.length>60))throw new SocialLinksError(400,'Escribe un nombre de hasta 60 caracteres.');
  const previous=await cms('/items/social_links?fields=id,sort&limit=-1',s.access);if(previous.length>=50)throw new SocialLinksError(400,'Puedes guardar hasta 50 redes o enlaces.');
  const data={id:'custom-'+randomUUID(),platform:'custom',label:input.label?.trim()||'Otra red',url:'',enabled:false,sort:Math.max(0,...previous.map(r=>r.sort||0))+1};
  send(res,await write(()=>cms('/items/social_links?fields='+fields,s.access,'POST',data)),201);return true;
 }
 throw new SocialLinksError(405,'Esta acción no está disponible.');
}};}
