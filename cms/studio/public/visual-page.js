import {cleanInline, mountEditors} from './editor.js?v=visual-2';
import {logoCss,logoStyle,prepareLogoPreview} from './logo.js?v=logo-1';
const esc = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function visualPageMarkup(lang) {
 return `<div class="visual-page"><div class="visual-page-toolbar"><div class="language-tabs">${[['es','Español'],['en','Inglés'],['fr','Francés']].map(([key,name])=>`<button type="button" class="language-tab ${lang===key?'active':''}" data-language="${key}">${name}</button>`).join('')}</div><div class="device-tabs" role="group" aria-label="Tamaño de vista previa"><button data-device="1440" aria-pressed="true">Escritorio</button><button data-device="820" aria-pressed="false">Tableta</button><button data-device="390" aria-pressed="false">Móvil</button></div></div><div class="visual-page-status" role="status">Cargando tu sitio…</div><div class="visual-page-workbench"><div class="visual-page-canvas"><div class="visual-browser-bar"><span>● ● ●</span><span>eonovastudios.com · Vista editable</span></div><div class="visual-page-viewport"><div class="visual-page-frame"><iframe title="Tu sitio EON · editor visual" sandbox="allow-same-origin" src="/api/preview?lang=${lang}"></iframe></div></div></div><aside class="visual-inspector"><span class="eyebrow">TU LIENZO CREATIVO</span><h2>Tu sitio,<br>en tus manos.</h2><p>Haz clic en un texto para editarlo directamente en la página.</p><p>Selecciona una imagen para abrir su archivo y ajustar el encuadre.</p><p>Revisa el resultado en escritorio, tableta y móvil. Guarda tus cambios antes de salir.</p><div class="visual-tip">Los cambios aparecen en esta vista al instante. La publicación actualiza el sitio para tus visitantes.</div></aside></div></div>`;
}
export function mountVisualPage(root,{lang,rows,valueOf,onText,onMedia,canEdit,media}){
 const frame=root.querySelector('iframe'),status=root.querySelector('.visual-page-status'),inspector=root.querySelector('.visual-inspector');
 let doc,selected=null;
 const normalize=html=>{const t=document.createElement('template');t.innerHTML=html;return t.innerHTML.replace(/\s+/g,' ').trim();};
 const lookup=new Map();
 for(const row of rows)for(const value of [row[lang],row.source])if(value)lookup.set(normalize(value),row);
 function select(row,node){
  selected={row,node};doc.querySelectorAll('[data-eon-selected]').forEach(el=>el.removeAttribute('data-eon-selected'));node.setAttribute('data-eon-selected','');
  inspector.innerHTML=`<span class="eyebrow">TEXTO · ${lang.toUpperCase()}</span><h2>${esc(row.label)}</h2><div class="visual-editor"><div class="rich-toolbar" role="toolbar" aria-label="Formato"><button data-format="bold" aria-label="Negrita"><strong>B</strong></button><button data-format="italic" aria-label="Énfasis">Énfasis</button><button data-format="undo" aria-label="Deshacer">↶</button></div><div data-rich-text="${row.id}" class="rich-field" role="textbox" aria-label="Texto seleccionado" aria-multiline="true">${esc(valueOf(row)[lang])}</div><div class="rich-bottom"><span class="editor-length"></span></div></div><p>Escribe aquí o directamente sobre la página. Tu diseño conserva su tipografía.</p>`;
  mountEditors(inspector,{editable:canEdit,onChange:(id,value)=>{onText(id,lang,value);for(const target of doc.querySelectorAll('[data-eon-text]'))if(target.dataset.eonText===id)target.innerHTML=cleanInline(value);status.textContent='Cambios en la vista previa · guarda para conservarlos.';}});
 }
 frame.addEventListener('load',async()=>{
  doc=frame.contentDocument;if(!doc?.querySelector('main')){status.textContent='No se pudo cargar la vista. Puedes editar desde las secciones del menú.';return;}
  const style=doc.createElement('style');style.textContent=`html{scroll-behavior:auto}body{overflow-x:hidden}[data-eon-text]{cursor:text;outline-offset:5px;pointer-events:auto!important}.hero-copy,.hero-bottom{pointer-events:auto!important}[data-eon-text]:hover{outline:1px dashed #9aee68}[data-eon-selected]{outline:2px solid #9aee68!important}[data-eon-placement]{cursor:pointer;outline-offset:3px;pointer-events:auto!important}[data-eon-placement]:hover{outline:3px dashed #9aee68}.eon-edit-media{position:relative;z-index:20;display:block;border:1px dashed #9aee68;background:#152315;color:#c8efb1;font:14px Arial;padding:12px;margin:12px;cursor:pointer}.hero-art{pointer-events:auto;animation:none!important}.hero-art:after{pointer-events:none}.hero-motion-controls{display:none!important}canvas{opacity:.2}video{pointer-events:none}`+logoCss;doc.head.append(style);
  let count=0;
  function visit(node){
   if(!node.tagName||['SCRIPT','STYLE','SVG','CANVAS','HEAD','NOSCRIPT'].includes(node.tagName))return;
   const row=rows.find(row=>row.source===node.dataset.eonSource)||lookup.get(normalize(node.innerHTML));
   if(row&&node.textContent.trim()){
    node.dataset.eonText=row.id;node.innerHTML=cleanInline(valueOf(row)[lang]);node.contentEditable=String(canEdit);node.setAttribute('role','textbox');node.setAttribute('aria-label',row.label);count++;
    node.addEventListener('focus',()=>select(row,node));
    node.addEventListener('input',()=>{const value=cleanInline(node.innerHTML);onText(row.id,lang,value);status.textContent='Cambios en la vista previa · guarda para conservarlos.';if(selected?.row.id===row.id){const input=inspector.querySelector('[data-rich-text]');if(input)input.innerHTML=value;}});
    node.addEventListener('paste',event=>{event.preventDefault();if(canEdit)doc.execCommand('insertText',false,event.clipboardData.getData('text/plain'));});
    node.addEventListener('drop',event=>event.preventDefault());
    node.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();if(canEdit)doc.execCommand('insertLineBreak');}});
    return;
   }
   for(const child of [...node.children])visit(child);
  }
  visit(doc.body);
  for(const row of media.filter(row=>row.status==='published'&&row.image?.id)){
   const selector={hero:'.hero-art',studio:'.about-copy',graphic:'.service-card:first-child .service-art',digital:'.service-card:nth-child(2) .service-art'}[row.placement];
   const video=row.image.type?.startsWith('video/');
   if(row.placement==='logo'){
    const logo=await prepareLogoPreview(location.origin+'/api/image/'+row.image.id);
    doc.documentElement.style.cssText=logoStyle(row.logo_size);
    for(const brand of doc.querySelectorAll('header .brand,footer .brand')){const image=doc.createElement('img');image.className='brand-logo';image.src=logo.src;image.alt=row['alt_'+lang];image.width=logo.width;image.height=logo.height;brand.replaceChildren(image);}continue;
   }
   const container=doc.querySelector(selector);if(!container)continue;
   container.querySelectorAll('img,video').forEach(node=>node.remove());
   if(row.placement==='hero')container.querySelectorAll('canvas').forEach(node=>node.style.display='none');
   const element=doc.createElement(video?'video':'img');element.src=location.origin+'/api/image/'+row.image.id;element.alt=row['alt_'+lang];if(video){element.controls=true;element.preload='metadata';}
   element.style.cssText=`display:block;width:100%;height:${row.placement==='studio'?'300px':'100%'};object-fit:${row.fit||'cover'};object-position:${row.position||'50% 50%'}`;container.prepend(element);
  }
  for(const [selector,placement] of [['header .brand','logo'],['footer .brand','logo'],['.hero-art','hero'],['.about-copy','studio'],['.service-card:first-child .service-art','graphic'],['.service-card:nth-child(2) .service-art','digital']]){
   const container=doc.querySelector(selector);if(!container)continue;
   const target=placement==='studio'?container.querySelector('img,video'):container;
   if(target){target.dataset.eonPlacement=placement;target.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();if(canEdit)onMedia(placement);});}
   if(!target||placement==='studio'){const button=doc.createElement('button');button.className='eon-edit-media';button.textContent=placement==='studio'?'Editar foto o video del estudio':'Editar medio';button.addEventListener('click',event=>{event.preventDefault();if(canEdit)onMedia(placement);});container.prepend(button);}
  }
  doc.addEventListener('click',event=>{if(event.target.closest('a'))event.preventDefault();});
  status.textContent=`${count} textos editables · haz clic para empezar.`;
  resize();
 });
 let width=1440;
 function resize(){const holder=root.querySelector('.visual-page-viewport'),wrap=root.querySelector('.visual-page-frame');if(!holder||!wrap||!root.contains(frame))return;const scale=Math.min(1,holder.clientWidth/width);wrap.style.width=width+'px';wrap.style.height=(700/scale)+'px';wrap.style.transform=`scale(${scale})`;holder.style.height='700px';}
 root.querySelectorAll('[data-device]').forEach(button=>button.addEventListener('click',()=>{width=Number(button.dataset.device);root.querySelectorAll('[data-device]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));resize();}));
 const observer=new ResizeObserver(()=>{if(root.contains(frame))resize();else observer.disconnect();});observer.observe(root.querySelector('.visual-page-viewport'));
}
