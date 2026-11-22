import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {socialLinkDefinitions,normalizeSocialUrl} from '../../cms/studio/public/social-links-data.js';
export async function loadSocialLinks({url,token,fetcher=fetch}={}){
 if(!url)return [];if(!token)throw Error('DIRECTUS_READ_TOKEN is required.');
 const response=await fetcher(new URL('/items/social_links?filter[enabled][_eq]=true&fields=id,platform,label,url,enabled,sort&sort=sort&limit=-1',url),{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(60000)});if(!response.ok)throw Error('Social links unavailable ('+response.status+').');
 const rows=(await response.json()).data;if(!Array.isArray(rows))throw Error('Invalid social links.');
 return rows.filter(row=>row.enabled===true).map(row=>{const label=socialLinkDefinitions.find(d=>d.id===row.platform)?.label||row.label,url=normalizeSocialUrl(row.url);if(!url||typeof label!=='string'||!label.trim()||label.length>60)throw Error('Invalid active social link.');return {label,url};});
}
let snapshot;
export function getSocialLinks(){return snapshot??=readFile(resolve('.cms/social-links.json'),'utf8').then(text=>{const data=JSON.parse(text);if(data.url!==(process.env.DIRECTUS_URL||null))throw Error('CMS configuration changed. Run the build.');return data.content;}).catch(error=>{if(error.code==='ENOENT')return [];throw error;});}
