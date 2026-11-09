import {randomUUID} from 'node:crypto';
export class WorkspaceError extends Error{constructor(status,message){super(message);this.status=status;}}
const fail=(status,message)=>{throw new WorkspaceError(status,message);};
const ensureKeys=(value,keys)=>{if(!value||Array.isArray(value)||typeof value!=='object'||Object.keys(value).some(key=>!keys.includes(key)))fail(400,'Ce formulaire contient des champs non autorisés.');};
const eventFields='id,title,starts_at,ends_at,timezone,kind,status,location,notes';
export function eventInput(input,creating=false){
 ensureKeys(input,['title','starts_at','ends_at','timezone','kind','status','location','notes']);
 if(Object.values(input).some(v=>typeof v!=='string'||v.length>10000))fail(400,'Vérifiez les champs du rendez-vous.');
 if(creating&&(!input.title?.trim()||!input.starts_at||!input.ends_at||!input.timezone))fail(400,'Complétez le titre et les horaires.');
 if(input.title!==undefined&&(!input.title.trim()||input.title.length>180))fail(400,'Donnez un titre de 180 caractères maximum.');
 for(const field of ['starts_at','ends_at'])if(input[field]!==undefined&&(!/^\d{4}-\d\d-\d\dT/.test(input[field])||!Number.isFinite(Date.parse(input[field]))))fail(400,'Choisissez des horaires valides.');
 if(input.starts_at&&input.ends_at&&Date.parse(input.ends_at)<=Date.parse(input.starts_at))fail(400,'La fin doit suivre le début du rendez-vous.');
 if(input.timezone){try{new Intl.DateTimeFormat('fr',{timeZone:input.timezone}).format();}catch{fail(400,'Ce fuseau horaire est invalide.');}}
 if(input.status&&!['planned','confirmed','completed','cancelled'].includes(input.status))fail(400,'Ce statut est invalide.');
 if(input.kind&&!['meeting','production','deadline','event','personal'].includes(input.kind))fail(400,'Ce type de rendez-vous est invalide.');
 if(input.location?.length>500)fail(400,'Le lieu dépasse 500 caractères.');
 return input;
}
export function agendaIcs(rows){
 const escape=value=>String(value||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
 const date=value=>new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//EON NOVA//Studio//FR','CALSCALE:GREGORIAN'];
 for(const row of rows){lines.push('BEGIN:VEVENT',`UID:${row.id}@eonovastudios.com`,`DTSTAMP:${date(Date.now())}`,`DTSTART:${date(row.starts_at)}`,`DTEND:${date(row.ends_at)}`,`SUMMARY:${escape(row.title)}`,`LOCATION:${escape(row.location)}`,`DESCRIPTION:${escape(row.notes)}`,`STATUS:${row.status==='cancelled'?'CANCELLED':'CONFIRMED'}`,'END:VEVENT');}
 lines.push('END:VCALENDAR');
 return lines.map(line=>{let out='',current='';for(const char of line){if(Buffer.byteLength(current+char)>74){out+=current+'\r\n ';current='';}current+=char;}return out+current;}).join('\r\n')+'\r\n';
}
export function createWorkspace({cms,crm,tenant,serviceEmail,servicePassword,ownerEmail,origin,fetcher=fetch,socialMedia}){
 let cached;
 const ready=()=>Boolean(crm&&tenant&&serviceEmail&&servicePassword&&ownerEmail);
 async function request(path,token,method='GET',data){
  const r=await fetcher(crm.replace(/\/$/,'')+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(data!==undefined?{'Content-Type':'application/json'}:{})},body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(60000),redirect:'error'});
  const value=r.status===204?null:await r.json().catch(()=>null);
  if(!r.ok){const message=Array.isArray(value?.message)?value.message.join(' · '):value?.message;fail([400,401,403,404,409,422,429,503].includes(r.status)?r.status:502,typeof message==='string'&&message.length<1800?message:'O7 ne peut pas terminer cette action. Vos contenus enregistrés sont conservés.');}
  return value;
 }
 async function identity(s){
  const profile=await cms('/users/me?fields=id,email',s.access);
  if(!ownerEmail||profile.email?.toLowerCase()!==ownerEmail.toLowerCase())fail(403,'Les communications et les contacts sont réservés au propriétaire du Studio.');
  if(!ready())fail(503,'La connexion de votre espace O7 est en cours de configuration.');
  if(!cached||cached.until<Date.now()){
   const result=await request('/auth/login',null,'POST',{email:serviceEmail,password:servicePassword});
   const me=await request('/auth/me',result.token);
   if(me?.user?.tenantId!==tenant)fail(403,'La connexion ne correspond pas à l’espace EON NOVA.');
   cached={token:result.token,until:Date.now()+240000};
  }
  const me=await request('/auth/me',cached.token);
  if(me?.user?.tenantId!==tenant){cached=null;fail(403,'La connexion ne correspond pas à EON NOVA.');}
  return cached.token;
 }
 async function handle({path,url,req,res,s,jsonBody,send,body}){
  if(!path.startsWith('/api/workspace/')&&!path.startsWith('/api/social'))return false;
  // Every action is bound to the freshly resolved Directus owner and fixed EON tenant.
  const token=await identity(s);
  if(path==='/api/workspace/overview'&&req.method==='GET'){
   const [marketing,social,contacts,events]=await Promise.all([request('/marketing',token),request('/social',token),request('/clients',token),cms(`/items/studio_events?fields=${eventFields}&limit=-1&sort=starts_at`,s.access)]);
   send(res,{marketing,social,contacts,events,testRecipient:serviceEmail});return true;
  }
  const emailPreview=path.match(/^\/api\/workspace\/email-preview\/([\w-]+)$/)?.[1];
  if(emailPreview&&req.method==='GET'){
   const preview=await request(`/marketing/campaigns/${emailPreview}/preview`,token);
   res.removeHeader('X-Frame-Options');
   res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; frame-ancestors 'self'; base-uri 'none'; sandbox");
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(preview.html);return true;
  }
  if((path==='/api/workspace/events'||path==='/api/workspace/events.ics')&&req.method==='GET'){
   const rows=await cms(`/items/studio_events?fields=${eventFields}&limit=-1&sort=starts_at`,s.access);
   if(path.endsWith('.ics')){res.writeHead(200,{'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'attachment; filename="eon-nova-agenda.ics"','Cache-Control':'no-store'});res.end(agendaIcs(rows));}else send(res,rows);
   return true;
  }
  const event=path.match(/^\/api\/workspace\/events\/([a-f\d-]{36})$/i)?.[1];
  if((path==='/api/workspace/events'&&req.method==='POST')||(event&&req.method==='PATCH')){
   const input=eventInput(await jsonBody(req),!event);
   if(event){const {id,...previous}=await cms(`/items/studio_events/${event}?fields=${eventFields}`,s.access);eventInput({...previous,...input},true);}
   const data=event?input:{id:randomUUID(),location:'',notes:'',kind:'event',...input,status:input.status||'planned'};
   send(res,await cms(`/items/studio_events${event?'/'+event:''}?fields=${eventFields}`,s.access,event?'PATCH':'POST',data),event?200:201);return true;
  }
  if(path==='/api/social/upload'&&req.method==='POST'){
   send(res,await socialMedia.upload(req,s.access),201);return true;
  }
  const preview=path.match(/^\/api\/social\/media-preview\/([a-f\d-]{36})$/i)?.[1];
  if(preview&&req.method==='GET'){await socialMedia.privateStream(req,res,preview,s.access);return true;}
  let route=path.startsWith('/api/workspace/')?path.replace('/api/workspace',''):path.slice(4);
  const get=req.method==='GET',post=req.method==='POST',patch=req.method==='PATCH';
  const allowed=(get&&(/^\/(clients|marketing|social)$/.test(route)||/^\/marketing\/(campaigns|audience|calendar)$/.test(route)||/^\/marketing\/campaigns\/[\w-]+\/preview$/.test(route)||/^\/social\/(posts|calendar)$/.test(route)||/^\/social\/posts\/[\w-]+$/.test(route)||/^\/social\/oauth\/[\w-]+\/candidates$/.test(route)))||
   (post&&(/^\/(clients|marketing\/campaigns|social\/posts)$/.test(route)||/^\/marketing\/campaigns\/[\w-]+\/(dispatch|refresh)$/.test(route)||/^\/social\/posts\/[\w-]+\/(approve|cancel|refresh)$/.test(route)||/^\/social\/channels\/[\w-]+\/disconnect$/.test(route)||/^\/social\/oauth\/(meta|youtube|x)\/start$/.test(route)||route==='/social/oauth/complete'||/^\/social\/oauth\/[\w-]+\/confirm$/.test(route)))||
   (patch&&(/^\/clients\/[\w-]+$/.test(route)||/^\/marketing\/campaigns\/[\w-]+$/.test(route)||route==='/marketing/connections'||/^\/social\/posts\/[\w-]+$/.test(route)));
  if(!allowed)fail(404,'Cette action n’est pas disponible dans le Studio.');
  let input;
  if(!get){
   input=await jsonBody(req);
   if(route.startsWith('/clients'))ensureKeys(input,['name','firstName','email','phone','company','function','notes','clientStatus']);
   else if(/^\/marketing\/campaigns(?:\/[\w-]+)?$/.test(route))ensureKeys(input,['title','kind','status','plannedAt','timezone','document','version']);
   else if(route.endsWith('/dispatch')){
    ensureKeys(input,['version','action','clientIds','consentConfirmed']);
    if(!['EMAIL_TEST','EMAIL_SEND','MAILCHIMP_DRAFT'].includes(input.action))fail(400,'Choisissez une action de mailing valide.');
    if(input.action==='EMAIL_SEND'&&input.consentConfirmed!==true)fail(400,'Confirmez la liste des destinataires avant l’envoi.');
    const workspace=await request('/marketing',token),setup=workspace.setup||{};
    const configured=input.action==='MAILCHIMP_DRAFT'?setup.mailchimp?.apiKeyConfigured:setup.smtp?.passwordConfigured&&['SMTP','MAILCOW'].includes(setup.provider);
    if(!configured)fail(409,input.action==='MAILCHIMP_DRAFT'?'Connectez Mailchimp dans Connexions avant de créer un brouillon.':'Configurez votre expéditeur SMTP dans Connexions avant de tester ou d’envoyer une campagne.');
    delete input.consentConfirmed;
   }else if(route==='/marketing/connections')ensureKeys(input,['provider','config']);
   else if(/^\/social\/posts(?:\/[\w-]+)?$/.test(route)){
    ensureKeys(input,['clientKey','title','text','timezone','channelIds','options','version','mediaId']);
    const {mediaId,...rest}=input;input={...rest,media:mediaId?await socialMedia.prepare(mediaId,s.access):null};
   }else if(route.endsWith('/approve')){
    ensureKeys(input,['version','action','scheduledAt','confirmed']);
    if(input.confirmed!==true)fail(400,'Confirmez les comptes et le moment de publication.');delete input.confirmed;
    const record=await request(route.replace(/\/approve$/,''),token);
    if(record.version!==input.version)fail(409,'Le brouillon a changé. Rechargez sa dernière version.');
    const due=input.action==='SCHEDULE'?Date.parse(input.scheduledAt):Date.now();
    if(!Number.isFinite(due)||due>Date.now()+90*86400000||due<Date.now()-60000)fail(400,'La programmation doit être comprise dans les 90 prochains jours.');
    input={...input,media:record.media?.id?await socialMedia.prepare(record.media.id,s.access,due):null};
   }else if(/\/oauth\/(meta|youtube|x)\/start$/.test(route))input={redirectUri:origin+'/social-callback.html'};
   else if(route.endsWith('/oauth/complete'))ensureKeys(input,['state','code']);
   else if(route.endsWith('/confirm'))ensureKeys(input,['channelKeys']);
   else if(route.endsWith('/cancel'))ensureKeys(input,['version']);
   else ensureKeys(input,[]);
  }
  const query=new URLSearchParams();if(get)for(const key of ['month','cursor'])if(url.searchParams.has(key))query.set(key,url.searchParams.get(key));
  send(res,await request(route+(query.size?'?'+query:''),token,req.method,input));return true;
 }
 return {handle,ready};
}
