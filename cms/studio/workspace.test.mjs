import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspace,eventInput,agendaIcs} from './workspace.mjs';
import {toUtc} from './public/workspace-ui.js';
import {mediaSignature,verifyMediaLease} from './social-media.mjs';

const id='12345678-1234-4123-a123-123456789012';
function fixture(options={}){
 const calls=[],cmsCalls=[];
 const cms=async(path,token,method='GET',body)=>{
  cmsCalls.push({path,token,method,body});
  if(path.startsWith('/users/me'))return {id,email:options.otherOwner?'other@example.test':'owner@example.test'};
  if(path.startsWith('/items/studio_events')){
   if(method==='POST'||method==='PATCH')return {id,...body};
   return [{id,title:'Rendez-vous',starts_at:'2026-11-10T16:00:00Z',ends_at:'2026-11-10T17:00:00Z',timezone:'America/Mexico_City',status:'planned',kind:'meeting',location:'',notes:''}];
  }
  throw new Error('Unexpected CMS request');
 };
 const fetcher=async(url,request)=>{
  const path=new URL(url).pathname.replace(/^\/api/,'');calls.push({path,...request});
  let value;
  if(path==='/auth/login')value={token:'private-eon-connector-token'};
  else if(path==='/auth/me')value={user:{tenantId:options.wrongTenant?'nathalie-tenant':'eon-tenant'}};
  else if(path==='/marketing')value={tenantName:'EON NOVA',campaigns:[],setup:options.configured?{provider:'SMTP',smtp:{passwordConfigured:true}}:{}};
  else if(path==='/social')value={tenantName:'EON NOVA',channels:[],posts:[],providers:[]};
  else if(path==='/clients')value=[];
  else if(path.endsWith('/preview'))value={html:'<html><body>Private preview</body></html>'};
  else if(path==='/social/posts/'+id)value={id,version:2,media:null};
  else value={ok:true};
  return Response.json(value);
 };
 const workspace=createWorkspace({cms,crm:'https://crm.example/api',tenant:'eon-tenant',serviceEmail:'technical@example.test',servicePassword:'private-service-password',ownerEmail:'owner@example.test',origin:'https://studio.example',fetcher,socialMedia:{prepare:async file=>({id:file,type:'image',url:'https://studio.example/social-media/'+file})}});
 async function invoke(path,method='GET',input){
  const output={};const res={removeHeader(key){output.removed=key;},setHeader(key,value){output[key]=value;},writeHead(status,headers){output.status=status;output.headers=headers;},end(value){output.html=value;}};
  await workspace.handle({path:path.split('?')[0],url:new URL(path,'https://studio.example'),req:{method},res,s:{access:'directus-user-token'},jsonBody:async()=>input,send:(_res,data,status=200)=>Object.assign(output,{data,status})});return output;
 }
 return {invoke,calls,cmsCalls};
}

test('workspace delegation fixes the EON tenant, resolves the current owner and never returns connector credentials',async()=>{
 const f=fixture();const overview=await f.invoke('/api/workspace/overview');
 assert.equal(overview.data.marketing.tenantName,'EON NOVA');assert.ok(!JSON.stringify(overview).includes('private-'));
 assert.equal(f.cmsCalls[0].token,'directus-user-token');assert.equal(f.calls.find(c=>c.path==='/marketing').headers.Authorization,'Bearer private-eon-connector-token');
 const foreign=fixture({wrongTenant:true});await assert.rejects(foreign.invoke('/api/workspace/clients'),error=>error.status===403);assert.ok(!foreign.calls.some(c=>c.path==='/clients'));
 const other=fixture({otherOwner:true});await assert.rejects(other.invoke('/api/workspace/overview'),error=>error.status===403);assert.equal(other.calls.length,0);
});

