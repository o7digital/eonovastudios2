import deployment from './deployment.json' with {type:'json'};
import {defaultLayout} from './studio/public/layout-data.js';
if(process.env.PUBLIC_URL!==deployment.url)throw Error('Use the EON Directus environment.');
const auth=await fetch(deployment.url+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD,mode:'json'})});if(!auth.ok)throw Error('CMS authentication failed.');const session=(await auth.json()).data;
async function api(path,method='GET',body){const r=await fetch(deployment.url+path,{method,headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});if(!r.ok)throw Error('CMS '+method+' '+path+' failed ('+r.status+').');return r.status===204?null:(await r.json()).data;}
try{
 if(!(await api('/collections')).some(c=>c.collection==='page_layout'))await api('/collections','POST',{collection:'page_layout',schema:{},meta:{icon:'view_quilt'},fields:[{field:'id',type:'string',schema:{is_primary_key:true,is_nullable:false},meta:{readonly:true}},{field:'config',type:'json',schema:{is_nullable:false},meta:{interface:'input-code'}}]});
 if(!(await api('/items/page_layout?fields=id')).some(r=>r.id==='home'))await api('/items/page_layout','POST',{id:'home',config:defaultLayout()});
 const policies=await api('/policies?limit=-1'),permissions=await api('/permissions?limit=-1');for(const name of ['EON Studio editor','Website build']){const policy=policies.find(p=>p.name===name);if(!policy)throw Error('Missing policy '+name);for(const action of name==='Website build'?['read']:['read','update'])if(!permissions.some(p=>p.policy===policy.id&&p.collection==='page_layout'&&p.action===action))await api('/permissions','POST',{policy:policy.id,collection:'page_layout',action,fields:['*'],permissions:{}});}
 console.log('Page arrangement ready; existing content preserved.');
}finally{await api('/auth/logout','POST',{refresh_token:session.refresh_token}).catch(()=>{});}
