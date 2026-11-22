import {cleanInline,renderInline,mountEditors} from './editor.js?v=color-1';
import {colorToolsMarkup} from './text-color.js?v=color-1';
import {logoCss,logoStyle,logoSize,logoImageUrl,prepareLogoPreview} from './logo.js?v=brand-4';
import {mediaAlt,mediaLabels} from './media-copy.js?v=studio-2';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const selectors={logo:'header .brand,footer .brand',hero:'.hero-art',studio:'.about-copy',graphic:'.service-card:first-child .service-art',digital:'.service-card:nth-child(2) .service-art'};

// The same interaction as Nathalie Studio: select on the page, edit in the inspector, save together.
export function visualPageMarkup(lang){
 return `<section class="visual-page" aria-label="Editor visual de la página">
 <div class="visual-page-toolbar"><div class="visual-modes" role="group" aria-label="Modo del editor"><button type="button" data-visual-mode="edit" aria-pressed="true">Editar página</button><button type="button" data-visual-mode="preview" aria-pressed="false">Vista previa</button></div><div class="device-tabs" role="group" aria-label="Tamaño de pantalla"><button type="button" data-device="1440" aria-pressed="true">Ordenador</button><button type="button" data-device="820" aria-pressed="false">Tableta</button><button type="button" data-device="390" aria-pressed="false">Móvil</button></div><button type="button" class="icon-button" data-visual-expand aria-label="Ampliar editor">⛶</button><button type="button" class="button secondary" data-revert disabled>Descartar</button><button type="button" class="button primary" data-save data-visual-save disabled>Guardar cambios</button><button type="button" class="button secondary" data-publish disabled>Publicar mi sitio</button></div>
 <div class="visual-language"><span>Idioma del contenido</span><div class="language-tabs">${[['es','Español'],['en','Inglés'],['fr','Francés']].map(([key,name])=>`<button type="button" class="language-tab ${lang===key?'active':''}" data-language="${key}" aria-pressed="${lang===key}">${name}</button>`).join('')}</div></div>
 <div class="visual-media-tools" role="group" aria-label="Subir fotos y videos"><label>Ubicación <select data-upload-placement aria-label="Ubicación de la foto o video"></select></label><button type="button" class="button secondary" data-add-photo>Subir foto</button><button type="button" class="button secondary" data-add-video>Subir video</button><span>Elige dónde aparecerá. Revisa el resultado y guarda.</span></div>
 <div id="save-summary" class="visual-page-status" role="status">Preparando tu página…</div>
 <div class="visual-page-workbench"><div class="visual-page-canvas"><div class="visual-browser-bar"><span aria-hidden="true">● ● ●</span><span>Tu sitio · Diseño real</span><span class="visual-dimensions">1440 px</span></div><div class="visual-page-viewport"><div class="visual-page-frame"><iframe title="EON NOVA · Editor visual" sandbox="allow-same-origin" src="/api/preview?lang=${lang}"></iframe></div><div class="visual-loading"><strong>Preparando tu página…</strong></div></div></div>
 <aside class="visual-inspector" aria-label="Contenido seleccionado"><div class="visual-inspector-tabs"><button type="button" data-inspector="edit" aria-pressed="true">Editar</button><button type="button" data-inspector="contents" aria-pressed="false">Contenido</button></div><div class="visual-inspector-content"><span class="visual-kind">TU PÁGINA</span><h2>Haz clic para editar.</h2><p>Selecciona un texto para escribir sobre el diseño.</p><p>Selecciona una foto o el logo para cambiar el archivo y ver el resultado aquí.</p><p>Guarda los cambios. Después, publica cuando todo esté listo.</p></div></aside></div>
 <p class="visual-error form-error" role="alert" hidden></p><input class="visual-upload" type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif,video/mp4,video/webm" hidden></section>`;
}

