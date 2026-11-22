// Add the account-password flag and an EON editor role without administrator privileges.
import {randomBytes} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import deployment from '../deployment.json' with {type:'json'};
if(process.env.PUBLIC_URL!==deployment.url||!process.env.ADMIN_EMAIL||!process.env.ADMIN_PASSWORD)throw new Error('Use the EON Directus service environment.');
let token;
async function api(path,method='GET',body){
 const response=await fetch(new URL(path,deployment.url),{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
 const result=response.status===204?null:await response.json();
 if(!response.ok)throw new Error(`${method} ${path} failed (${response.status}): ${result?.errors?.map(e=>e.message).join('; ')||'CMS error'}`);
 return result?.data;
}
const session=await api('/auth/login','POST',{email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD,mode:'json'});token=session.access_token;
try{
 if(!(await api('/fields/directus_users')).some(field=>field.field==='studio_password_temporary'))await api('/fields/directus_users','POST',{field:'studio_password_temporary',type:'boolean',schema:{default_value:false,is_nullable:false},meta:{interface:'boolean',hidden:true,note:'Temporary password; the user can replace it in Mi cuenta without restricting Studio access.'}});
 let policy=(await api('/policies?limit=-1')).find(row=>row.name==='EON Studio editor');
 if(!policy)policy=await api('/policies','POST',{name:'EON Studio editor',icon:'edit',admin_access:false,app_access:true});
 else await api('/policies/'+policy.id,'PATCH',{app_access:true});
 const existing=await api('/permissions?limit=-1');
 const rules=[
  ['site_texts','read'],['site_texts','update'],
  ['section_media','read'],['section_media','create'],['section_media','update'],
  ['directus_folders','read'],['directus_files','read'],['directus_files','create'],
  ['studio_events','read'],['studio_events','create'],['studio_events','update'],
 ];
 for(const [collection,action] of rules){
  const previous=existing.find(row=>row.policy===policy.id&&row.collection===collection&&row.action===action);
  const body={policy:policy.id,collection,action,fields:['*'],permissions:{}};
  await api('/permissions'+(previous?'/'+previous.id:''),previous?'PATCH':'POST',body);
 }
 let role=(await api('/roles?limit=-1')).find(row=>row.name==='EON Studio editor');
 if(!role)role=await api('/roles','POST',{name:'EON Studio editor',icon:'edit',policies:[{policy:policy.id}]});
 // Core does not support custom item/field rules. Keep the user-collection
 // writer exclusively on the server. The Studio accepts only password/flag
 // changes, binds the target to the session, and verifies the current password.
 let writer=(await api('/policies?limit=-1')).find(row=>row.name==='Studio account service');
 if(!writer)writer=await api('/policies','POST',{name:'Studio account service',icon:'lock',admin_access:false,app_access:false});
 const writerPermissions=await api('/permissions?limit=-1');
 for(const action of ['read','update']){
  const previous=writerPermissions.find(row=>row.policy===writer.id&&row.collection==='directus_users'&&row.action===action);
  await api('/permissions'+(previous?'/'+previous.id:''),previous?'PATCH':'POST',{policy:writer.id,collection:'directus_users',action,fields:['*'],permissions:{}});
 }
 let writerRole=(await api('/roles?limit=-1')).find(row=>row.name==='Studio account service');
 if(!writerRole)writerRole=await api('/roles','POST',{name:'Studio account service',icon:'lock',policies:[{policy:writer.id}]});
 const users=await api('/users?fields=id,first_name&limit=-1');
 if(!users.some(user=>user.first_name==='Studio account service')){
  const writerToken=randomBytes(48).toString('base64url');
  await api('/users','POST',{first_name:'Studio account service',status:'active',role:writerRole.id,token:writerToken});
  execFileSync('railway',['variable','set','STUDIO_ACCOUNT_WRITE_TOKEN','--stdin','--project',deployment.projectId,'--service',deployment.studioServiceId,'--environment',deployment.environmentId,'--skip-deploys','--json'],{input:writerToken,stdio:['pipe','pipe','pipe']});
 }
 console.log(JSON.stringify({accountSchemaReady:true,editorRole:role.id,administratorAccess:false,accountServiceConfigured:true}));
}finally{await api('/auth/logout','POST',{refresh_token:session.refresh_token}).catch(()=>{});}
