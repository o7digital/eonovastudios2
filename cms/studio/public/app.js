const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const plain = value => String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const symbols = {
  home:'<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/>',
  hero:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 9v11"/>',
  motion:'<path d="m9 5 11 7-11 7z"/><path d="M4 6v12"/>',
  studio:'<path d="m12 3 9 5v9l-9 5-9-5V8zM3 8l9 5 9-5M12 13v9"/>',
  services:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V3h8v4M3 12h18M10 12v3h4v-3"/>',
  footer:'<path d="M4 4h16M4 20h16M8 4v16M16 4v16M4 15h16"/>',
  interface:'<path d="M4 5h16M4 12h16M4 19h16M8 3v4M16 10v4M10 17v4"/>',
  media:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m4 18 5-6 4 4 3-6 5 7"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${symbols[name] || symbols.home}</svg>`;
const sections = [
  {id:'hero',name:'Accueil',number:'01',word:'IDEAS.',description:'L’entrée dans votre univers.',detail:'Titre, introduction et premiers mots du site.',anchor:'inicio'},
  {id:'motion',name:'Motion Lab',number:'02',word:'MOTION.',description:'Vos explorations en mouvement.',detail:'Disciplines, études et légendes du laboratoire.',anchor:'universos'},
  {id:'studio',name:'Le studio',number:'03',word:'STUDIO.',description:'L’histoire derrière les idées.',detail:'Présentation du studio et de ses disciplines.',anchor:'studio'},
  {id:'services',name:'Services & contact',number:'04',word:'CREATE.',description:'Vos savoir-faire, votre signature.',detail:'Services, processus et invitation à vous contacter.',anchor:'servicios'},
  {id:'footer',name:'Pied de page',number:'05',word:'NEXT.',description:'Le prochain frame vous attend.',detail:'Signature et derniers mots du site.',anchor:'contacto'},
  {id:'interface',name:'Langues & interface',number:'06',word:'HELLO.',description:'Les détails qui font le lien.',detail:'Navigation, commandes et textes partagés.',anchor:'inicio'},
];
const languages = {es:{name:'Español',label:'ES'},en:{name:'English',label:'EN'},fr:{name:'Français',label:'FR'}};
const placementLabels = {hero:'Accueil · grand visuel',studio:'Le studio',graphic:'Design graphique',digital:'Design digital'};
const statusLabel = {published:'À inclure dans le site',draft:'Brouillon',archived:'Archivé'};
const state = {texts:[],media:[],drafts:new Map(),route:'overview',lang:'es',filter:'',busy:false,profile:{},publishReady:false,canEdit:false,mediaEdit:null};
let toastTimer, previewBlob;
function toast(message, error = false) { const node=$('#toast');node.textContent=message;node.classList.toggle('error',error);node.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.hidden=true,error?8500:4500); }
async function api(path, options = {}) {
  const response=await fetch(path,{credentials:'same-origin',...options,headers:{...(options.body && !(options.body instanceof Blob)?{'Content-Type':'application/json'}:{}),...options.headers}});
  const result=await response.json();
  if(!response.ok){if(response.status===401 && path!=='/api/login')showLogin();throw new Error(result.error || 'Cette action n’a pas abouti.');}
  return result;
}
function showLogin(){ $('#login-view').hidden=false;$('#studio-view').hidden=true;state.drafts.clear();state.profile={};state.texts=[];state.media=[];$('#password').value=''; }
function nav(){
  const links=[{id:'overview',name:'Vue d’ensemble',icon:'home'},...sections.map(s=>({...s,icon:s.id})),{id:'media',name:'Images du site',icon:'media'}];
  $('#main-nav').innerHTML=links.map(s=>`${s.id==='media'?'<div class="nav-separator"></div>':''}<a class="nav-item ${state.route===s.id?'active':''}" href="#${s.id}" ${state.route===s.id?'aria-current="page"':''}>${icon(s.icon)}<span>${s.name}</span>${s.id==='overview'?'':`<small class="nav-count">${s.id==='media'?state.media.filter(row=>row.status==='published').length:state.texts.filter(row=>row.section===s.id).length}</small>`}</a>`).join('');
}
function pageHeading(eyebrow,title,description,actions=''){
  return `<div class="page-heading"><div><span class="eyebrow">${eyebrow}</span><h1>${title}</h1><p>${description}</p></div>${actions?`<div class="heading-actions">${actions}</div>`:''}</div>`;
}
function viewLinks(anchor){return `<a class="button secondary" href="https://www.eonovastudios.com/${state.lang==='es'?'':state.lang+'/'}#${anchor}" target="_blank" rel="noopener">Voir la rubrique <span>↗</span></a>`;}
function publicationCard(){return `<article class="publication-card"><span class="eyebrow">LE PROCHAIN CHAPITRE</span><div class="publication-state"><span class="state-icon">↗</span><h3>${state.publishReady?'Donnez vie aux changements.':'Votre contenu, à votre rythme.'}</h3></div><p>${state.publishReady?'Enregistrez vos changements, puis publiez la nouvelle version de votre site.':'Modifiez et enregistrez vos contenus dès maintenant. La publication automatique sera connectée plus tard.'}</p><button class="button ${state.publishReady?'primary':'secondary'}" data-publish ${!state.publishReady?'disabled':''}>${state.publishReady?'Publier mon site':'Publication à connecter'} <span>↗</span></button><p class="small-note">Les modifications enregistrées restent dans votre espace.</p></article>`;}
function overview(){
  const published=state.texts.filter(row=>row.status==='published').length;
  const drafts=state.texts.filter(row=>row.status==='draft').length;
  return pageHeading('VUE D’ENSEMBLE / EON NOVA','Votre imagination. Votre Studio.','Tout ce qui fait vivre votre site, réuni dans un espace à vous.')+
    `<div class="welcome-grid"><article class="welcome-card"><span class="eyebrow">BIENVENUE DANS VOTRE UNIVERS</span><h2>De l’idée<br>au prochain <em>frame.</em></h2><p>Vos textes et vos images donnent le ton.<br>À vous de faire évoluer l’histoire.</p><a class="text-link" href="#hero">Commencer par l’accueil ↗</a><span class="welcome-star" aria-hidden="true">✳</span></article>${publicationCard()}</div>`+
    `<div class="stats-grid">${[[published,'01 / TEXTES ACTIFS','Les mots de votre univers'],[state.media.filter(row=>row.status==='published').length,'02 / IMAGES DU SITE','Vos visuels personnalisés'],[3,'03 / LANGUES','Español · English · Français'],[drafts,'04 / BROUILLONS','Les idées en préparation']].map(([value,label,detail])=>`<article class="stat-card"><span class="stat-label">${label}</span><div class="stat-value">${value}</div><p class="stat-detail">${detail}</p></article>`).join('')}</div>`+
    `${state.drafts.size?`<div class="editor-intro">${icon('info')}<span>${state.drafts.size} texte(s) modifié(s) attendent d’être enregistrés. Vos saisies restent disponibles dans leurs rubriques.</span></div>`:''}`+
    `<div class="section-title"><h2>Votre site, rubrique par rubrique.</h2><span>06 ESPACES À EXPLORER</span></div><div class="section-grid">${sections.map(s=>`<a class="section-card" href="#${s.id}"><div class="section-art art-${s.id}"><span class="art-number">${s.number} / EON NOVA</span><span class="art-word">${s.word}</span></div><div class="section-card-copy"><div class="section-card-top"><h3>${s.name}</h3><span>↗</span></div><p>${s.description}</p><div class="card-meta"><span>${state.texts.filter(row=>row.section===s.id).length} textes</span><i class="dot"></i><span>3 langues</span><i class="dot"></i><span>Modifier ↗</span></div></div></a>`).join('')}</div>`+
    `<div class="quick-links"><div><strong>Une image peut tout changer.</strong><p>Personnalisez les visuels de votre site, à votre façon.</p></div><a href="#media"><strong>Ouvrir la médiathèque</strong><span>↗</span></a></div>`;
}
function currentRows(){return state.texts.filter(row=>row.section===state.route);}
function values(row){return {...row,...state.drafts.get(row.id)};}
function editableCard(row){
  const data=values(row),title=plain(row.label || row.source),long=row.source.length>160;
  return `<article class="text-card ${long?'long':''} ${state.drafts.has(row.id)?'changed':''}" data-card="${row.id}"><div class="field-head"><label class="field-label" for="text-${row.id}">${esc(title)}</label><span class="field-status ${esc(data.status)}" data-badge="${row.id}">${data.status==='published'?'Prêt pour le site':data.status==='draft'?'Brouillon':'Archivé'}</span></div>${state.lang!=='es'?`<p class="source-hint">Español · ${esc(plain(data.es))}</p>`:''}<textarea id="text-${row.id}" data-text="${row.id}" rows="${long?5:3}" ${!state.canEdit?'readonly':''} lang="${state.lang}" spellcheck="true">${esc(data[state.lang])}</textarea><div class="field-foot"><span><i class="editable-dot"></i>${state.canEdit?'Modifiable':'Lecture seule'} · ${languages[state.lang].name}</span><select aria-label="Visibilité : ${esc(title.slice(0,90))}" data-status="${row.id}" ${!state.canEdit?'disabled':''}>${Object.entries(statusLabel).map(([value,label])=>`<option value="${value}" ${value===data.status?'selected':''}>${label}</option>`).join('')}</select></div></article>`;
}
function saveBar(){return `<div class="editor-savebar"><div><strong id="save-summary">${pendingSummary()}</strong><small>Enregistrer conserve vos textes. La publication du site est une étape distincte.</small></div><div class="savebar-actions"><button class="button secondary" data-revert ${!sectionDirty()?'disabled':''}>Annuler les modifications</button><button class="button primary" data-save ${!sectionDirty()||!state.canEdit?'disabled':''}>Enregistrer la rubrique <span>↗</span></button></div></div>`;}
function sectionDirty(){return currentRows().filter(row=>state.drafts.has(row.id)).length;}
function pendingSummary(){const n=sectionDirty();return n?`${n} texte${n>1?'s':''} à enregistrer`:'Tous vos textes sont enregistrés';}
function editor(){
  const section=sections.find(s=>s.id===state.route);
  return pageHeading(`${section.number} / VOTRE SITE`,section.name,section.detail,viewLinks(section.anchor))+
    `<div class="editor-intro">${icon('info')}<span>Choisissez une langue et modifiez vos textes. Les champs verts sont éditables. Les balises <strong>&lt;br&gt;</strong> et <strong>&lt;em&gt;</strong> conservent les retours à la ligne et les accents du site.</span></div>`+
    `<div class="editor-toolbar"><div class="language-tabs" role="group" aria-label="Langue d’édition">${Object.entries(languages).map(([key,value])=>`<button class="language-tab ${state.lang===key?'active':''}" data-language="${key}" aria-pressed="${state.lang===key}">${value.name}<small>${value.label}</small></button>`).join('')}</div><label class="sr-only" for="text-search">Rechercher un texte</label><input id="text-search" class="search-box" type="search" placeholder="Rechercher dans cette rubrique…" value="${esc(state.filter)}"></div>`+
    `<div class="field-list">${currentRows().map(editableCard).join('')}</div><p id="search-empty" class="muted" hidden>Aucun texte ne correspond à votre recherche.</p>${saveBar()}`;
}
function mediaPage(){return pageHeading('VOTRE UNIVERS VISUEL','Les images donnent le ton.','Personnalisez les quatre emplacements du site. Les visuels animés d’origine restent disponibles.')+
  `<div class="editor-intro">${icon('info')}<span>Chaque emplacement accueille une image. Les fichiers sont conservés dans votre médiathèque et deviennent visibles sur le site après publication.</span></div>`+
  `<div class="media-grid">${Object.entries(placementLabels).map(([placement,label],index)=>{
    const row=state.media.find(row=>row.placement===placement),shown=row && row.status==='published';
    return `<article class="media-card"><div class="media-visual">${row?.image?.id?`<img src="/api/image/${row.image.id}" alt="${esc(row.alt_fr)}" loading="lazy">`:'<span class="media-default">✳</span>'}${!shown?'<span class="original-label">LE VISUEL D’ORIGINE RESTE ACTIF</span>':''}</div><div class="media-card-body"><div class="media-card-heading"><h3>${label}</h3><span class="eyebrow">0${index+1}</span></div><p>${row?`${esc(row.image?.filename_download || 'Image')} · ${esc(statusLabel[row.status] || row.status)}`:'Ajoutez votre visuel, ou conservez l’exploration originale.'}</p><div class="media-card-actions"><button class="button ${row?'secondary':'primary'}" data-edit-media="${placement}" ${!state.canEdit?'disabled':''}>${row?'Modifier le visuel':'Ajouter une image'} <span>↗</span></button>${row && row.status!=='archived'?`<button class="button secondary" data-archive-media="${row.id}" ${!state.canEdit?'disabled':''}>Retrouver l’original</button>`:''}</div></div></article>`;
  }).join('')}</div>`;
}
function render(){
  nav();$('#breadcrumb').textContent=state.route==='overview'?'Vue d’ensemble':state.route==='media'?'Images du site':sections.find(s=>s.id===state.route).name;
  $('#content').innerHTML=state.route==='overview'?overview():state.route==='media'?mediaPage():editor();
  $('#content').querySelectorAll('[data-publish]').forEach(button=>button.addEventListener('click',publish));
  $('#content').querySelectorAll('[data-language]').forEach(button=>button.addEventListener('click',()=>{state.lang=button.dataset.language;render();}));
  $('#content').querySelectorAll('[data-text]').forEach(input=>input.addEventListener('input',()=>{recordDraft(input.dataset.text,state.lang,input.value);updatePending();}));
  $('#content').querySelectorAll('[data-status]').forEach(input=>input.addEventListener('change',()=>{recordDraft(input.dataset.status,'status',input.value);updatePending();}));
  $('#content').querySelector('[data-save]')?.addEventListener('click',saveTexts);
  $('#content').querySelector('[data-revert]')?.addEventListener('click',async()=>{if(await confirmDialog('Annuler les modifications ?','Les textes enregistrés seront conservés. Seules les saisies de cette rubrique seront retirées.')){for(const row of currentRows())state.drafts.delete(row.id);render();}});
  $('#text-search')?.addEventListener('input',event=>{state.filter=event.target.value;filterCards();});
  $('#content').querySelectorAll('[data-edit-media]').forEach(button=>button.addEventListener('click',()=>openMedia(button.dataset.editMedia)));
  $('#content').querySelectorAll('[data-archive-media]').forEach(button=>button.addEventListener('click',()=>archiveMedia(button.dataset.archiveMedia)));
  filterCards();
}
function recordDraft(id,field,value){
  const original=state.texts.find(row=>row.id===id),draft={...state.drafts.get(id),[field]:value};
  for(const key of Object.keys(draft))if(draft[key]===original[key])delete draft[key];
  if(Object.keys(draft).length)state.drafts.set(id,draft);else state.drafts.delete(id);
}
function updatePending(){
  $('#save-summary').textContent=pendingSummary();
  $('[data-save]').disabled=!sectionDirty()||state.busy||!state.canEdit;$('[data-revert]').disabled=!sectionDirty()||state.busy;
  for(const row of currentRows()){
    const data=values(row);$(`[data-card="${row.id}"]`)?.classList.toggle('changed',state.drafts.has(row.id));
    const badge=$(`[data-badge="${row.id}"]`);if(badge){badge.className='field-status '+data.status;badge.textContent=data.status==='published'?'Prêt pour le site':data.status==='draft'?'Brouillon':'Archivé';}
  }
}
function filterCards(){if(!$('#text-search'))return;let count=0;for(const row of currentRows()){const match=(plain(row.label)+' '+plain(values(row)[state.lang])).toLocaleLowerCase().includes(state.filter.toLocaleLowerCase());$(`[data-card="${row.id}"]`).hidden=!match;if(match)count++;}$('#search-empty').hidden=count>0;}
async function saveTexts(){
  if(state.busy)return;
  const items=currentRows().filter(row=>state.drafts.has(row.id)).map(row=>({id:row.id,...state.drafts.get(row.id)}));
  if(!items.length)return;
  if(items.some(row=>Object.keys(languages).some(lang=>row[lang]!==undefined&&!row[lang].trim())))return toast('Conservez un texte dans chaque langue.',true);
  state.busy=true;updatePending();const button=$('[data-save]');button.textContent='Enregistrement…';
  try{
    const rows=await api('/api/texts',{method:'PATCH',body:JSON.stringify({items})});
    for(const row of rows){const index=state.texts.findIndex(item=>item.id===row.id);state.texts[index]=row;state.drafts.delete(row.id);}
    toast('Votre rubrique est enregistrée.');
  }catch(error){toast(error.message,true);}finally{state.busy=false;render();}
}
async function load(){
  const data=await api('/api/bootstrap');Object.assign(state,data);
  const actualName=data.profile.name && data.profile.name!=='Admin User'?data.profile.name:'Mon Studio';
  $('#user-name').textContent=actualName;$('#user-email').textContent=data.profile.email;$('#user-avatar').textContent=(actualName[0]||'E').toUpperCase();
  $('#login-view').hidden=true;$('#studio-view').hidden=false;route();
}
function route(){
  const hash=location.hash.slice(1),allowed=['overview','media',...sections.map(s=>s.id)];state.route=allowed.includes(hash)?hash:'overview';state.filter='';closeMenu();render();
}
function openMenu(){ $('#sidebar').classList.add('open');$('#sidebar-shade').hidden=false;$('#menu-toggle').setAttribute('aria-expanded','true'); }
function closeMenu(){ $('#sidebar').classList.remove('open');$('#sidebar-shade').hidden=true;$('#menu-toggle').setAttribute('aria-expanded','false'); }
function confirmDialog(title,message){
  const dialog=$('#confirm-dialog');$('#confirm-title').textContent=title;$('#confirm-message').textContent=message;dialog.showModal();
  return new Promise(resolve=>{
    const yes=()=>finish(true),no=()=>finish(false),cancel=event=>{event.preventDefault();finish(false);};
    function finish(value){$('#confirm-yes').removeEventListener('click',yes);$('#confirm-no').removeEventListener('click',no);dialog.removeEventListener('cancel',cancel);dialog.close();resolve(value);}
    $('#confirm-yes').addEventListener('click',yes);$('#confirm-no').addEventListener('click',no);dialog.addEventListener('cancel',cancel);
  });
}
async function publish(){
  if(!state.publishReady)return;
  if(state.drafts.size)return toast('Enregistrez d’abord vos textes modifiés.',true);
  if(!await confirmDialog('Publier les changements ?','La nouvelle version de votre site sera générée avec les textes et images prêts pour le site.'))return;
  try{const result=await api('/api/publish',{method:'POST',body:'{}'});toast(result.message);}catch(error){toast(error.message,true);}
}
function openMedia(placement){
  const row=state.media.find(row=>row.placement===placement);
  state.mediaEdit={id:row?.id,fileId:row?.image?.id,placement};
  $('#media-dialog-title').textContent=row?'Modifier le visuel':'Ajouter une image';$('#media-form').reset();$('#media-placement').value=placement;$('#media-placement').disabled=Boolean(row);
  for(const lang of Object.keys(languages))$(`#alt-${lang}`).value=row?.[`alt_${lang}`] || '';
  $('#media-status').value=row?.status==='archived'?'published':row?.status || 'published';
  $('#upload-label').textContent=row?.image?.filename_download || 'Choisir une image';$('#media-error').hidden=true;$('#media-preview').hidden=!row?.image?.id;
  if(row?.image?.id)$('#media-preview').src='/api/image/'+row.image.id;
  for(const option of $('#media-placement').options)option.disabled=option.value!==placement&&state.media.some(row=>row.placement===option.value);
  $('#media-dialog').showModal();
}
function closeMedia(){if($('#save-media').disabled)return;$('#media-dialog').close();state.mediaEdit=null;if(previewBlob){URL.revokeObjectURL(previewBlob);previewBlob=null;}}
$('#media-file').addEventListener('change',()=>{
  const file=$('#media-file').files[0];if(!file)return;
  $('#upload-label').textContent=file.name;if(previewBlob)URL.revokeObjectURL(previewBlob);previewBlob=URL.createObjectURL(file);$('#media-preview').src=previewBlob;$('#media-preview').hidden=false;
  state.mediaEdit.fileId=null;
});
$('#media-form').addEventListener('submit',async event=>{
  event.preventDefault();const button=$('#save-media'),edit=state.mediaEdit,file=$('#media-file').files[0];if(!edit)return;
  if(!edit.fileId&&!file){$('#media-error').textContent='Choisissez une image.';$('#media-error').hidden=false;return;}
  if(file&&(!['image/jpeg','image/png','image/webp','image/avif','image/gif'].includes(file.type)||file.size>25*1024*1024)){ $('#media-error').textContent='Choisissez une image compatible de 25 Mo maximum.';$('#media-error').hidden=false;return; }
  button.disabled=true;button.textContent='Enregistrement…';$('#media-error').hidden=true;
  try{
    if(file&&!edit.fileId){const uploaded=await api('/api/upload',{method:'POST',body:file,headers:{'Content-Type':file.type,'X-File-Name':encodeURIComponent(file.name)}});edit.fileId=uploaded.id;}
    const input={placement:$('#media-placement').value,image:edit.fileId,status:$('#media-status').value,...Object.fromEntries(Object.keys(languages).map(lang=>['alt_'+lang,$('#alt-'+lang).value.trim()]))};
    const result=await api('/api/media'+(edit.id?'/'+edit.id:''),{method:edit.id?'PATCH':'POST',body:JSON.stringify(input)});
    state.media=state.media.filter(row=>row.id!==result.id);state.media.push(result);button.disabled=false;closeMedia();render();toast('Votre image est enregistrée.');
  }catch(error){$('#media-error').textContent=error.message;$('#media-error').hidden=false;}finally{button.disabled=false;button.innerHTML='Enregistrer l’image <span>↗</span>';}
});
async function archiveMedia(id){
  if(!await confirmDialog('Retrouver le visuel d’origine ?','L’image reste dans votre médiathèque. Au prochain déploiement, le site utilisera son visuel original.'))return;
  try{const row=await api('/api/media/'+id,{method:'PATCH',body:JSON.stringify({status:'archived'})});state.media=state.media.map(item=>item.id===id?row:item);render();toast('Le visuel d’origine sera rétabli au prochain déploiement.');}catch(error){toast(error.message,true);}
}
$('#close-media').addEventListener('click',closeMedia);$('#cancel-media').addEventListener('click',closeMedia);
$('#media-dialog').addEventListener('cancel',event=>{event.preventDefault();closeMedia();});
$('#menu-toggle').addEventListener('click',()=>$('#sidebar').classList.contains('open')?closeMenu():openMenu());$('#sidebar-shade').addEventListener('click',closeMenu);
$('#main-nav').addEventListener('click',event=>{if(event.target.closest('a'))closeMenu();});
window.addEventListener('keydown',event=>{if(event.key==='Escape')closeMenu();});
window.addEventListener('hashchange',()=>{if(!$('#studio-view').hidden)route();});
window.addEventListener('beforeunload',event=>{if(state.drafts.size){event.preventDefault();event.returnValue='';}});
$('#show-password').addEventListener('click',()=>{const password=$('#password'),visible=password.type==='password';password.type=visible?'text':'password';$('#show-password').textContent=visible?'Masquer':'Voir';$('#show-password').setAttribute('aria-label',visible?'Masquer le mot de passe':'Afficher le mot de passe');});
$('#login-form').addEventListener('submit',async event=>{
  event.preventDefault();const button=event.target.querySelector('[type="submit"]');button.disabled=true;button.textContent='Ouverture de votre Studio…';$('#login-error').hidden=true;
  try{await api('/api/login',{method:'POST',body:JSON.stringify({email:$('#email').value.trim(),password:$('#password').value})});$('#password').value='';await load();}
  catch(error){$('#login-error').textContent=error.message;$('#login-error').hidden=false;}finally{button.disabled=false;button.innerHTML='Entrer dans mon Studio <span>↗</span>';}
});
$('#logout').addEventListener('click',async()=>{if(state.drafts.size&&!await confirmDialog('Quitter le Studio ?','Vos saisies non enregistrées seront perdues.'))return;try{await api('/api/logout',{method:'POST',body:'{}'});showLogin();}catch(error){toast(error.message,true);}});
try{await load();}catch(error){showLogin();if(!/Connectez-vous|session/.test(error.message)){ $('#login-error').textContent='Le Studio ne peut pas se reconnecter pour le moment. Vous pouvez réessayer de vous connecter.';$('#login-error').hidden=false; }}
