// Add the three optional editorial sections without changing existing content or accounts.
import deployment from './deployment.json' with {type:'json'};
import {journalDefinitions} from './studio/public/journal-data.js';
if(process.env.PUBLIC_URL!==deployment.url)throw Error('Use the EON Directus service environment.');
const login=await fetch(new URL('/auth/login',deployment.url),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD,mode:'json'})});
if(!login.ok)throw Error('CMS login failed ('+login.status+').');
const session=(await login.json()).data,token=session.access_token;
async function api(path,method='GET',body){const response=await fetch(new URL(path,deployment.url),{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(60000)});if(!response.ok)throw Error(`CMS ${method} ${path} failed (${response.status}): `+JSON.stringify((await response.json()).errors?.map(e=>e.message)));return response.status===204?null:(await response.json()).data;}
const field=(name,type='string',schema={},meta={})=>({field:name,type,schema:{is_nullable:true,...schema},meta:{interface:type==='json'?'input-code':type==='boolean'?'boolean':'input',...meta}});
try{
 const collections=await api('/collections');
 const definitions={
  journal_sections:[field('id','string',{is_primary_key:true,is_nullable:false},{readonly:true}),field('enabled','boolean',{default_value:false,is_nullable:false})],
  journal_entries:[field('id','uuid',{is_primary_key:true,is_nullable:false},{special:['uuid'],hidden:true}),field('section','string',{}, {interface:'select-dropdown',options:{choices:journalDefinitions.map(d=>({text:d.labels.es,value:d.id}))}}),field('slug','string',{is_unique:true,max_length:100}),field('status','string',{default_value:'draft'},{interface:'select-dropdown',options:{choices:[{text:'Borrador',value:'draft'},{text:'Listo para publicar',value:'published'},{text:'Archivado',value:'archived'}]}}),field('title','json'),field('summary','json'),field('blocks','json'),field('published_on','timestamp')],
 };
 for(const [collection,fields] of Object.entries(definitions)){
  if(!collections.some(row=>row.collection===collection))await api('/collections','POST',{collection,schema:{},meta:{icon:collection==='journal_sections'?'toggle_on':'article',color:'#9AEE68',note:'Blog, Mi Book y Noticias de EON NOVA',...(collection==='journal_entries'?{archive_field:'status',archive_value:'archived',unarchive_value:'draft',versioning:true}:{})},fields});
 }
 const sections=await api('/items/journal_sections?limit=-1');
 for(const definition of journalDefinitions)if(!sections.some(row=>row.id===definition.id))await api('/items/journal_sections','POST',{id:definition.id,enabled:false});
 const policies=await api('/policies?limit=-1'),permissions=await api('/permissions?limit=-1');
 for(const name of ['EON Studio editor','Website build']){
  const policy=policies.find(row=>row.name===name);if(!policy)throw Error('Missing CMS policy: '+name);
  for(const collection of Object.keys(definitions))for(const action of name==='Website build'?['read']:collection==='journal_sections'?['read','update']:['read','create','update']){
   if(!permissions.some(row=>row.policy===policy.id&&row.collection===collection&&row.action===action))await api('/permissions','POST',{policy:policy.id,collection,action,fields:['*'],permissions:{}});
  }
 }
 console.log('Blog, Mi Book and Noticias ready. Existing contents and activation choices preserved.');
}finally{await api('/auth/logout','POST',{refresh_token:session.refresh_token}).catch(()=>{});}
