'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const studies=[
 {tag:'ANIMACIÓN 2D',title:'El trazo<br>cobra vida.',description:'Forma, ritmo y personalidad. Un espacio para explorar el movimiento, el dibujo y la expresión cuadro a cuadro.',tags:['Frame by frame','Motion design','Expresión'],stage:'TRAZO & RITMO',caption:'Todo comienza con una línea.',word:'TRAZO.'},
 {tag:'ANIMACIÓN 3D',title:'Otra forma<br>de ver.',description:'Volumen, luz y profundidad. Formas que se transforman y revelan nuevas perspectivas con cada movimiento.',tags:['Volumen','Iluminación','Movimiento'],stage:'VOLUMEN & LUZ',caption:'Una idea. Todas sus dimensiones.',word:'VOLUMEN.'},
 {tag:'CORTOMETRAJES',title:'Un instante.<br>Una historia.',description:'El ritmo de una escena cambia lo que sentimos. Una exploración del encuadre, la atmósfera y el tiempo como herramientas narrativas.',tags:['Dirección visual','Composición','Narrativa'],stage:'TIEMPO & ENCUADRE',caption:'El silencio también cuenta historias.',word:'INSTANTE.'},
 {tag:'SERIES ANIMADAS',title:'Historias que<br>continúan.',description:'Un lenguaje visual que evoluciona sin perder su identidad. Ritmos, motivos y variaciones para construir continuidad entre episodios.',tags:['Desarrollo visual','Identidad','Continuidad'],stage:'SECUENCIA & VARIACIÓN',caption:'Cada frame abre otra posibilidad.',word:'CONTINÚA.'}
];
let mode=0,time=0,speed=1,paused=matchMedia('(prefers-reduced-motion: reduce)').matches,reelPaused=false,last=0,frames=0;
const lab=$('#lab-canvas'),reel=$('#reel-canvas'),dialog=$('#reel-dialog');
const resize=c=>{const r=c.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);if(r.width&&r.height){c.width=Math.round(r.width*d);c.height=Math.round(r.height*d);c.getContext('2d').setTransform(d,0,0,d,0,0)}};
new ResizeObserver(()=>{resize(lab);if(dialog.open)resize(reel);paint(lab,time)}).observe(lab.parentElement);
function selectStudy(n){mode=n;const s=studies[n];$('#lab-number').textContent=String(n+1).padStart(2,'0');$('#lab-tag').textContent=s.tag;$('#lab-title').innerHTML=s.title;$('#lab-description').textContent=s.description;$('#lab-tags').replaceChildren(...s.tags.map(t=>{const el=document.createElement('span');el.textContent=t;return el}));$('#stage-kind').textContent=`ESTUDIO 0${n+1} / ${s.stage}`;$('#stage-caption').textContent=s.caption;$('#reel-caption').textContent=`0${n+1} / ${s.tag}`;$('#reel-word').textContent=s.word;$$('[data-discipline]').forEach((b,i)=>{b.classList.toggle('selected',i===n);b.setAttribute('aria-pressed',String(i===n))});paint(lab,time);if(dialog.open)paint(reel,time)}
$$('[data-discipline]').forEach(b=>b.onclick=()=>selectStudy(Number(b.dataset.discipline)));
$('#speed').oninput=e=>{speed=Number(e.target.value);$('#speed-value').value=speed.toFixed(1)+'×'};
function syncPause(){if(document.querySelector('#reel-pause')){document.querySelector('#reel-pause').disabled=paused;document.querySelector('#reel-pause').textContent=paused?'Movimiento pausado':reelPaused?'Continuar':'Pausar'}document.body.classList.toggle('motion-paused',paused);$('#motion-toggle').textContent=paused?'Activar movimiento':'Pausar movimiento';$('#motion-toggle').setAttribute('aria-pressed',String(paused))}syncPause();
$('#motion-toggle').onclick=()=>{paused=!paused;syncPause()};
function paint(canvas,t){const ctx=canvas.getContext('2d'),w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;ctx.clearRect(0,0,w,h);ctx.fillStyle='#17161a';ctx.fillRect(0,0,w,h);let glow=ctx.createRadialGradient(w*.5,h*.5,0,w*.5,h*.5,w*.65);glow.addColorStop(0,mode===1?'#142e25':'#1c2920');glow.addColorStop(1,'#111114');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);ctx.save();ctx.translate(w/2,h/2);const unit=Math.min(w,h)*.3;
 if(mode===0){for(let i=0;i<25;i++){ctx.beginPath();const shift=i*.095;for(let j=0;j<=200;j++){const a=j/200*Math.PI*2;const r=unit*(.68+.15*Math.sin(a*3+t*.9+shift));const x=Math.cos(a+shift+t*.1)*r*(1+.2*Math.cos(t*.6)),y=Math.sin(a+shift+t*.1)*r; j?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath();ctx.strokeStyle=`hsla(${100+i*1.6},95%,${52+i*.9}%,${.22+i*.025})`;ctx.lineWidth=1.3;ctx.stroke()}}
 if(mode===1){const dots=[];for(let i=0;i<36;i++)for(let j=0;j<24;j++){let a=i/36*Math.PI*2,b=j/24*Math.PI*2;let x=(.8+.3*Math.cos(b))*Math.cos(a),y=(.8+.3*Math.cos(b))*Math.sin(a),z=.3*Math.sin(b);let yy=y*Math.cos(t*.4)-z*Math.sin(t*.4),zz=y*Math.sin(t*.4)+z*Math.cos(t*.4);let xx=x*Math.cos(t*.3)+zz*Math.sin(t*.3),zz2=-x*Math.sin(t*.3)+zz*Math.cos(t*.3);const p=2.8/(2.8-zz2);dots.push({x:xx*unit*p,y:yy*unit*p,z:zz2,p})}dots.sort((a,b)=>a.z-b.z).forEach(d=>{ctx.beginPath();ctx.arc(d.x,d.y,Math.max(.6,d.p*1.8),0,Math.PI*2);ctx.fillStyle=`hsla(${135+d.z*30},90%,${58+d.z*20}%,${.5+d.z*.3})`;ctx.fill()})}
 if(mode===2){ctx.rotate(-.2);for(let i=18;i>0;i--){const s=(i+((t*.8)%1))/18;ctx.save();ctx.rotate(Math.sin(t*.22+s)*.3);ctx.strokeStyle=`rgba(115,${160+Math.floor(s*80)},85,${.1+(1-s)*.65})`;ctx.lineWidth=1.5;ctx.strokeRect(-unit*1.7*s,-unit*s,unit*3.4*s,unit*2*s);ctx.restore()}ctx.fillStyle='#ddffcc';ctx.beginPath();ctx.arc(Math.sin(t*.5)*unit*.5,Math.cos(t*.3)*unit*.3,5,0,Math.PI*2);ctx.fill()}
 if(mode===3){const gap=unit*.48;for(let i=-2;i<=2;i++)for(let j=-2;j<=2;j++){ctx.save();ctx.translate(i*gap,j*gap);const a=Math.sin(t+i*.5+j*.4);ctx.rotate(a*.8);ctx.strokeStyle=`hsl(${95+(i+2)*10},90%,${50+(j+2)*7}%)`;ctx.lineWidth=2;const r=gap*(.21+.09*a);ctx.beginPath();if((i+j)%2===0)ctx.arc(0,0,r,0,Math.PI*2);else ctx.rect(-r,-r,2*r,2*r);ctx.stroke();ctx.restore()}}
 ctx.restore();ctx.strokeStyle='#ffffff04';ctx.lineWidth=1;for(let x=0;x<w;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()}for(let y=0;y<h;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}}
