import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import deployment from '../deployment.json' with {type:'json'};
const base=process.env.PUBLIC_URL;
if(base!==deployment.url||!process.env.ADMIN_PASSWORD)throw new Error('Use the EON Directus Railway variables.');
let token;
async function api(path,method='GET',body){
 const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw new Error(`EON setup: ${method} ${path} ${response.status}`);
 return response.status===204?null:(await response.json()).data;
}
token=(await api('/auth/login','POST',{email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD})).access_token;
if(!(await api('/collections')).some(row=>row.collection==='studio_events')){
 const field=(field,type,meta={},schema={})=>({field,type,schema:{is_nullable:true,...schema},meta:{interface:type==='text'?'input-multiline':'input',...meta}});
 await api('/collections','POST',{collection:'studio_events',schema:{},meta:{icon:'event',note:'Agenda privé EON NOVA. Ne pas accorder au compte Website build.',display_template:'{{title}}'},fields:[
  field('id','uuid',{hidden:true,special:['uuid']},{is_primary_key:true,is_nullable:false}),field('title','string',{required:true},{max_length:180}),
  field('starts_at','timestamp',{interface:'datetime',required:true}),field('ends_at','timestamp',{interface:'datetime',required:true}),field('timezone','string',{}, {max_length:100}),
  field('kind','string',{}, {max_length:40}),field('status','string',{}, {max_length:40,default_value:'planned'}),field('location','string',{}, {max_length:500}),field('notes','text'),
 ]});
 console.log('Created private EON agenda.');
}
const h=createHash('sha256').update('eon-nova:private-social-media').digest('hex');
const folder=`${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
if(!(await api('/folders?limit=-1')).some(row=>row.id===folder))await api('/folders','POST',{id:folder,name:'EON NOVA · Réseaux sociaux'});
const set=spawnSync('railway',['variable','set','STUDIO_MEDIA_READ_TOKEN','--stdin','--project',deployment.projectId,'--service','studio','--environment','production','--skip-deploys','--json'],{input:process.env.WEBSITE_READ_TOKEN,encoding:'utf8'});
if(set.status)throw new Error('Could not configure private media reader.');
console.log('Private agenda and media configured. No secrets printed.');
