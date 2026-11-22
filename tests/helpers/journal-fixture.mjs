import {defaultLayout} from '../../cms/studio/public/layout-data.js';
import {createServer} from 'node:net';
import {randomUUID} from 'node:crypto';
import {socialLinkDefinitions} from '../../cms/studio/public/social-links-data.js';
import {createStudioServer} from '../../cms/studio/server.mjs';
export async function journalFixture(t,{readonly=false,autoTranslate=false,translationFailure=false}={}){
 const reservation=createServer();await new Promise(r=>reservation.listen(0,'127.0.0.1',r));const port=reservation.address().port;await new Promise(r=>reservation.close(r));
 const base='http://127.0.0.1:'+port,sections=['blog','book','news'].map(id=>({id,enabled:false})),entries=[],files=new Map(),texts=autoTranslate?[{id:randomUUID(),section:'hero',source:'Diseñamos historias',label:'Título principal',es:'Diseñamos historias',en:'We design stories',fr:'Nous créons des histoires',status:'published'}]:[],mediaRows=[],translationCalls=[];let publications=0;const socialRows=socialLinkDefinitions.map((d,sort)=>({id:d.id,platform:d.id,label:d.label,url:'',enabled:false,sort}));
 const layout={config:defaultLayout()};
 const server=createStudioServer({cms:'https://cms.example',origin:base,secret:'a-test-session-secret-of-at-least-32-characters',secure:false,autoTranslate,translationUrl:'https://translate.example/translate',translationKey:'test-key',publishEnabled:true,publishSecret:'test-publish-secret',async fetcher(url,options={}){
  const u=new URL(url),path=u.pathname,result=data=>Response.json({data}),input=()=>JSON.parse(options.body);
  if(u.origin==='https://translate.example'){translationCalls.push(input());return translationFailure?new Response('',{status:503}):Response.json({translations:input().items.map(item=>({id:item.id,en:'EN '+item.text,fr:'FR '+item.text}))});}
  if(path==='/auth/login'||path==='/auth/refresh')return result({access_token:readonly?'readonly':'editor',refresh_token:'refresh',expires:3600000});
  if(path==='/items/page_layout/home'){if(options.method==='PATCH'){if(readonly)return new Response(null,{status:403});layout.config=input().config;}return result(layout);}
  if(path==='/auth/logout')return new Response(null,{status:204});
  if(path==='/users/me')return result({id:'owner',email:'owner@example.com',first_name:'Eon'});
  if(path==='/permissions/me')return result(Object.fromEntries(['site_texts','journal_entries','section_media','page_layout'].map(collection=>[collection,Object.fromEntries(['create','update'].map(action=>[action,{access:readonly?'none':'full'}]))])));
  if(path==='/items/site_texts'){if(options.method==='PATCH'){if(readonly)return new Response(null,{status:403});return result(input().map(change=>{const row=texts.find(r=>r.id===change.id);Object.assign(row,change);return row;}));}return result(structuredClone(texts));}
  if(path==='/items/section_media'){if(options.method==='POST'){if(readonly)return new Response(null,{status:403});mediaRows.push(input());return result(mediaRows.at(-1));}return result(structuredClone(mediaRows));}
  if(path.startsWith('/items/section_media/')){const row=mediaRows.find(r=>r.id===path.split('/').at(-1));if(!row)return new Response(null,{status:404});if(options.method==='PATCH'){if(readonly)return new Response(null,{status:403});Object.assign(row,input());}return result(row);}
  if(path==='/folders')return result([]);
  if(path==='/api/cms-publish'){publications++;return Response.json({id:'deployment'},{status:202});}
  if(path==='/items/social_links'){
   if(options.method==='PATCH'){if(readonly)return new Response(null,{status:403});return result(input().map(change=>{const row=socialRows.find(r=>r.id===change.id);Object.assign(row,change);return row;}));}
   if(options.method==='POST'){if(readonly)return new Response(null,{status:403});socialRows.push(input());return result(socialRows.at(-1));}
   return result(structuredClone(socialRows));
  }
  if(path==='/items/journal_sections')return result(structuredClone(sections));
  if(path.startsWith('/items/journal_sections/')){if(readonly)return new Response(null,{status:403});const section=sections.find(s=>s.id===path.split('/').at(-1));Object.assign(section,input());return result(section);}
  if(path==='/items/journal_entries'){
   if(options.method==='POST'){if(readonly)return new Response(null,{status:403});entries.push(input());return result(entries.at(-1));}
   const slug=u.searchParams.get('filter[slug][_eq]');return result(structuredClone(slug?entries.filter(e=>e.slug===slug):entries));
  }
  if(path.startsWith('/items/journal_entries/')){const entry=entries.find(e=>e.id===path.split('/').at(-1));if(!entry)return new Response(null,{status:404});if(options.method==='PATCH'){if(readonly)return new Response(null,{status:403});Object.assign(entry,input());}return result(entry);}
  if(path==='/files'&&options.method==='POST'){if(readonly)return new Response(null,{status:403});const file=options.body.get('file'),id=randomUUID(),value={id,type:file.type,bytes:Buffer.from(await file.arrayBuffer()),filename_download:file.name};files.set(id,value);return result({id,type:file.type,filename_download:file.name});}
  if(path.startsWith('/files/')){const file=files.get(path.split('/').at(-1));return file?result({...file,bytes:undefined,filesize:file.bytes.length}):new Response(null,{status:404});}
  if(path.startsWith('/assets/')){const file=files.get(path.split('/').at(-1));return file?new Response(file.bytes,{headers:{'Content-Type':file.type}}):new Response(null,{status:404});}
  if(u.origin==='https://www.eonovastudios.com')return new Response('<!doctype html><html><head></head><body><main><section id="inicio" class="hero"><div class="hero-top">Presentación</div><div class="hero-copy"><h1>Diseñamos historias</h1></div><div class="hero-bottom">Disciplinas</div><div class="hero-word">EON NOVA</div></section><section id="universos">Motion Lab</section><section id="studio">Studio</section><section id="servicios">Servicios</section><section id="contacto">Contacto</section><footer>Pie</footer></main></body></html>');
  throw Error('Unexpected fixture request '+path);
 }});
 await new Promise(r=>server.listen(port,'127.0.0.1',r));t.after(()=>new Promise(r=>{server.closeAllConnections();server.close(r);}));
 const login=await fetch(base+'/api/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({email:'owner@example.com',password:'test-password'})}),cookie=login.headers.get('set-cookie').split(';')[0];
 const request=(path,method='GET',data)=>fetch(base+path,{method,headers:{Origin:base,Cookie:cookie,'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});
 return {base,sections,entries,files,cookie,request,socialRows,texts,mediaRows,translationCalls,layout,publications:()=>publications};
}