let labVisible=true;new IntersectionObserver(e=>{labVisible=e[0].isIntersecting}).observe(lab);
function loop(ms){const dt=Math.min((ms-last)/1000,.05);last=ms;if(!document.hidden&&(labVisible||dialog.open)&&!paused&&!(dialog.open&&reelPaused)){time+=dt*speed;if(labVisible)paint(lab,time);if(dialog.open)paint(reel,time);if(++frames%6===0)$('#frame-counter').textContent='FRAME '+String(Math.floor(time*24)%1000).padStart(3,'0')}requestAnimationFrame(loop)}requestAnimationFrame(loop);paint(lab,0);
function openReel(){dialog.showModal();document.body.style.overflow='hidden';resize(reel);selectStudy(mode);paint(reel,time);reelPaused=false;syncPause()}
$$('[data-reel]').forEach(b=>b.onclick=openReel);
$('#reel-pause').onclick=()=>{if(paused){paused=false;syncPause();reelPaused=false}else reelPaused=!reelPaused;$('#reel-pause').textContent=reelPaused?'Continuar':'Pausar'};
$('#reel-next').onclick=()=>selectStudy((mode+1)%4);
$$('dialog').forEach(d=>{d.querySelector('.close').onclick=()=>d.close();d.addEventListener('close',()=>{document.body.style.overflow=''});d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close()}})});
window.addEventListener('resize',()=>{if(dialog.open){resize(reel);paint(reel,time)}});