export function mountVisualPage(root,{lang,rows,valueOf,onText,onMediaOptions,onPhoto,onMediaChange,onSave,canEdit,mediaOf,placements=Object.keys(selectors),anchor,prefs={},dirtyCount=()=>0,busy=()=>false}){
 const frame=root.querySelector('iframe'),status=root.querySelector('.visual-page-status'),inspector=root.querySelector('.visual-inspector-content'),upload=root.querySelector('.visual-upload');
 const targets=new Map();
 const mediaTools=root.querySelector('.visual-media-tools'),uploadPlacement=mediaTools.querySelector('[data-upload-placement]');
 mediaTools.hidden=!placements.length;
 uploadPlacement.innerHTML=placements.map(placement=>`<option value="${placement}">${esc(mediaLabels[placement])}</option>`).join('');
 uploadPlacement.value=placements.includes('hero')?'hero':placements[0]||'';
 let doc,selected,disposeEditors,destroyed=false,count=0,uploading=false,width=prefs.width||1440,mode=prefs.mode||'edit';
 const normalize=html=>{const t=document.createElement('template');t.innerHTML=html;return t.innerHTML.replace(/\s+/g,' ').trim();};
 const lookup=new Map();
 for(const row of rows)for(const value of [row[lang],row.source])if(value)lookup.set(normalize(value),row);
 const editable=()=>canEdit&&!busy()&&!uploading&&mode==='edit';
 function message(error=''){const node=root.querySelector('.visual-error');node.textContent=error;node.hidden=!error;}
 function highlight(node){doc?.querySelectorAll('[data-eon-selected]').forEach(el=>el.removeAttribute('data-eon-selected'));node?.setAttribute('data-eon-selected','');}
 function refresh(){
  if(destroyed)return;
  const dirty=dirtyCount();status.textContent=!status.dataset.visualReady&&!busy()&&!uploading?'Preparando tu página…':uploading?'Subiendo archivo…':busy()?'Guardando cambios…':!canEdit?'Vista previa · solo lectura':dirty?`${dirty} cambio${dirty===1?'':'s'} sin guardar`:`${count} textos editables · haz clic en un texto o una imagen.`;
  root.querySelector('[data-visual-save]').disabled=!canEdit||busy()||uploading||!dirty;
  for(const nodes of targets.values())for(const node of nodes){node.contentEditable=String(editable());node.setAttribute('aria-readonly',String(!editable()));}
  inspector.querySelectorAll('[data-rich-text]').forEach(node=>node.contentEditable=String(editable()));
  inspector.querySelectorAll('button,input').forEach(node=>node.disabled=!editable());
  mediaTools.querySelectorAll('button,select').forEach(node=>node.disabled=!editable());
  mediaTools.querySelector('[data-add-video]').disabled=!editable()||uploadPlacement.value==='logo';
 }
 function changeText(row,value,origin){
  if(!editable())return;
  onText(row.id,lang,value);
  for(const node of targets.get(row.id)||[])if(node!==origin)renderInline(node,value);
  const input=inspector.querySelector('[data-rich-text]');if(selected?.kind==='text'&&selected.row.id===row.id&&input!==origin&&input)renderInline(input,value);
  refresh();
 }
 function selectText(row,node){
  disposeEditors?.();selected={kind:'text',row,node,editingNode:node};highlight(node);setInspectorTab('edit');
  inspector.innerHTML=`<span class="visual-kind">TEXTO · ${lang.toUpperCase()}</span><h2>${esc(row.label)}</h2><div class="visual-editor"><div class="rich-toolbar" role="toolbar" aria-label="Formato"><button type="button" data-format="bold" aria-label="Negrita"><strong>B</strong></button><button type="button" data-format="italic" aria-label="Énfasis">Énfasis</button><button type="button" data-format="undo" aria-label="Deshacer">↶</button></div><div data-rich-text="${row.id}" class="rich-field" role="textbox" aria-label="Texto seleccionado" aria-multiline="true">${esc(valueOf(row)[lang])}</div><div class="rich-bottom"><span class="editor-length"></span></div></div><p>La tipografía y el diseño se conservan.</p>`;
  inspector.querySelector('.rich-toolbar').insertAdjacentHTML('afterend',colorToolsMarkup());
  inspector.insertAdjacentHTML('beforeend','<p>Selecciona las letras que quieres colorear. Sin selección, el color se aplica a todo el texto.</p>');
  disposeEditors=mountEditors(inspector,{editable:editable(),colorDocument:doc,colorTarget:()=>selected.editingNode||inspector.querySelector('[data-rich-text]'),onFocus:field=>{selected.editingNode=field;},onColorChange:(target,value)=>changeText(row,value,target),onChange:(_id,value)=>changeText(row,value,inspector.querySelector('[data-rich-text]'))});refresh();
 }
 async function applyMedia(placement){
  if(!doc||destroyed)return;
  const row=mediaOf(placement);if(!row?.image?.id||row.status==='archived')return;
  const src=location.origin+logoImageUrl(row.image);
  if(placement==='logo'){
   const logo=await prepareLogoPreview(src);if(destroyed)return;
   doc.documentElement.style.cssText=logoStyle(row.logo_size);
   for(const brand of doc.querySelectorAll(selectors.logo)){
    const image=doc.createElement('img');image.className='brand-logo';image.src=logo.src;image.alt=mediaAlt(placement,lang,row['alt_'+lang]);image.width=logo.width;image.height=logo.height;brand.replaceChildren(image);
   }
   return;
  }
  const container=doc.querySelector(selectors[placement]);if(!container)return;
  container.querySelectorAll('img,video,picture').forEach(node=>node.remove());
  if(placement==='hero')container.querySelectorAll('canvas').forEach(node=>node.style.display='none');
  const video=row.image.type?.startsWith('video/'),element=doc.createElement(video?'video':'img');
  element.src=src;element.className={hero:'cms-hero-image',studio:'cms-studio-image'}[placement]||'';
  element.setAttribute('aria-label',mediaAlt(placement,lang,row['alt_'+lang]));if(!video)element.alt=mediaAlt(placement,lang,row['alt_'+lang]);else{element.controls=true;element.preload='metadata';}
  element.style.cssText=`display:block;width:100%;${placement==='studio'?'height:auto;max-height:430px':'height:100%'};object-fit:${row.fit||'cover'};object-position:${row.position||'50% 50%'}`;
  element.dataset.eonPlacement=placement;container.prepend(element);
 }
 async function selectMedia(placement,node){
  if(placements.includes(placement))uploadPlacement.value=placement;
  disposeEditors?.();selected={kind:'media',placement,node};highlight(node);setInspectorTab('edit');
  const row=mediaOf(placement),video=row?.image?.type?.startsWith('video/'),logo=placement==='logo';
  inspector.innerHTML=`<span class="visual-kind">${logo?'LOGO':video?'VIDEO':'IMAGEN'}</span><h2>${esc(mediaLabels[placement])}</h2><div class="visual-media-preview">${row?.image?.id?(video?`<video class="visual-photo" controls preload="metadata" src="${esc(logoImageUrl(row.image))}"></video>`:`<img class="visual-photo ${logo?'is-logo':''}" src="${esc(logoImageUrl(row.image))}" alt="${esc(mediaAlt(placement,lang,row['alt_'+lang]))}">`):'<span class="visual-placeholder">Elige tu archivo</span>'}</div><button type="button" class="button primary" data-upload-visual>${logo?'Subir mi logo':'Subir foto o video'}</button><p>${logo?'JPG, PNG, WebP, AVIF o GIF · Hasta 25 MB.':'Fotos hasta 25 MB · Videos MP4 o WebM hasta 100 MB.'}</p>${logo&&row?.image?.id?`<label class="visual-logo-label" for="visual-logo-size">Tamaño del logo · <output id="visual-logo-value">${logoSize(row.logo_size)} px</output></label><input id="visual-logo-size" data-logo-size type="range" min="40" max="120" step="2" value="${logoSize(row.logo_size)}">`:''}<p>Selecciona el archivo, revisa el resultado en la página y pulsa <strong>Guardar cambios</strong>.</p><button type="button" class="button secondary" data-media-options>Más opciones</button>`;
  refresh();
  if(logo&&row?.image?.id){
   const image=inspector.querySelector('img');image.style.height=logoSize(row.logo_size)+'px';
   try{const prepared=await prepareLogoPreview(location.origin+logoImageUrl(row.image));if(!destroyed&&selected?.kind==='media'&&selected.placement===placement&&image.isConnected)image.src=prepared.src;}catch(error){message(error.message);}
  }
 }
 function setInspectorTab(tab){root.querySelectorAll('[data-inspector]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.inspector===tab)));}
 function outline(){
  disposeEditors?.();setInspectorTab('contents');
  inspector.innerHTML=`<span class="visual-kind">CONTENIDO DE LA PÁGINA</span><h2>Elige qué quieres cambiar.</h2><div class="visual-outline">${placements.map(placement=>`<button type="button" data-outline-media="${placement}"><strong>${esc(mediaLabels[placement])}</strong><span>Logo, foto o video</span></button>`).join('')}${rows.map(row=>`<button type="button" data-outline-text="${row.id}"><strong>${esc(row.label)}</strong><span>${esc(valueOf(row)[lang].replace(/<[^>]*>/g,' ').slice(0,100))}</span></button>`).join('')}</div>`;
 }
 function resize(){
  if(destroyed)return;
  const holder=root.querySelector('.visual-page-viewport'),wrap=root.querySelector('.visual-page-frame'),height=root.classList.contains('visual-expanded')?Math.max(450,innerHeight-210):650;
  const scale=Math.max(.1,Math.min(1,holder.clientWidth/width));wrap.style.width=width+'px';wrap.style.height=(height/scale)+'px';wrap.style.transform=`scale(${scale})`;holder.style.height=height+'px';
  root.querySelector('.visual-dimensions').textContent=width+' px';root.querySelectorAll('[data-device]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.device)===width)));
 }
 function setMode(next){
  mode=next;prefs.mode=next;root.classList.toggle('is-preview',next==='preview');doc?.body.toggleAttribute('data-eon-preview',next==='preview');
  root.querySelectorAll('[data-visual-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.visualMode===next)));
  if(next==='preview')highlight(null);else doc?.querySelectorAll('video').forEach(video=>video.pause());refresh();resize();
 }
 function scrollToAnchor(){if(anchor)doc?.getElementById(anchor)?.scrollIntoView({block:'start'});}
 async function activate(){
  if(destroyed)return;if(selected){outline();selected=null;}doc=frame.contentDocument;
  const loading=root.querySelector('.visual-loading');
  try{
   if(!doc?.querySelector('main'))throw Error('No se pudo abrir la página. Vuelve a intentar.');
   const style=doc.createElement('style');style.textContent=`html{scroll-behavior:auto}body{overflow-x:hidden}[data-eon-text]{cursor:text;outline-offset:5px;pointer-events:auto!important}.hero-copy,.hero-bottom{pointer-events:auto!important}[data-eon-text]:hover{outline:1px dashed #9aee68}[data-eon-selected]{outline:2px solid #9aee68!important}[data-eon-placement]{cursor:pointer;outline-offset:3px;pointer-events:auto!important}[data-eon-placement]:hover{outline:3px dashed #9aee68}.eon-edit-media{position:relative;z-index:20;display:block;border:1px dashed #9aee68;background:#152315;color:#c8efb1;font:14px Arial;padding:12px;margin:12px;cursor:pointer}.hero-art{pointer-events:auto!important;animation:none!important}.hero-art:after{pointer-events:none}.hero-motion-controls{display:none!important}canvas{opacity:.2}video{pointer-events:none}[data-eon-preview] [data-eon-text]:hover,[data-eon-preview] [data-eon-placement]:hover{outline:0}[data-eon-preview] .eon-edit-media{display:none}`+logoCss;doc.head.append(style);
   style.textContent+='[data-eon-preview] video{pointer-events:auto}';
   targets.clear();count=0;
   function visit(node){
    if(!node.tagName||['SCRIPT','STYLE','SVG','CANVAS','HEAD','NOSCRIPT'].includes(node.tagName))return;
    const row=rows.find(row=>row.source===node.dataset.eonSource)||lookup.get(normalize(node.innerHTML));
    if(row&&node.textContent.trim()){
     node.dataset.eonText=row.id;renderInline(node,valueOf(row)[lang]);node.setAttribute('role','textbox');node.setAttribute('aria-label',row.label);node.setAttribute('aria-multiline','true');count++;
     if(!targets.has(row.id))targets.set(row.id,[]);targets.get(row.id).push(node);
     node.addEventListener('focus',()=>{if(mode!=='edit')return;if(selected?.kind==='text'&&selected.row.id===row.id){selected.node=node;selected.editingNode=node;highlight(node);}else selectText(row,node);});
     node.addEventListener('input',()=>changeText(row,cleanInline(node.innerHTML),node));
     node.addEventListener('paste',event=>{event.preventDefault();if(editable())doc.execCommand('insertText',false,event.clipboardData.getData('text/plain'));});
     node.addEventListener('drop',event=>event.preventDefault());
     node.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();if(editable())doc.execCommand('insertLineBreak');}});return;
    }
    for(const child of [...node.children])visit(child);
   }
   visit(doc.body);
   for(const placement of Object.keys(selectors))await applyMedia(placement);
   if(destroyed)return;
   for(const placement of placements){
    for(const container of doc.querySelectorAll(selectors[placement])){
     const target=placement==='studio'?container.querySelector('img,video'):container;
     if(target)target.dataset.eonPlacement=placement;
     if(!target||placement==='studio'){
      const button=doc.createElement('button');button.className='eon-edit-media';button.dataset.eonPlacement=placement;button.textContent='Cambiar foto o video';container.prepend(button);
     }
    }
   }
   doc.addEventListener('click',event=>{
    const target=event.target.closest('[data-eon-placement]');
    if(target&&mode==='edit'){event.preventDefault();event.stopPropagation();selectMedia(target.dataset.eonPlacement,target);return;}
    if(event.target.closest('a'))event.preventDefault();
   });
   doc.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key==='s'){event.preventDefault();if(editable())onSave();}});
   loading.hidden=true;status.dataset.visualReady='true';setMode(mode);scrollToAnchor();
  }catch(error){if(!destroyed){message(error.message);loading.innerHTML='<strong>No se pudo abrir la página.</strong><button type="button" class="button secondary" data-visual-retry>Volver a intentar</button>';}}
 }
 frame.addEventListener('load',activate);
 root.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.device){width=Number(button.dataset.device);prefs.width=width;resize();requestAnimationFrame(scrollToAnchor);}
  if(button.dataset.visualMode)setMode(button.dataset.visualMode);
  if(button.hasAttribute('data-visual-expand')){root.classList.toggle('visual-expanded');button.setAttribute('aria-label',root.classList.contains('visual-expanded')?'Reducir editor':'Ampliar editor');resize();}
  if(button.hasAttribute('data-visual-save')&&canEdit&&!busy()&&!uploading)onSave();
  if((button.hasAttribute('data-add-photo')||button.hasAttribute('data-add-video'))&&editable()){
   const placement=uploadPlacement.value;if(!placements.includes(placement))return;
   if(button.hasAttribute('data-add-video')&&placement==='logo')return;
   selectMedia(placement,doc?.querySelector(`[data-eon-placement="${placement}"]`));
   upload.accept=button.hasAttribute('data-add-video')?'video/mp4,video/webm':'image/jpeg,image/png,image/webp,image/avif,image/gif';upload.click();
  }
  if(button.dataset.inspector){if(button.dataset.inspector==='contents')outline();else if(selected?.kind==='media')selectMedia(selected.placement,selected.node);else if(selected?.kind==='text')selectText(selected.row,selected.node);}
  if(button.dataset.outlineText){const row=rows.find(row=>row.id===button.dataset.outlineText),node=targets.get(row.id)?.[0];node?.scrollIntoView({block:'center'});selectText(row,node);}
  if(button.dataset.outlineMedia){const placement=button.dataset.outlineMedia,node=doc.querySelector(`[data-eon-placement="${placement}"]`);node?.scrollIntoView({block:'center'});selectMedia(placement,node);}
  if(button.hasAttribute('data-upload-visual')&&editable()){upload.accept=selected.placement==='logo'?'image/jpeg,image/png,image/webp,image/avif,image/gif':'image/jpeg,image/png,image/webp,image/avif,image/gif,video/mp4,video/webm';upload.click();}
  if(button.hasAttribute('data-media-options')&&editable())onMediaOptions(selected.placement);
  if(button.hasAttribute('data-visual-retry')){message();frame.src='/api/preview?lang='+lang+'&retry='+Date.now();}
 });
 root.addEventListener('input',event=>{
  if(event.target.hasAttribute('data-logo-size')&&selected?.kind==='media'&&editable()){
   const size=Number(event.target.value);onMediaChange(selected.placement,{logo_size:size});doc.documentElement.style.cssText=logoStyle(size);inspector.querySelector('output').textContent=size+' px';inspector.querySelector('img').style.height=size+'px';refresh();
  }
 });
 uploadPlacement.addEventListener('change',refresh);
 upload.addEventListener('change',async()=>{
  const file=upload.files[0],placement=selected?.placement;if(!file||!placement||!editable())return;
  uploading=true;message();refresh();
  try{await onPhoto(placement,file,progress=>{if(!destroyed)status.textContent=`Subiendo archivo… ${progress}%`;});if(destroyed)return;await applyMedia(placement);await selectMedia(placement,doc.querySelector(`[data-eon-placement="${placement}"]`));}
  catch(error){if(!destroyed)message(error.message);}
  finally{upload.value='';uploading=false;refresh();}
 });
 const observer=new ResizeObserver(resize);observer.observe(root.querySelector('.visual-page-viewport'));resize();refresh();
 return {refresh,destroy(){destroyed=true;disposeEditors?.();observer.disconnect();frame.removeEventListener('load',activate);root.classList.remove('visual-expanded');}};
}
