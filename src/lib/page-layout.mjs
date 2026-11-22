import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {parseFragment,serialize} from 'parse5';
import {defaultLayout,validateLayout,layoutGroups} from '../../cms/studio/public/layout-data.js';
export async function loadPageLayout({url,token,fetcher=fetch}={}){if(!url)return defaultLayout();if(!token)throw Error('DIRECTUS_READ_TOKEN is required.');const r=await fetcher(new URL('/items/page_layout/home?fields=config',url),{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error('Page layout unavailable ('+r.status+').');return validateLayout((await r.json()).data.config);}
let snapshot;
export function getPageLayout(){return snapshot??=readFile(resolve('.cms/layout.json'),'utf8').then(text=>{const data=JSON.parse(text);if(data.url!==(process.env.DIRECTUS_URL||null))throw Error('CMS layout configuration changed.');return validateLayout(data.content);}).catch(e=>{if(e.code==='ENOENT')return defaultLayout();throw e;});}
export function arrangePage(html,layout){
 const tree=parseFragment(html),attr=(n,key)=>n.attrs?.find(a=>a.name===key)?.value;
 for(const [group,defs]of Object.entries(layoutGroups)){const parent=group==='sections'?tree:tree.childNodes.find(n=>attr(n,'id')==='inicio');if(!parent)continue;
  const nodes=parent.childNodes.filter(n=>defs.some(([id,,selector])=>group==='hero'?(' '+(attr(n,'class')||'')+' ').includes(' '+selector.slice(1)+' '):attr(n,'id')===id||attr(n,'data-journal-section')===id));
  const ids=new Map();for(const n of nodes){const id=group==='hero'?defs.find(r=>(' '+attr(n,'class')+' ').includes(' '+r[2].slice(1)+' '))[0]:attr(n,'data-journal-section')||attr(n,'id');ids.set(id,n);n.attrs.push({name:'data-layout-block',value:id});if(layout.spacing[id]!==undefined)n.attrs.push({name:'style',value:'margin-block-start:'+layout.spacing[id]+'px'});}
  const ordered=layout[group].map(id=>ids.get(id)).filter(Boolean);let i=0;parent.childNodes=parent.childNodes.map(n=>nodes.includes(n)?ordered[i++]:n);
 }
 return serialize(tree);
}