// Header motion: layered, projected light ribbons; shares the global pause control.
(()=>{
 const canvas=document.querySelector('#hero-canvas');if(!canvas)return;
 const context=canvas.getContext('2d');if(!context)return;
 let style=0,clock=0,stamp=0,visible=true,width=0,height=0,px=0,py=0,tx=0,ty=0;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const buttons=[...document.querySelectorAll('[data-hero-mode]')];
 function size(){const box=canvas.getBoundingClientRect();width=box.width;height=box.height;const ratio=Math.min(devicePixelRatio||1,1.6);canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);context.setTransform(ratio,0,0,ratio,0,0);render()}
 function project(x,y,z,r){const ay=clock*.13+px*.22,ax=.45+Math.sin(clock*.17)*.18+py*.18;const xx=x*Math.cos(ay)-z*Math.sin(ay),zz=x*Math.sin(ay)+z*Math.cos(ay);const yy=y*Math.cos(ax)-zz*Math.sin(ax),depth=y*Math.sin(ax)+zz*Math.cos(ax);const perspective=3.5/(3.5-depth);return [width*.57+xx*r*perspective,height*.47+yy*r*perspective,depth]}
 function render(){if(!width||!height)return;context.clearRect(0,0,width,height);context.fillStyle='#090909';context.fillRect(0,0,width,height);const radius=Math.min(width*.38,height*.45);const glow=context.createRadialGradient(width*.57,height*.48,0,width*.57,height*.48,radius*1.65);glow.addColorStop(0,'#173322');glow.addColorStop(.55,'#0d1a12');glow.addColorStop(1,'#090909');context.fillStyle=glow;context.fillRect(0,0,width,height);
 const layers=width<650?34:48,segments=180;context.globalCompositeOperation='screen';
 for(let i=0;i<layers;i++){const v=i/(layers-1),phase=v*Math.PI*2;context.beginPath();let depth=0;for(let j=0;j<=segments;j++){const a=j/segments*Math.PI*2;let x,y,z;
 if(style===0){const wave=.83+.17*Math.cos(3*a+clock*.55+phase);x=Math.cos(a)*wave;y=Math.sin(a)*wave;z=.48*Math.sin(2*a+phase+clock*.35);x*=1+.12*Math.cos(phase);y*=1+.12*Math.sin(phase)}
 else if(style===1){const ring=.76+.28*Math.cos(phase);x=ring*Math.cos(a);y=ring*Math.sin(a);z=.28*Math.sin(phase)+.07*Math.sin(a*3+clock*.6)}
 else{const r=.67+.24*Math.sin(a*2+phase+clock*.35);x=Math.cos(a)*r;y=Math.sin(a)*r;z=.58*Math.sin(a*3+phase);x+=.12*Math.sin(phase+clock*.2)}
 const p=project(x,y,z,radius);depth+=p[2];j?context.lineTo(p[0],p[1]):context.moveTo(p[0],p[1]);}context.closePath();context.strokeStyle=`hsla(${99+v*55},${65-v*20}%,${52+v*30}%,${.22+v*.43})`;context.lineWidth=v>.8?1.2:.8;context.stroke()}
 for(let k=0;k<50;k++){const a=k*2.399+clock*.025;const r=radius*(1.3+.35*Math.sin(k*7.13));const x=width*.57+Math.cos(a)*r*1.2,y=height*.47+Math.sin(a)*r*.9;context.fillStyle=`rgba(199,236,171,${.12+.2*(.5+.5*Math.sin(clock*.4+k))})`;context.beginPath();context.arc(x,y,k%5===0?1.4:.65,0,Math.PI*2);context.fill()}context.globalCompositeOperation='source-over';
 }
 buttons.forEach(button=>button.addEventListener('click',()=>{style=Number(button.dataset.heroMode);buttons.forEach(b=>{const selected=b===button;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected))});render()}));
 document.querySelector('.hero').addEventListener('pointermove',e=>{if(e.pointerType==='touch'||reduced.matches)return;const b=canvas.getBoundingClientRect();tx=(e.clientX-b.left)/b.width-.5;ty=(e.clientY-b.top)/b.height-.5});document.querySelector('.hero').addEventListener('pointerleave',()=>{tx=0;ty=0});
 new ResizeObserver(size).observe(canvas.parentElement);new IntersectionObserver(entries=>{visible=entries[0].isIntersecting}).observe(canvas);
 reduced.addEventListener('change',e=>{paused=e.matches;syncPause();render()});
 function tick(ms){const dt=Math.min((ms-stamp)/1000,.05);stamp=ms;if(visible&&!document.hidden&&!paused){clock+=dt;px+=(tx-px)*.035;py+=(ty-py)*.035;render()}requestAnimationFrame(tick)}size();requestAnimationFrame(tick);
})();