test('workspace rejects arbitrary resources, tenant injection and unconfirmed external actions',async()=>{
 const f=fixture();
 await assert.rejects(f.invoke('/api/workspace/users'),error=>error.status===404);
 await assert.rejects(f.invoke('/api/workspace/clients','POST',{name:'Name',tenantId:'foreign'}),error=>error.status===400);
 await assert.rejects(f.invoke('/api/social/posts/'+id+'/approve','POST',{version:2,action:'NOW',confirmed:false}),error=>error.status===400);
 await assert.rejects(f.invoke('/api/workspace/marketing/campaigns/'+id+'/dispatch','POST',{version:1,action:'EMAIL_SEND',clientIds:[id]}),error=>error.status===400);
 await assert.rejects(f.invoke('/api/workspace/marketing/campaigns/'+id+'/dispatch','POST',{version:1,action:'EMAIL_TEST'}),error=>error.status===409);
 assert.ok(!f.calls.some(c=>c.path.endsWith('/approve')||c.path.endsWith('/dispatch')));
 await f.invoke('/api/social/oauth/meta/start','POST',{redirectUri:'https://foreign.example',tenantId:'other'});
 assert.equal(JSON.parse(f.calls.find(c=>c.path.endsWith('/start')).body).redirectUri,'https://studio.example/social-callback.html');
});

test('confirmed campaign requests use the stored provider and previews remain sandboxed and private',async()=>{
 const f=fixture({configured:true});
 await f.invoke('/api/workspace/marketing/campaigns/'+id+'/dispatch','POST',{version:1,action:'EMAIL_SEND',clientIds:[id],consentConfirmed:true});
 const dispatch=f.calls.find(c=>c.path.endsWith('/dispatch'));assert.deepEqual(JSON.parse(dispatch.body),{version:1,action:'EMAIL_SEND',clientIds:[id]});
 const preview=await f.invoke('/api/workspace/email-preview/'+id);assert.equal(preview.status,200);assert.match(preview['Content-Security-Policy'],/sandbox/);assert.equal(preview.headers['Cache-Control'],'no-store');assert.equal(preview.removed,'X-Frame-Options');
});

test('private agenda validates dates, creates server IDs, and escapes calendar content',async()=>{
 const f=fixture();const input={title:'A creative meeting',starts_at:'2026-11-10T16:00:00Z',ends_at:'2026-11-10T17:00:00Z',timezone:'America/Mexico_City'};
 const created=await f.invoke('/api/workspace/events','POST',input);assert.equal(created.status,201);assert.match(created.data.id,/^[a-f\d-]{36}$/);
 assert.throws(()=>eventInput({...input,ends_at:input.starts_at},true),/fin/);
 assert.throws(()=>eventInput({...input,timezone:'Unknown/Zone'},true),/zona horaria/);
 assert.throws(()=>eventInput({...input,id:'submitted-id'},true),/no permitidos/);
 const ics=agendaIcs([{...input,id,title:'Titre\nBEGIN:VEVENT',notes:'Notes, privées; 👋 '.repeat(10)}]);assert.match(ics,/SUMMARY:Titre\\nBEGIN:VEVENT/);assert.equal((ics.match(/\r\nBEGIN:VEVENT/g)||[]).length,1);
 for(const line of ics.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75);
 assert.equal(toUtc('2026-11-10T10:00','America/Mexico_City'),'2026-11-10T16:00:00.000Z');
 assert.throws(()=>toUtc('2026-11-01T01:30','America/New_York'),/ambigua/);
 assert.throws(()=>toUtc('2027-03-14T02:30','America/New_York'),/no existe/);
});

test('social media leases expire, reject changes and do not authorize another file',()=>{
 const secret='private-media-signature-secret';const now=Date.now(),nbf=Math.floor((now-60000)/1000),exp=Math.floor((now+3600000)/1000),version='v'.repeat(43);
 const link=new URL('https://studio.example/social-media/'+id);for(const[k,v]of Object.entries({nbf,exp,v:version,sig:mediaSignature(secret,id,nbf,exp,version)}))link.searchParams.set(k,String(v));
 assert.equal(verifyMediaLease(secret,link,now).id,id);
 assert.throws(()=>verifyMediaLease(secret,link,now+5*3600000));link.searchParams.set('v','x'.repeat(43));assert.throws(()=>verifyMediaLease(secret,link,now));
});
