import {createServer} from 'node:net';
import {randomUUID} from 'node:crypto';
import {createStudioServer} from '../../cms/studio/server.mjs';
export async function journalFixture(t,{readonly=false}={}){
 const reservation=createServer();await new Promise(r=>reservation.listen(0,'127.0.0.1',r));const port=reservation.address().port;await new Promise(r=>reservation.close(r));
 const base='http://127.0.0.1:'+port,sections=['blog','book','news'].map(id=>({id,enabled:false})),entries=[],files=new Map();let publications=0;
 const server=createStudioServer({cms:'https://cms.example',origin:base,secret:'a-test-session-secret-of-at-least-32-characters',secure:false,publishEnabled:true,publishSecret:'test-publish-secret',async fetcher(url,options={}){
  const u=new URL(url),path=u.pathname,result=data=>Response.json({data}),input=()=>JSON.parse(options.body);
  if(path==='/auth/login'||path==='/auth/refresh')return result({access_token:readonly?'readonly':'editor',refresh_token:'refresh',expires:3600000});
  if(path==='/auth/logout')return new Response(null,{status:204});
  if(path==='/users/me')return result({id:'owner',email:'owner@example.com',first_name:'Eon'});
  if(path==='/permissions/me')return result({site_texts:{update:{access:readonly?'none':'full'}}});
  if(path==='/items/site_texts'||path==='/items/section_media'||path==='/folders')return result([]);
  if(path==='/api/cms-publish'){publications++;return Response.json({id:'deployment'},{status:202});}
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
  if(u.origin==='https://www.eonovastudios.com')return new Response('<!doctype html><html><head></head><body><main><h1>EON NOVA</h1></main></body></html>');
  throw Error('Unexpected fixture request '+path);
 }});
 await new Promise(r=>server.listen(port,'127.0.0.1',r));t.after(()=>new Promise(r=>{server.closeAllConnections();server.close(r);}));
 const login=await fetch(base+'/api/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({email:'owner@example.com',password:'test-password'})}),cookie=login.headers.get('set-cookie').split(';')[0];
 const request=(path,method='GET',data)=>fetch(base+path,{method,headers:{Origin:base,Cookie:cookie,'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});
 return {base,sections,entries,files,cookie,request,publications:()=>publications};
}
