// Additive migration: keep all edited texts and uploaded originals.
import deployment from './deployment.json' with {type:'json'};
if (process.env.PUBLIC_URL !== deployment.url) throw new Error('Use the EON Directus service environment.');
const base = process.env.PUBLIC_URL;
const login = await fetch(new URL('/auth/login',base),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD,mode:'json'})});
if (!login.ok) throw new Error(`CMS login failed (${login.status}).`);
const token=(await login.json()).data.access_token;
async function api(path,method='GET',body){
 const response=await fetch(new URL(path,base),{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw new Error(`CMS ${method} ${path} failed (${response.status}).`);
 return response.status===204?null:(await response.json()).data;
}
const fields=await api('/fields/section_media');
for(const [field,default_value] of [['position','50% 50%'],['fit','cover']]){
 if(!fields.some(item=>item.field===field))await api('/fields/section_media','POST',{field,type:'string',schema:{is_nullable:true,default_value},meta:{interface:'input',width:'half'}});
}
if(!fields.some(item=>item.field==='logo_size'))await api('/fields/section_media','POST',{field:'logo_size',type:'integer',schema:{is_nullable:true,default_value:80},meta:{interface:'input',width:'half',note:'Altura del logo en píxeles (40 a 120). Se aplica al sitio y a la vista editable.'}});
await api('/fields/section_media/placement','PATCH',{meta:{interface:'select-dropdown',options:{choices:[{text:'Mi logo · encabezado y pie',value:'logo'},{text:'Inicio · foto o video',value:'hero'},{text:'El estudio',value:'studio'},{text:'Diseño gráfico',value:'graphic'},{text:'Diseño digital',value:'digital'}]}}});
await api('/fields/section_media/image','PATCH',{meta:{interface:'file',note:'Fotos: 25 MB. Videos MP4/WebM: 100 MB. Logo: imagen.'}});
console.log('Media schema ready: logo, videos, framing. Existing content preserved.');
