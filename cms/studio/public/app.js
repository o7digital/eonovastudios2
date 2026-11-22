import {visualPageMarkup,mountVisualPage} from './visual-page.js?v=journal-1';
import {logoSize,logoImageUrl,prepareLogoPreview} from './logo.js?v=brand-4';
import {mediaAlt,mediaLabels} from './media-copy.js?v=studio-2';
import {mountEditors} from './editor.js?v=color-1';
import {colorToolsMarkup} from './text-color.js?v=color-1';
import {createSocialLinksUI} from './social-links-ui.js?v=social-links-1';
import {createJournalUI} from './journal-ui.js?v=journal-1';
import {journalDefinitions} from './journal-data.js?v=journal-1';
import {createWorkspaceUI,workspaceSections} from './workspace-ui.js?v=es-mx-1';
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
  {id:'hero',name:'Inicio',number:'01',word:'IDEAS.',description:'La entrada a tu universo.',detail:'Título, introducción y primeras palabras del sitio.',anchor:'inicio'},
  {id:'motion',name:'Motion Lab',number:'02',word:'MOTION.',description:'Tus exploraciones en movimiento.',detail:'Disciplinas, estudios y descripciones del laboratorio.',anchor:'universos'},
  {id:'studio',name:'El estudio',number:'03',word:'STUDIO.',description:'La historia detrás de las ideas.',detail:'Presentación del estudio y sus disciplinas.',anchor:'studio'},
  {id:'services',name:'Servicios y contacto',number:'04',word:'CREATE.',description:'Tu experiencia, tu sello.',detail:'Servicios, proceso e invitación a contactarte.',anchor:'servicios'},
  {id:'footer',name:'Pie de página',number:'05',word:'NEXT.',description:'Tu próximo frame te espera.',detail:'Firma y últimas palabras del sitio.',anchor:'contacto'},
  {id:'interface',name:'Idiomas e interfaz',number:'06',word:'HELLO.',description:'Los detalles que conectan.',detail:'Navegación, controles y textos compartidos.',anchor:'inicio'},
];
const languages = {es:{name:'Español',label:'ES'},en:{name:'Inglés',label:'EN'},fr:{name:'Francés',label:'FR'}};
const placementLabels = {logo:'Mi logo · encabezado y pie',hero:'Inicio · imagen o video principal',studio:'El estudio',graphic:'Diseño gráfico',digital:'Diseño digital'};
const statusLabel = {published:'Incluir en el sitio',draft:'Borrador',archived:'Archivado'};
const state = {texts:[],media:[],drafts:new Map(),route:'overview',lang:'es',filter:'',busy:false,profile:{},publishReady:false,canEdit:false,mediaEdit:null,mediaDrafts:new Map(),mediaUploading:false,visualPrefs:{width:1440,mode:'edit'}};
const workspace=createWorkspaceUI({api,toast,confirmDialog,isCurrent:route=>state.route===route});
const journalUI=createJournalUI({api,upload:uploadMedia,canEdit:()=>state.canEdit,canPublish:()=>state.publishReady&&!allDirty(),onPublish:publish,isCurrent:route=>state.route===route&&!$('#studio-view').hidden,toast,confirmDialog});
const socialLinksUI=createSocialLinksUI({api,canEdit:()=>state.canEdit,canPublish:()=>state.publishReady&&!allDirty(),onPublish:publish,isCurrent:()=>state.route==='social-links'&&!$('#studio-view').hidden,toast});
let toastTimer, previewBlob,visualUI,disposeFieldEditors;
let studioLogoKey='',studioLogoVersion=0;
function setBrandImage(image,src,custom){
  image.closest('.wordmark').toggleAttribute('data-custom-logo',custom);
  if(image.getAttribute('src')!==src)image.src=src;
}
async function syncPublishedLogo(){
  try{const {logo}=await api('/branding');setBrandImage($('#login-view [data-studio-logo]'),logo||'/favicon.svg',Boolean(logo));}catch{}
}
async function syncStudioLogo(){
  $('#edit-studio-logo').disabled=!state.canEdit||state.busy||state.mediaUploading;
  const row=mediaOf('logo'),image=$('#sidebar [data-studio-logo]'),active=row?.status==='published'&&row.image?.id;
  const source=active?logoImageUrl(row.image):'/favicon.svg';if(source===studioLogoKey)return;
  studioLogoKey=source;const version=++studioLogoVersion;
  if(!active){setBrandImage(image,source,false);return;}
  try{const logo=await prepareLogoPreview(location.origin+source);if(version===studioLogoVersion)setBrandImage(image,logo.src,true);}
  catch{if(version===studioLogoVersion){studioLogoKey='';setBrandImage(image,'/favicon.svg',false);}}
}
function toast(message, error = false) { const node=$('#toast');node.textContent=message;node.classList.toggle('error',error);node.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.hidden=true,error?8500:4500); }
async function api(path, options = {}) {
  const response=await fetch(path,{credentials:'same-origin',...options,headers:{...(options.body && !(options.body instanceof Blob)?{'Content-Type':'application/json'}:{}),...options.headers}});
  const result=await response.json();
  if(!response.ok){if(response.status===401 && path!=='/api/login')showLogin();throw new Error(result.error || 'No se pudo completar esta acción.');}
  return result;
}
function showLogin(){ disposeFieldEditors?.();$('#login-view').hidden=false;$('#studio-view').hidden=true;state.drafts.clear();state.mediaDrafts.clear();visualUI?.destroy();visualUI=null;workspace.reset();journalUI.reset();socialLinksUI.reset();state.profile={};state.texts=[];state.media=[];studioLogoKey='';studioLogoVersion++;$('#password').value='';syncPublishedLogo(); }
function nav(){
  const links=[{id:'overview',name:'Vista general',icon:'home'},{id:'visual',name:'Editar mi página',icon:'hero'},...sections.map(s=>({...s,icon:s.id})),...journalDefinitions.map(d=>({id:'journal-'+d.id,name:d.labels.es,icon:'media'})),{id:'social-links',name:'Enlaces de redes',icon:'interface'},{id:'media',name:'Fotos, videos y logo',icon:'media'},{id:'account',name:'Mi cuenta',icon:'interface'}];
  $('#main-nav').innerHTML=links.map(s=>`${s.id==='media'?'<div class="nav-separator"></div>':''}<a class="nav-item ${state.route===s.id?'active':''}" href="#${s.id}" ${state.route===s.id?'aria-current="page"':''}>${icon(s.icon)}<span>${s.name}</span>${(['overview','account','social-links'].includes(s.id)||s.id.startsWith('journal-'))?'':`<small class="nav-count">${s.id==='visual'?state.texts.length:s.id==='media'?state.media.filter(row=>row.status==='published').length:state.texts.filter(row=>row.section===s.id).length}</small>`}</a>`).join('');
  $('#main-nav').insertAdjacentHTML('beforeend','<div class="nav-separator"></div><div class="nav-heading suite-nav-heading">DALE VIDA AL STUDIO</div>'+workspaceSections.map(s=>`<a class="nav-item ${state.route===s.id?'active':''}" href="#${s.id}" ${state.route===s.id?'aria-current="page"':''}><span class="nav-glyph" aria-hidden="true">${s.glyph}</span><span>${s.name}</span></a>`).join(''));
}
function pageHeading(eyebrow,title,description,actions=''){
  return `<div class="page-heading"><div><span class="eyebrow">${eyebrow}</span><h1>${title}</h1><p>${description}</p></div>${actions?`<div class="heading-actions">${actions}</div>`:''}</div>`;
}
function viewLinks(anchor){return `<a class="button secondary" href="https://www.eonovastudios.com/${state.lang==='es'?'':state.lang+'/'}#${anchor}" target="_blank" rel="noopener">Ver sección <span>↗</span></a>`;}
function publicationCard(){return `<article class="publication-card"><span class="eyebrow">EL PRÓXIMO CAPÍTULO</span><div class="publication-state"><span class="state-icon">↗</span><h3>${state.publishReady?'Dale vida a tus cambios.':'Tu contenido, a tu ritmo.'}</h3></div><p>${state.publishReady?'Guarda tus cambios y publica la nueva versión de tu sitio.':'Edita y guarda tu contenido desde ahora. La publicación automática se conectará más adelante.'}</p><button class="button ${state.publishReady?'primary':'secondary'}" data-publish ${!state.publishReady?'disabled':''}>${state.publishReady?'Publicar mi sitio':'Publicación pendiente de conexión'} <span>↗</span></button><p class="small-note">Los cambios guardados permanecen en tu espacio.</p></article>`;}
function overview(){
  const published=state.texts.filter(row=>row.status==='published').length;
  const drafts=state.texts.filter(row=>row.status==='draft').length;
  return pageHeading('VISTA GENERAL / EON NOVA','Tu imaginación. Tu Studio.','Todo lo que le da vida a tu sitio, reunido en tu propio espacio.')+
    `<div class="welcome-grid"><article class="welcome-card"><span class="eyebrow">BIENVENIDO A TU UNIVERSO</span><h2>De la idea<br>al próximo <em>frame.</em></h2><p>Tus textos, fotos y videos marcan el tono.<br>Escribe el próximo capítulo.</p><a class="text-link" href="#visual">Editar mi página</a><span class="welcome-star" aria-hidden="true">✳</span></article>${publicationCard()}</div>`+
    `<div class="stats-grid">${[[published,'01 / TEXTOS ACTIVOS','Las palabras de tu universo'],[state.media.filter(row=>row.status==='published').length,'02 / MEDIOS DEL SITIO','Fotos, videos y logo'],[3,'03 / IDIOMAS','Español · Inglés · Francés'],[drafts,'04 / BORRADORES','Las ideas en preparación']].map(([value,label,detail])=>`<article class="stat-card"><span class="stat-label">${label}</span><div class="stat-value">${value}</div><p class="stat-detail">${detail}</p></article>`).join('')}</div>`+
    `${state.drafts.size?`<div class="editor-intro">${icon('info')}<span>${state.drafts.size} texto(s) modificado(s) pendiente(s) de guardar. Tus cambios siguen disponibles en cada sección.</span></div>`:''}`+
    `<div class="section-title"><h2>Tu sitio, sección por sección.</h2><span>06 ESPACIOS POR EXPLORAR</span></div><div class="section-grid">${sections.map(s=>`<a class="section-card" href="#${s.id}"><div class="section-art art-${s.id}"><span class="art-number">${s.number} / EON NOVA</span><span class="art-word">${s.word}</span></div><div class="section-card-copy"><div class="section-card-top"><h3>${s.name}</h3><span>↗</span></div><p>${s.description}</p><div class="card-meta"><span>${state.texts.filter(row=>row.section===s.id).length} textos</span><i class="dot"></i><span>3 idiomas</span><i class="dot"></i><span>Editar ↗</span></div></div></a>`).join('')}</div>`+
    `<div class="quick-links"><div><strong>Una imagen puede cambiarlo todo.</strong><p>Personaliza las imágenes de tu sitio, a tu manera.</p></div><a href="#media"><strong>Abrir biblioteca de medios</strong><span>↗</span></a></div><div class="section-title suite-section-title"><h2>Tu Studio va más allá.</h2></div><div class="suite-launch-grid">${workspaceSections.map(s=>`<a href="#${s.id}" class="suite-launch"><span>${s.glyph}</span><strong>${s.name}</strong><small>Abrir espacio ↗</small></a>`).join('')}</div>`;
}
function currentRows(){return state.route==='visual'?state.texts:state.texts.filter(row=>row.section===state.route);}
function values(row){return {...row,...state.drafts.get(row.id)};}
function mediaOf(placement){return state.mediaDrafts.get(placement)||state.media.find(row=>row.placement===placement);}
function currentPlacements(){return ['visual','media'].includes(state.route)?Object.keys(placementLabels):({hero:['hero'],studio:['studio'],services:['graphic','digital'],footer:['logo'],interface:['logo']}[state.route]||[]);}
function allDirty(){return state.drafts.size+state.mediaDrafts.size+(journalUI.hasUnsaved()?1:0)+(socialLinksUI.hasUnsaved()?1:0);}
function mediaInput(row){return {placement:row.placement,image:row.image.id,status:row.status||'published',fit:row.fit||(row.placement==='logo'?'contain':'cover'),position:row.position||'50% 50%',...(row.placement==='logo'?{logo_size:logoSize(row.logo_size)}:{}),...Object.fromEntries(Object.keys(languages).map(lang=>['alt_'+lang,mediaAlt(row.placement,lang,row['alt_'+lang])]))};}
function recordMediaDraft(placement,fields){
 const original=state.media.find(row=>row.placement===placement),row={placement,status:'published',...mediaOf(placement),...fields};
 if(original&&JSON.stringify(mediaInput(row))===JSON.stringify(mediaInput(original)))state.mediaDrafts.delete(placement);else state.mediaDrafts.set(placement,row);updatePending();
}
async function stageVisualPhoto(placement,file,onProgress){
 const imageTypes=['image/jpeg','image/png','image/webp','image/avif','image/gif'];
 if(!(placement==='logo'?imageTypes:[...imageTypes,'video/mp4','video/webm']).includes(file.type))throw Error(placement==='logo'?'Selecciona una imagen JPG, PNG, WebP, AVIF o GIF.':'Selecciona una foto o un video MP4/WebM.');
 if(!file.size||file.size>(file.type.startsWith('video/')?100:25)*1024*1024)throw Error('Máximo: fotos 25 MB, videos 100 MB.');
 state.mediaUploading=true;updatePending();
 try{const uploaded=await uploadMedia(file,onProgress);recordMediaDraft(placement,{image:{id:uploaded.id,type:uploaded.type,filename_download:uploaded.name},status:'published'});}
 finally{state.mediaUploading=false;updatePending();}
}
function editableCard(row){
  const data=values(row),title=plain(row.label || row.source),long=row.source.length>160;
  return `<article class="text-card ${long?'long':''} ${state.drafts.has(row.id)?'changed':''}" data-card="${row.id}"><div class="field-head"><label id="label-${row.id}" class="field-label" for="text-${row.id}">${esc(title)}</label><span class="field-status ${esc(data.status)}" data-badge="${row.id}">${data.status==='published'?'Listo para el sitio':data.status==='draft'?'Borrador':'Archivado'}</span></div>${state.lang!=='es'?`<p class="source-hint">Español · ${esc(plain(data.es))}</p>`:''}<div class="visual-editor"><div class="rich-toolbar" role="toolbar" aria-label="Formato del texto"><button type="button" data-format="bold" title="Negrita (Ctrl/Cmd+B)" aria-label="Negrita"><strong>B</strong></button><button type="button" data-format="italic" title="Énfasis (Ctrl/Cmd+I)" aria-label="Énfasis"><em>Énfasis</em></button><span class="toolbar-divider"></span><button type="button" data-format="undo" aria-label="Deshacer" title="Deshacer">↶</button><button type="button" data-format="redo" aria-label="Rehacer" title="Rehacer">↷</button><span class="editor-mode">VISTA VISUAL</span></div>${colorToolsMarkup()}<div id="text-${row.id}" class="rich-field ${long?'rich-long':''}" data-rich-text="${row.id}" role="textbox" aria-multiline="true" aria-labelledby="label-${row.id}" lang="${state.lang}" spellcheck="true">${esc(data[state.lang])}</div><div class="rich-bottom"><span>Formato listo para el sitio</span><span class="editor-length"></span></div></div><div class="field-foot"><span><i class="editable-dot"></i>${state.canEdit?'Editable':'Solo lectura'} · ${languages[state.lang].name}</span><select aria-label="Visibilidad: ${esc(title.slice(0,90))}" data-status="${row.id}" ${!state.canEdit?'disabled':''}>${Object.entries(statusLabel).map(([value,label])=>`<option value="${value}" ${value===data.status?'selected':''}>${label}</option>`).join('')}</select></div></article>`;
}
function saveBar(){return `<div class="editor-savebar"><div><strong id="save-summary">${pendingSummary()}</strong><small>Guarda tus cambios y pulsa Publicar mi sitio para actualizar la página pública.</small></div><div class="savebar-actions"><button class="button secondary" data-revert ${!sectionDirty()?'disabled':''}>Descartar cambios</button><button class="button primary" data-save ${!sectionDirty()||!state.canEdit?'disabled':''}>Guardar cambios <span>↗</span></button><button class="button secondary" data-publish ${!state.publishReady||allDirty()||!state.canEdit?'disabled':''}>Publicar mi sitio <span>↗</span></button></div></div>`;}
function sectionDirty(){return currentRows().filter(row=>state.drafts.has(row.id)).length+currentPlacements().filter(placement=>state.mediaDrafts.has(placement)).length;}
function pendingSummary(){const n=sectionDirty();return n?`${n} cambio${n!==1?'s':''} sin guardar`:'Todos tus cambios están guardados';}
function editor(){
  const section=sections.find(s=>s.id===state.route);
  return pageHeading(`${section.number} / MI SITIO`,section.name,'Haz clic en los textos y las imágenes para editarlos sobre el diseño real.',viewLinks(section.anchor))+
    visualPageMarkup(state.lang)+`<details class="studio-text-fields"><summary>Campos de texto y opciones de idioma</summary><div class="editor-toolbar"><label class="sr-only" for="text-search">Buscar texto</label><input id="text-search" class="search-box" type="search" placeholder="Buscar en esta sección…" value="${esc(state.filter)}"></div><div class="field-list">${currentRows().map(editableCard).join('')}</div><p id="search-empty" class="muted" hidden>No hay textos que coincidan con tu búsqueda.</p></details>`;
}
function mediaPage(){return pageHeading('TU UNIVERSO VISUAL','Tu identidad. En cada frame.','Selecciona el archivo y revisa el resultado antes de guardar.')+
  `<div class="editor-intro">${icon('info')}<span>Sube archivos o reutiliza los de tu biblioteca. Ajusta el encuadre sin modificar el original. Imágenes: 25 MB. Videos MP4 y WebM: 100 MB.</span></div>`+
  `<div class="media-grid">${Object.entries(placementLabels).map(([placement,label],index)=>{
    const row=mediaOf(placement),shown=row && row.status==='published';
    return `<article class="media-card"><div class="media-visual">${row?.image?.id?`<${row.image.type?.startsWith("video/")?'video controls preload="metadata"':'img loading="lazy"'} src="${esc(logoImageUrl(row.image))}" alt="${esc(row.alt_es)}">${row.image.type?.startsWith("video/")?'</video>':''}`:'<span class="media-default">✳</span>'}${!shown?'<span class="original-label">DISEÑO ORIGINAL ACTIVO</span>':''}</div><div class="media-card-body"><div class="media-card-heading"><h3>${label}</h3><span class="eyebrow">0${index+1}</span></div><p>${row?`${esc(row.image?.filename_download || 'Image')} · ${esc(statusLabel[row.status] || row.status)}`:'Agrega tu imagen o conserva la creación original.'}</p><div class="media-card-actions"><button class="button ${row?'secondary':'primary'}" data-edit-media="${placement}" ${!state.canEdit?'disabled':''}>${row?'Editar medio':placement==='logo'?'Agregar mi logo':'Agregar foto o video'} <span>↗</span></button>${row && row.status!=='archived'?`<button class="button secondary" data-archive-media="${row.id}" ${!state.canEdit?'disabled':''}>Restaurar original</button>`:''}</div></div></article>`;
  }).join('')}</div>`+saveBar();
}
function visualPage(){return pageHeading('MI SITIO','Editar mi página','Haz clic en un texto, una foto o el logo. Cambia el contenido sobre el diseño real.')+visualPageMarkup(state.lang);}
function accountPage(){
  return pageHeading('MI CUENTA','Tu espacio. Tu acceso.','Administra tu contraseña personal de EON Studio.')+
    `<div class="account-grid"><article class="account-card"><span class="eyebrow">TU PERFIL</span><h2>${esc(state.profile.name)}</h2><p>${esc(state.profile.email)}</p><p class="muted">Esta es tu cuenta personal para administrar EON NOVA.</p></article><section class="account-card"><h2>Cambiar mi contraseña</h2><p>${state.profile.passwordTemporary?'Tu contraseña temporal permite usar todo el Studio. Puedes elegir una contraseña personal cuando lo desees.':'Introduce tu contraseña actual y elige una nueva.'}</p><form id="account-password-form"><label for="account-current-password">Contraseña actual${state.profile.passwordTemporary?' (temporal)':''}</label><input id="account-current-password" type="password" autocomplete="current-password" required maxlength="250"><label for="account-new-password">Nueva contraseña</label><input id="account-new-password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required aria-describedby="account-password-hint"><small id="account-password-hint">Mínimo 12 caracteres. Puedes usar una frase larga.</small><label for="account-confirm-password">Confirmar nueva contraseña</label><input id="account-confirm-password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required><p id="account-password-error" class="form-error" role="alert" hidden></p><button type="submit" class="button primary">Guardar nueva contraseña</button></form></section></div>`;
}
async function changePassword(event){
 event.preventDefault();const form=event.currentTarget,button=form.querySelector('button[type=submit]'),error=$('#account-password-error');error.hidden=true;
 const currentPassword=$('#account-current-password').value,newPassword=$('#account-new-password').value;
 if(newPassword!==$('#account-confirm-password').value){error.textContent='Las dos contraseñas nuevas deben coincidir.';error.hidden=false;return;}
 button.disabled=true;button.textContent='Actualizando contraseña…';
 try{const result=await api('/api/account/password',{method:'POST',body:JSON.stringify({currentPassword,newPassword})});form.reset();if(result.reauthenticate){showLogin();toast(result.message);return;}history.replaceState(null,'','#overview');await load();toast(result.message);}
 catch(issue){error.textContent=issue.message;error.hidden=false;}
 finally{button.disabled=false;button.textContent='Guardar nueva contraseña';}
}
function render(){
  syncStudioLogo();journalUI.unmount();socialLinksUI.unmount();
  disposeFieldEditors?.();visualUI?.destroy();visualUI=null;nav();$('#breadcrumb').textContent=state.route==='social-links'?'Enlaces de redes':state.route==='account'?'Mi cuenta':state.route==='visual'?'Editar mi página':state.route==='overview'?'Vista general':state.route==='media'?'Fotos, videos y logo':(sections.find(s=>s.id===state.route)||workspaceSections.find(s=>s.id===state.route))?.name||journalDefinitions.find(d=>'journal-'+d.id===state.route)?.labels.es;
  if(state.route==='social-links'){socialLinksUI.open();return;}
  if(state.route.startsWith('journal-')){journalUI.open(state.route);return;}
  if(workspaceSections.some(s=>s.id===state.route)){workspace.open(state.route);return;}
  $('#content').innerHTML=state.route==='account'?accountPage():state.route==='visual'?visualPage():state.route==='overview'?overview():state.route==='media'?mediaPage():editor();
  $('#account-password-form')?.addEventListener('submit',changePassword);
  $('#content').querySelectorAll('[data-publish]').forEach(button=>button.addEventListener('click',publish));
  $('#content').querySelectorAll('[data-language]').forEach(button=>button.addEventListener('click',()=>{state.lang=button.dataset.language;render();}));
  disposeFieldEditors=mountEditors($('#content'),{editable:state.canEdit,onChange:(id,value)=>{recordDraft(id,state.lang,value);updatePending();}});
  $('#content').querySelectorAll('[data-status]').forEach(input=>input.addEventListener('change',()=>{recordDraft(input.dataset.status,'status',input.value);updatePending();}));
  if(!$('#content .visual-page'))$('#content').querySelector('[data-save]')?.addEventListener('click',saveTexts);
  $('#content').querySelector('[data-revert]')?.addEventListener('click',async()=>{if(await confirmDialog('¿Descartar los cambios?','Los textos guardados se conservan. Solo se descartan los cambios sin guardar de esta sección.')){for(const row of currentRows())state.drafts.delete(row.id);for(const placement of currentPlacements())state.mediaDrafts.delete(placement);render();}});
  $('#text-search')?.addEventListener('input',event=>{state.filter=event.target.value;filterCards();});
  $('#content').querySelectorAll('[data-edit-media]').forEach(button=>button.addEventListener('click',()=>openMedia(button.dataset.editMedia)));
  $('#content').querySelectorAll('[data-archive-media]').forEach(button=>button.addEventListener('click',()=>archiveMedia(button.dataset.archiveMedia)));
  if($('#content .visual-page'))visualUI=mountVisualPage($('#content .visual-page'),{lang:state.lang,rows:currentRows(),valueOf:values,onText:(id,lang,value)=>{recordDraft(id,lang,value);updatePending();},onMediaOptions:openMedia,onPhoto:stageVisualPhoto,onMediaChange:recordMediaDraft,onSave:saveTexts,canEdit:state.canEdit,mediaOf,placements:currentPlacements(),anchor:sections.find(section=>section.id===state.route)?.anchor,prefs:state.visualPrefs,dirtyCount:sectionDirty,busy:()=>state.busy||state.mediaUploading});
  filterCards();if($('#save-summary'))updatePending();
}
function recordDraft(id,field,value){
  const original=state.texts.find(row=>row.id===id),draft={...state.drafts.get(id),[field]:value};
  for(const key of Object.keys(draft))if(draft[key]===original[key])delete draft[key];
  if(Object.keys(draft).length)state.drafts.set(id,draft);else state.drafts.delete(id);
}
function updatePending(){
  syncStudioLogo();
  const editable=state.canEdit&&!state.busy&&!state.mediaUploading;
  $('#content').querySelectorAll('[data-rich-text]').forEach(field=>field.contentEditable=String(editable));
  const doc=$('#content iframe')?.contentDocument;doc?.querySelectorAll('[data-eon-text]').forEach(field=>field.contentEditable=String(editable));
  $('#content').querySelectorAll('[data-format],[data-status],.text-color-tools input,.text-color-tools button').forEach(field=>field.disabled=!editable);
  if($('#save-summary'))$('#save-summary').textContent=pendingSummary();
  if($('[data-save]'))$('[data-save]').disabled=!sectionDirty()||!editable;if($('[data-revert]'))$('[data-revert]').disabled=!sectionDirty()||state.busy||state.mediaUploading;
  $('#content').querySelectorAll('[data-publish]').forEach(button=>button.disabled=!state.publishReady||allDirty()>0||state.busy||state.mediaUploading||!state.canEdit);
  visualUI?.refresh();
  for(const row of currentRows()){
    const data=values(row);$(`[data-card="${row.id}"]`)?.classList.toggle('changed',state.drafts.has(row.id));
    const badge=$(`[data-badge="${row.id}"]`);if(badge){badge.className='field-status '+data.status;badge.textContent=data.status==='published'?'Listo para el sitio':data.status==='draft'?'Borrador':'Archivado';}
  }
}
function filterCards(){if(!$('#text-search'))return;let count=0;for(const row of currentRows()){const match=(plain(row.label)+' '+plain(values(row)[state.lang])).toLocaleLowerCase().includes(state.filter.toLocaleLowerCase());$(`[data-card="${row.id}"]`).hidden=!match;if(match)count++;}$('#search-empty').hidden=count>0;}
async function saveTexts(){
  if(state.busy||state.mediaUploading)return;
  const items=currentRows().filter(row=>state.drafts.has(row.id)).map(row=>({id:row.id,...state.drafts.get(row.id)}));
  const changedMedia=currentPlacements().filter(placement=>state.mediaDrafts.has(placement)).map(placement=>state.mediaDrafts.get(placement));
  if(!items.length&&!changedMedia.length)return;
  if(items.some(row=>Object.keys(languages).some(lang=>row[lang]!==undefined&&!row[lang].trim())))return toast('Conserva un texto en cada idioma.',true);
  state.busy=true;updatePending();const button=$('[data-save]');button.textContent='Guardando…';
  try{
    const rows=items.length?await api('/api/texts',{method:'PATCH',body:JSON.stringify({items})}):[];
    for(const row of rows){const index=state.texts.findIndex(item=>item.id===row.id);state.texts[index]=row;state.drafts.delete(row.id);}
    for(const draft of changedMedia){const saved=await api('/api/media'+(draft.id?'/'+draft.id:''),{method:draft.id?'PATCH':'POST',body:JSON.stringify(mediaInput(draft))});state.media=state.media.filter(row=>row.id!==saved.id);state.media.push(saved);state.mediaDrafts.delete(draft.placement);}
    toast('Cambios guardados. Publica tu sitio cuando todo esté listo.');
  }catch(error){toast(error.message,true);}finally{state.busy=false;render();}
}
async function load(){
  const data=await api('/api/bootstrap');Object.assign(state,data);
  const actualName=data.profile.name && data.profile.name!=='Admin User'?data.profile.name:'Mi Studio';
  $('#user-name').textContent=actualName;$('#user-email').textContent=data.profile.email;$('#user-avatar').textContent=(actualName[0]||'E').toUpperCase();
  $('#login-view').hidden=true;$('#studio-view').hidden=false;route();
}
function route(){
  const hash=location.hash.slice(1),allowed=['overview','visual','media','account','social-links',...sections.map(s=>s.id),...workspaceSections.map(s=>s.id),...journalDefinitions.map(d=>'journal-'+d.id)];state.route=allowed.includes(hash)?hash:'overview';state.filter='';closeMenu();render();
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
  if(allDirty()||state.mediaUploading)return toast('Primero guarda los cambios de textos e imágenes.',true);
  if(!await confirmDialog('¿Publicar los cambios?','La nueva versión del sitio se generará con los textos e imágenes listos para publicar.'))return;
  try{const result=await api('/api/publish',{method:'POST',body:'{}'});toast(result.message);}catch(error){toast(error.message,true);}
}
function openMedia(placement){
  const row=mediaOf(placement);
  state.mediaEdit={id:row?.id,fileId:row?.image?.id,placement,dirty:false};
  $('#media-dialog-title').textContent=placement==='logo'?'Cambiar mi logo':'Cambiar foto o video';$('#media-dialog-context').textContent=mediaLabels[placement]+' · Elige un archivo, revisa el resultado y guarda.';$('#media-options').open=false;$('#media-form').reset();$('#library-grid').hidden=true;$('#media-placement').value=placement;$('#media-placement').disabled=Boolean(row);
  for(const lang of Object.keys(languages))$(`#alt-${lang}`).value=row?.[`alt_${lang}`] || '';
  $('#media-status').value=row?.status==='archived'?'published':row?.status || 'published';
  $('#upload-label').textContent=row?.image?.filename_download || 'Elegir foto o video';$('#media-error').hidden=true;$('#media-preview').hidden=true;$('#media-image-shell').hidden=true;$('#video-preview').hidden=true;
  $('#logo-size').value=logoSize(row?.logo_size);configureMediaFields();
  if(row?.image?.id)showMediaPreview(logoImageUrl(row.image),row.image.type);
  const [x,y]=(row?.position||'50% 50%').split(' ').map(Number.parseFloat);$('#focal-x').value=x;$('#focal-y').value=y;$('#media-fit').value=placement==='logo'?'contain':row?.fit||'cover';updateFraming();
  $('#media-file').accept=placement==='logo'?'image/jpeg,image/png,image/webp,image/avif,image/gif':'image/jpeg,image/png,image/webp,image/avif,image/gif,video/mp4,video/webm';
  for(const option of $('#media-placement').options)option.disabled=option.value!==placement&&state.media.some(row=>row.placement===option.value);
  $('#media-dialog').showModal();
}
async function closeMedia(){if($('#save-media').disabled)return;if(state.mediaEdit?.dirty&&!await confirmDialog('¿Cerrar sin guardar?','Los cambios de este medio todavía no están guardados.'))return;$('#video-preview').pause();$('#media-dialog').close();state.mediaEdit=null;if(previewBlob){URL.revokeObjectURL(previewBlob);previewBlob=null;}}
function showMediaPreview(src,type){
  const video=type?.startsWith('video/');$('#media-preview').hidden=video;$('#video-preview').hidden=!video;$('#video-preview').pause();
  const preview=$(video?'#video-preview':'#media-preview');preview.src=src;preview.dataset.originalSrc=src;$('#media-image-shell').hidden=video;
  if(!video&&$('#media-placement').value==='logo'){
    const edit=state.mediaEdit;
    prepareLogoPreview(src).then(logo=>{if(state.mediaEdit===edit&&$('#media-placement').value==='logo'&&preview.dataset.originalSrc===src){preview.src=logo.src;updateFraming();}}).catch(()=>{if(state.mediaEdit===edit){$('#media-error').textContent='No se pudo preparar el logo. Intenta con otra imagen.';$('#media-error').hidden=false;}});
  }
}
function configureMediaFields(){
  const logo=$('#media-placement').value==='logo';
  $('#logo-controls').hidden=!logo;$('#media-framing').hidden=logo;$('#media-image-shell').classList.toggle('logo-preview-shell',logo);updateFraming();
}
function updateFraming(){
  const logo=$('#media-placement').value==='logo',preview=$('#media-preview');
  preview.style.height=logo?logoSize($('#logo-size').value)+'px':'';preview.style.width=logo?'auto':'';preview.style.maxWidth=logo?'280px':'';
  $('#logo-size-value').textContent=logoSize($('#logo-size').value)+' px';
  for(const preview of [$('#media-preview'),$('#video-preview')]){preview.style.objectPosition=`${$('#focal-x').value}% ${$('#focal-y').value}%`;preview.style.objectFit=$('#media-fit').value;}
}
for(const id of ['focal-x','focal-y','media-fit','logo-size'])$('#'+id).addEventListener('input',updateFraming);
function uploadMedia(file,button){
  return new Promise((resolve,reject)=>{
    const xhr=new XMLHttpRequest();xhr.open('POST','/api/upload');xhr.setRequestHeader('Content-Type',file.type);xhr.setRequestHeader('X-File-Name',encodeURIComponent(file.name));xhr.timeout=240000;
    xhr.upload.onprogress=event=>{if(event.lengthComputable){const progress=Math.round(event.loaded/event.total*100);if(typeof button==='function')button(progress);else if(button)button.textContent=`Subiendo… ${progress}%`;}};
    xhr.onload=()=>{try{const data=JSON.parse(xhr.responseText);if(xhr.status>=200&&xhr.status<300)resolve(data);else reject(new Error(data.error||'No se pudo subir el archivo.'));}catch{reject(new Error('No se pudo leer la respuesta. Intenta de nuevo.'));}};
    xhr.onerror=()=>reject(new Error('Revisa tu conexión e intenta de nuevo.'));xhr.ontimeout=()=>reject(new Error('La carga tardó demasiado. Intenta con un archivo más pequeño.'));xhr.send(file);
  });
}
$('#media-placement').addEventListener('change',()=>{configureMediaFields();const src=$('#media-preview').dataset.originalSrc;if(src&&!$('#media-preview').hidden)showMediaPreview(src,'image/png');});
$('#choose-library').addEventListener('click',async()=>{
  const grid=$('#library-grid');grid.hidden=!grid.hidden;if(grid.hidden)return;grid.innerHTML='<p>Cargando tu biblioteca…</p>';
  try{const files=(await api('/api/library')).filter(file=>['image/jpeg','image/png','image/webp','image/avif','image/gif','video/mp4','video/webm'].includes(file.type)&&($('#media-placement').value!=='logo'||!file.type.startsWith('video/')));
    grid.innerHTML=files.length?files.map(file=>`<button type="button" class="library-item" data-library-id="${esc(file.id)}">${file.type.startsWith('video/')?'<span class="library-play">▶ VIDEO</span>':`<img src="/api/image/${esc(file.id)}" loading="lazy" alt="">`}<span>${esc(file.filename_download)}</span></button>`).join(''):'<p>Tu biblioteca está lista para recibir tus primeros archivos.</p>';
    grid.querySelectorAll('[data-library-id]').forEach(button=>button.addEventListener('click',()=>{const file=files.find(item=>item.id===button.dataset.libraryId);state.mediaEdit.fileId=file.id;state.mediaEdit.dirty=true;$('#media-file').value='';$('#upload-label').textContent=file.filename_download;showMediaPreview('/api/image/'+file.id,file.type);updateFraming();grid.hidden=true;}));
  }catch(error){grid.textContent=error.message;}
});
$('#media-file').addEventListener('change',()=>{
  const file=$('#media-file').files[0];if(!file)return;
  $('#upload-label').textContent=file.name;if(previewBlob)URL.revokeObjectURL(previewBlob);previewBlob=URL.createObjectURL(file);showMediaPreview(previewBlob,file.type);updateFraming();
  state.mediaEdit.fileId=null;state.mediaEdit.dirty=true;
});
$('#media-form').addEventListener('input',()=>{if(state.mediaEdit)state.mediaEdit.dirty=true;});
$('#media-form').addEventListener('submit',async event=>{
  event.preventDefault();const button=$('#save-media'),edit=state.mediaEdit,file=$('#media-file').files[0];if(!edit)return;
  if(!edit.fileId&&!file){$('#media-error').textContent='Elige una foto o un video.';$('#media-error').hidden=false;return;}
  if(file&&(!['image/jpeg','image/png','image/webp','image/avif','image/gif','video/mp4','video/webm'].includes(file.type)||file.size>(file.type.startsWith('video/')?100:25)*1024*1024||($('#media-placement').value==='logo'&&file.type.startsWith('video/')))){ $('#media-error').textContent='Usa una imagen (25 MB máx.) o un video MP4/WebM (100 MB máx.). El logo requiere una imagen.';$('#media-error').hidden=false;return; }
  button.disabled=true;button.textContent='Guardando…';$('#media-error').hidden=true;
  try{
    if(file&&!edit.fileId){const uploaded=await uploadMedia(file,button);edit.fileId=uploaded.id;}
    const input={...($('#media-placement').value==='logo'?{logo_size:Number($('#logo-size').value)}:{}),placement:$('#media-placement').value,image:edit.fileId,status:$('#media-status').value,position:`${$('#focal-x').value}% ${$('#focal-y').value}%`,fit:$('#media-fit').value,...Object.fromEntries(Object.keys(languages).map(lang=>['alt_'+lang,$('#alt-'+lang).value.trim()]))};
    const result=await api('/api/media'+(edit.id?'/'+edit.id:''),{method:edit.id?'PATCH':'POST',body:JSON.stringify(input)});
    state.media=state.media.filter(row=>row.id!==result.id);state.media.push(result);state.mediaDrafts.delete(result.placement);button.disabled=false;edit.dirty=false;closeMedia();render();toast('Medio guardado. Pulsa Publicar mi sitio para actualizar la página pública.');
  }catch(error){$('#media-error').textContent=error.message;$('#media-error').hidden=false;}finally{button.disabled=false;button.innerHTML='Guardar cambios';}
});
async function archiveMedia(id){
  if(!await confirmDialog('¿Restaurar la imagen original?','La imagen se conserva en tu biblioteca. La próxima vez que se publique el sitio, se usará la imagen original.'))return;
  try{const row=await api('/api/media/'+id,{method:'PATCH',body:JSON.stringify({status:'archived'})});state.media=state.media.map(item=>item.id===id?row:item);render();toast('La imagen original se restaurará en la próxima publicación del sitio.');}catch(error){toast(error.message,true);}
}
$('#close-media').addEventListener('click',closeMedia);$('#cancel-media').addEventListener('click',closeMedia);
$('#edit-studio-logo').addEventListener('click',()=>{if(state.canEdit&&!state.busy&&!state.mediaUploading){closeMenu();openMedia('logo');}});
for(const image of document.querySelectorAll('[data-studio-logo]'))image.addEventListener('error',()=>setBrandImage(image,'/favicon.svg',false));
syncPublishedLogo();
$('#media-dialog').addEventListener('cancel',event=>{event.preventDefault();closeMedia();});
$('#menu-toggle').addEventListener('click',()=>$('#sidebar').classList.contains('open')?closeMenu():openMenu());$('#sidebar-shade').addEventListener('click',closeMenu);
$('#main-nav').addEventListener('click',event=>{if(event.target.closest('a'))closeMenu();});
window.addEventListener('keydown',event=>{if(event.key==='Escape')closeMenu();});
window.addEventListener('hashchange',()=>{if(!$('#studio-view').hidden)route();});
window.addEventListener('beforeunload',event=>{if(allDirty()||state.mediaUploading||workspace.hasUnsaved()||state.mediaEdit?.dirty){event.preventDefault();event.returnValue='';}});
$('#show-password').addEventListener('click',()=>{const password=$('#password'),visible=password.type==='password';password.type=visible?'text':'password';$('#show-password').textContent=visible?'Ocultar':'Ver';$('#show-password').setAttribute('aria-label',visible?'Ocultar contraseña':'Mostrar contraseña');});
$('#login-form').addEventListener('submit',async event=>{
  event.preventDefault();const button=event.target.querySelector('[type="submit"]');button.disabled=true;button.textContent='Abriendo tu Studio…';$('#login-error').hidden=true;
  try{await api('/api/login',{method:'POST',body:JSON.stringify({email:$('#email').value.trim(),password:$('#password').value})});$('#password').value='';await load();}
  catch(error){$('#login-error').textContent=error.message;$('#login-error').hidden=false;}finally{button.disabled=false;button.innerHTML='Entrar a mi Studio <span>↗</span>';}
});
$('#logout').addEventListener('click',async()=>{if((allDirty()||state.mediaUploading||workspace.hasUnsaved()||state.mediaEdit?.dirty)&&!await confirmDialog('¿Salir del Studio?','Se perderán tus cambios sin guardar.'))return;try{await api('/api/logout',{method:'POST',body:'{}'});showLogin();}catch(error){toast(error.message,true);}});
try{await load();}catch(error){showLogin();if(!/Inicia sesión|sesión/.test(error.message)){ $('#login-error').textContent='El Studio no puede reconectarse por ahora. Puedes intentar iniciar sesión de nuevo.';$('#login-error').hidden=false; }}
