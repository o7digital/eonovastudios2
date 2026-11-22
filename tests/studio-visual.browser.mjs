import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:net';
import {firefox} from 'playwright';
import sharp from 'sharp';
import {logoCss} from '../cms/studio/public/logo.js';
import {createStudioServer} from '../cms/studio/server.mjs';
import {cleanCopy} from '../src/lib/cms.mjs';

async function fixture(t, {readonly = false,logo = false} = {}) {
  const css = await readFile(new URL('../src/styles/global.css', import.meta.url), 'utf8');
  const reservation=createServer();
  await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));
  const port=reservation.address().port,base=`http://127.0.0.1:${port}`;
  await new Promise(resolve=>reservation.close(resolve));
  const rows = [{id:'12345678-1234-4123-a123-123456789012',label:'Título de inicio',section:'hero',source:'Las ideas<br>no se quedan<br><em>quietas.</em>',es:'Las ideas<br>no se quedan<br><em>quietas.</em>',en:'Ideas<br>keep <em>moving.</em>',fr:'Les idées<br>restent en <em>mouvement.</em>',status:'published',sort:0}];
  const media={id:'12345678-1234-4123-a123-123456789013',placement:'logo',image:{id:'12345678-1234-4123-a123-123456789014',type:'image/png'},alt_es:'Logo',alt_en:'Logo',alt_fr:'Logo',status:'published',logo_size:80};
  const png=await sharp(Buffer.from('<svg width="800" height="600"><circle cx="400" cy="300" r="100" fill="white"/></svg>')).png().toBuffer();
  const mediaRows=new Map(logo?[[media.id,media]]:[]),files=new Map([[media.image.id,{bytes:png,type:'image/png',name:'logo.png'}]]);
  let publications=0,failNextMediaSave=false;
  const server = createStudioServer({
    cms:'https://cms.example',origin:base,secret:'a-test-secret-with-at-least-32-characters',secure:false,
    publishEnabled:true,publishSecret:'private-test-publish-secret',
    async fetcher(url, options) {
      const path = new URL(url).pathname;
      const result = data => Response.json({data});
      if (path === '/auth/login') return result({access_token:'test-access',refresh_token:'test-refresh',expires:3600000});
      if (path === '/users/me') return result({id:'owner',email:'owner@example.com',first_name:'Eon'});
      if (path === '/permissions/me') return result({site_texts:{update:{access:readonly?'none':'full'}}});
      if (path === '/items/site_texts') {
        if (options.method === 'PATCH') {
          if (readonly) return new Response(null,{status:403});
          for (const change of JSON.parse(options.body)) Object.assign(rows.find(row=>row.id===change.id),change);
        }
        return result(rows);
      }
      if(path==='/folders')return result([]);
      if(path==='/files'&&options.method==='POST'){
        const uploadedId=randomUUID();
        const file=options.body.get('file');files.set(uploadedId,{bytes:Buffer.from(await file.arrayBuffer()),type:file.type,name:file.name});
        return result({id:uploadedId,type:file.type,filename_download:file.name});
      }
      if(path.startsWith('/files/')){const file=files.get(path.split('/').at(-1));return result({type:file.type,filesize:file.bytes.length});}
      if(path.startsWith('/assets/')){const file=files.get(path.split('/').at(-1));return new Response(file.bytes,{headers:{'Content-Type':file.type}});}
      if(path.startsWith('/items/section_media')){
        if(options.method==='POST'||options.method==='PATCH'){
          if(readonly)return new Response(null,{status:403});
          if(failNextMediaSave){failNextMediaSave=false;return new Response(null,{status:503});}
          const {image,...input}=JSON.parse(options.body),id=path.split('/').at(-1)==='section_media'?input.id:path.split('/').at(-1);
          const row=mediaRows.get(id)||{id};Object.assign(row,input);
          if(image){const file=files.get(image);row.image={id:image,type:file.type,filename_download:file.name};}
          mediaRows.set(id,row);return result(row);
        }
        return result([...mediaRows.values()]);
      }
      if (path === '/api/cms-publish') {publications++;return Response.json({id:'test-deployment'},{status:202});}
      if (['/','/en/','/fr/'].includes(path)) {
        return new Response(`<!doctype html><html><head><style>${css}${logoCss}</style></head><body><header class="nav"><a class="brand">Logo</a></header><main><section class="hero" id="inicio"><div class="hero-art hero-motion"><canvas></canvas></div><div class="hero-copy"><h1 data-eon-source="Las ideas&lt;br&gt;no se quedan&lt;br&gt;&lt;em&gt;quietas.&lt;/em&gt;">${rows[0].es}</h1></div></section></main></body></html>`);
      }
      throw new Error('Unexpected fixture request '+path);
    },
  });
  await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
  const browser = await firefox.launch();
  t.after(()=>browser.close());
  const page = await browser.newPage({viewport:{width:1500,height:1050}});page.setDefaultTimeout(10000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.context().request.post(base+'/api/login',{headers:{Origin:base},data:{email:'owner@example.com',password:'test-password'}});
  await page.goto(base+'/#visual');
  await page.locator('.visual-page-status[data-visual-ready]').waitFor();
  return {page,rows,media,mediaRows,errors,publications:()=>publications,failMediaSave:()=>{failNextMediaSave=true;}};
}

test('Firefox: the actual site CSS permits clicking, editing, saving and reloading the hero in all three languages',async t=>{
  const {page,rows,errors,publications}=await fixture(t);
  for (const [lang,text] of [['es','Edición en español'],['en','Edited in English'],['fr','Modification en français']]) {
    await page.locator(`[data-language="${lang}"]`).click();
    await page.locator('.visual-page-status[data-visual-ready]').waitFor();
    if (lang === 'fr') await page.locator('[data-device="390"]').click();
    const title = page.frameLocator('iframe').locator('h1');
    // A real click reproduces the original pointer-events failure; force/fill would hide it.
    await title.click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type(text);
    assert.equal(await title.textContent(),text);
    assert.equal(await page.locator('.visual-inspector [data-rich-text]').textContent(),text);
    assert.equal(await page.locator('[data-save]').isEnabled(),true);
    assert.equal(await page.locator('[data-publish]').isEnabled(),false);
    const saved=page.waitForResponse(response=>response.url().endsWith('/api/texts')&&response.request().method()==='PATCH');
    await page.locator('[data-save]').click();
    assert.equal((await saved).status(),200);
    await page.locator('[data-publish]:enabled').waitFor();
    assert.equal(rows[0][lang],text);
    await page.reload();
    await page.locator(`[data-language="${lang}"]`).click();
    await page.locator('.visual-page-status[data-visual-ready]').waitFor();
    assert.equal(await page.frameLocator('iframe').locator('h1').textContent(),text);
  }
  await page.locator('[data-device="1440"]').click();
  await page.frameLocator('iframe').locator('[data-eon-placement="hero"]').click({position:{x:700,y:200}});
  await page.locator('.visual-inspector [data-upload-visual]').waitFor();
  assert.equal(await page.locator('#media-dialog').isVisible(),false);
  await page.locator('[data-media-options]').click();await page.locator('#media-dialog[open]').waitFor();
  assert.equal(await page.locator('#media-placement').inputValue(),'hero');
  assert.equal(await page.locator('#media-options').getAttribute('open'),null);
  assert.equal(await page.locator('#alt-es').getAttribute('required'),null);
  await page.locator('#cancel-media').click();
  await page.locator('[data-publish]').click();
  await page.locator('#confirm-yes').click();
  await page.locator('#toast').filter({hasText:'Publicación solicitada'}).waitFor();
  assert.equal(publications(),1);
  assert.deepEqual(errors,[]);
});

test('Firefox: a read-only account cannot edit or publish through the visual editor',async t=>{
  const {page,errors}=await fixture(t,{readonly:true});
  assert.equal(await page.frameLocator('iframe').locator('h1').getAttribute('contenteditable'),'false');
  assert.equal(await page.locator('[data-save]').isDisabled(),true);
  assert.equal(await page.locator('[data-publish]').isDisabled(),true);
  for(const selector of ['[data-add-photo]','[data-add-video]','[data-upload-placement]'])assert.equal(await page.locator(selector).isDisabled(),true);
  await page.locator('[data-inspector="contents"]').click();
  await page.locator('[data-outline-text]').first().click();
  for(const selector of ['[data-text-color]','[data-text-color-code]','[data-apply-color]'])assert.equal(await page.locator('.visual-inspector '+selector).isDisabled(),true);
  assert.deepEqual(errors,[]);
});

async function selectLetters(target,word){
  await target.evaluate((node,word)=>{
    node.focus();const doc=node.ownerDocument,walker=doc.createTreeWalker(node,4);
    for(let text; (text=walker.nextNode());){
      const offset=text.textContent.indexOf(word);if(offset<0)continue;
      const range=doc.createRange();range.setStart(text,offset);range.setEnd(text,offset+word.length);
      doc.getSelection().removeAllRanges();doc.getSelection().addRange(range);return;
    }
    throw Error('Word not found: '+word);
  },word);
}

test('Firefox: selected letters keep their HEX color across the page, inspector, save and reload',async t=>{
  const {page,rows,errors}=await fixture(t);
  const title=page.frameLocator('iframe').locator('h1'),panel=page.locator('.visual-inspector');
  await title.click();await selectLetters(title,'ideas');
  await panel.locator('[data-text-color-code]').fill('#FF6600');
  await panel.locator('[data-apply-color]').click();
  assert.equal(await title.locator('span').filter({hasText:'ideas'}).evaluate(e=>getComputedStyle(e).color),'rgb(255, 102, 0)');
  assert.equal((await title.textContent()).replace(/\u00a0/g,' '),'Las ideasno se quedanquietas.');
  assert.equal(await title.locator('em').evaluate(e=>getComputedStyle(e).color),'rgb(154, 238, 104)');
  assert.match(await panel.locator('[data-rich-text]').innerHTML(),/color:.*(?:ff6600|255, 102, 0)/i);
  const before=await title.innerHTML();
  await panel.locator('[data-text-color-code]').fill('oops');await panel.locator('[data-apply-color]').click();
  assert.equal(await panel.locator('[data-color-error]').isVisible(),true);
  assert.equal(await title.innerHTML(),before);
  const saved=page.waitForResponse(r=>r.url().endsWith('/api/texts')&&r.request().method()==='PATCH');
  await page.locator('[data-save]').click();assert.equal((await saved).status(),200);
  await page.locator('.visual-page-status[data-visual-ready]').waitFor();
  assert.match(cleanCopy(rows[0].es),/style="color:#ff6600"/);
  await page.reload();await page.locator('.visual-page-status[data-visual-ready]').waitFor();
  assert.equal(await title.locator('span').filter({hasText:'ideas'}).evaluate(e=>getComputedStyle(e).color),'rgb(255, 102, 0)');
  await title.click();const input=panel.locator('[data-rich-text]');
  await selectLetters(input,'quietas.');
  await panel.locator('[data-text-color]').fill('#3366cc');
  assert.equal(await title.locator('em').evaluate(e=>getComputedStyle(e.lastElementChild||e).color),'rgb(51, 102, 204)');
  assert.match(cleanCopy(await title.innerHTML()),/#3366cc/);
  assert.deepEqual(errors,[]);
});

test('Firefox: color without selected letters applies to the whole field including emphasized words',async t=>{
  const {page,errors}=await fixture(t),title=page.frameLocator('iframe').locator('h1');
  await title.click();
  await title.evaluate(node=>{const selection=node.ownerDocument.getSelection();selection.collapse(node,0);});
  const panel=page.locator('.visual-inspector');
  await panel.locator('[data-text-color-code]').fill('#f60');await panel.locator('[data-text-color-code]').press('Enter');
  assert.equal(await panel.locator('[data-text-color-code]').inputValue(),'#ff6600');
  assert.equal(await title.evaluate(node=>{const walker=node.ownerDocument.createTreeWalker(node,4);for(let text;(text=walker.nextNode());)if(text.textContent.trim()&&getComputedStyle(text.parentElement).color!=='rgb(255, 102, 0)')return false;return true;}),true);
  await page.locator('#main-nav a[href="#hero"]').click();await page.locator('.visual-page-status[data-visual-ready]').waitFor();
  await page.locator('.studio-text-fields summary').click();
  const card=page.locator('.text-card').first(),field=card.locator('[data-rich-text]');
  await field.click();await selectLetters(field,'ideas');
  await card.locator('[data-text-color-code]').fill('#00aa66');await card.locator('[data-apply-color]').click();
  assert.equal(await field.locator('span').filter({hasText:'ideas'}).last().evaluate(e=>getComputedStyle(e).color),'rgb(0, 170, 102)');
  const saved=page.waitForResponse(r=>r.url().endsWith('/api/texts')&&r.request().method()==='PATCH');
  await page.locator('[data-save]').click();assert.equal((await saved).status(),200);
  await page.locator('.visual-page-status[data-visual-ready]').waitFor();
  assert.match(cleanCopy(await page.frameLocator('iframe').locator('h1').innerHTML()),/#00aa66/);
  assert.deepEqual(errors,[]);
});

test('Firefox: logo padding is removed and the size control survives saving and changes the actual page preview',async t=>{
  const {page,media,errors}=await fixture(t,{logo:true});
  const image=page.frameLocator('iframe').locator('header .brand-logo');
  assert.equal(await image.evaluate(e=>e.getBoundingClientRect().height),80);
  assert.equal(await image.evaluate(e=>e.naturalWidth),200);
  await image.click();
  assert.equal(await page.locator('#media-dialog').isVisible(),false);
  await page.locator('[data-logo-size]').fill('120');
  assert.equal(await page.frameLocator('iframe').locator('header .brand-logo').evaluate(e=>e.getBoundingClientRect().height),120);
  assert.equal(media.logo_size,80);
  const saved=page.waitForResponse(r=>r.url().includes('/api/media/')&&r.request().method()==='PATCH');
  await page.locator('[data-visual-save]').click();assert.equal((await saved).status(),200);
  await page.locator('.visual-page-status[data-visual-ready]').waitFor();
  assert.equal(media.logo_size,120);
  assert.equal(await page.frameLocator('iframe').locator('header .brand-logo').evaluate(e=>e.getBoundingClientRect().height),120);
  await page.reload();await page.locator('.visual-page-status[data-visual-ready]').waitFor();
  assert.equal(await page.frameLocator('iframe').locator('header .brand-logo').evaluate(e=>e.getBoundingClientRect().height),120);
  await page.locator('[data-device="390"]').click();
  assert.equal(await page.frameLocator('iframe').locator('header .brand-logo').evaluate(e=>e.getBoundingClientRect().height),84);
  assert.deepEqual(errors,[]);
});

async function selectHero(page){
  await page.frameLocator('iframe').locator('[data-eon-placement="hero"]').click({position:{x:700,y:200}});
  await page.locator('.visual-inspector [data-upload-visual]').waitFor();
}
async function choosePhoto(page){
  const png=await sharp({create:{width:64,height:48,channels:3,background:'#a6ed74'}}).png().toBuffer();
  const uploaded=page.waitForResponse(r=>r.url().endsWith('/api/upload')&&r.request().method()==='POST');
  await page.locator('.visual-upload').setInputFiles({name:'mi-foto.png',mimeType:'image/png',buffer:png});
  assert.equal((await uploaded).status(),201);
  await page.frameLocator('iframe').locator('.hero-art img').waitFor();
  await page.locator('[data-visual-save]:enabled').waitFor();
}

test('Firefox: select a photo, upload, preview and save without descriptions; retain the draft across languages and publish',async t=>{
  const {page,mediaRows,errors,publications}=await fixture(t);
  await selectHero(page);await choosePhoto(page);
  assert.equal(await page.locator('#media-dialog').isVisible(),false);
  assert.equal(mediaRows.size,0);
  assert.equal(await page.locator('[data-publish]').isDisabled(),true);
  await page.locator('[data-language="en"]').click();
  await page.locator('.visual-page-status[data-visual-ready]').waitFor();
  assert.equal(await page.frameLocator('iframe').locator('.hero-art img').count(),1);
  const saved=page.waitForResponse(r=>r.url().endsWith('/api/media')&&r.request().method()==='POST');
  await page.locator('[data-visual-save]').click();assert.equal((await saved).status(),201);
  await page.locator('.visual-page-status[data-visual-ready]').waitFor();
  assert.equal(mediaRows.size,1);
  const row=[...mediaRows.values()][0];assert.equal(row.placement,'hero');
  for(const lang of ['es','en','fr'])assert.ok(row['alt_'+lang]?.trim());
  await page.reload();await page.locator('.visual-page-status[data-visual-ready]').waitFor();
  assert.equal(await page.frameLocator('iframe').locator('.hero-art img').count(),1);
  await page.locator('[data-visual-mode="preview"]').click();
  assert.equal(await page.frameLocator('iframe').locator('h1').getAttribute('contenteditable'),'false');
  assert.equal(await page.locator('.visual-inspector').isHidden(),true);
  await page.locator('[data-visual-mode="edit"]').click();
  await page.locator('[data-visual-expand]').click();assert.equal(await page.locator('.visual-expanded').count(),1);
  await page.locator('[data-visual-expand]').click();
  await page.locator('[data-publish]').click();await page.locator('#confirm-yes').click();
  await page.locator('#toast').filter({hasText:'Publicación solicitada'}).waitFor();assert.equal(publications(),1);
  await page.locator('#main-nav a[href="#hero"]').click();await page.locator('.visual-page-status[data-visual-ready]').waitFor();
  assert.equal(await page.locator('.studio-text-fields').getAttribute('open'),null);
  assert.equal(await page.frameLocator('iframe').locator('h1').getAttribute('contenteditable'),'true');
  assert.deepEqual(errors,[]);
});

test('Firefox: discard an uploaded photo before saving and recover a pending photo after an upstream save error',async t=>{
  const {page,mediaRows,errors,failMediaSave}=await fixture(t);
  await selectHero(page);await choosePhoto(page);
  await page.locator('[data-revert]').click();await page.locator('#confirm-yes').click();
  await page.locator('.visual-page-status[data-visual-ready]').waitFor();
  assert.equal(mediaRows.size,0);assert.equal(await page.frameLocator('iframe').locator('.hero-art img').count(),0);
  await selectHero(page);await choosePhoto(page);failMediaSave();
  let saved=page.waitForResponse(r=>r.url().endsWith('/api/media')&&r.request().method()==='POST');
  await page.locator('[data-visual-save]').click();assert.equal((await saved).status(),502);
  await page.locator('.visual-page-status[data-visual-ready]').waitFor();
  assert.equal(await page.frameLocator('iframe').locator('.hero-art img').count(),1);
  assert.equal(await page.locator('[data-visual-save]').isEnabled(),true);
  assert.equal(await page.locator('[data-publish]').isDisabled(),true);
  saved=page.waitForResponse(r=>r.url().endsWith('/api/media')&&r.request().method()==='POST');
  await page.locator('[data-visual-save]').click();assert.equal((await saved).status(),201);
  await page.locator('.visual-page-status[data-visual-ready]').waitFor();assert.equal(mediaRows.size,1);
  assert.deepEqual(errors,[]);
});

test('Firefox: the optional media form saves a new file with all description fields empty and gives a Spanish error for a missing file',async t=>{
  const {page,mediaRows,errors}=await fixture(t);
  await selectHero(page);await page.locator('[data-media-options]').click();
  await page.locator('#media-dialog[open]').waitFor();
  assert.equal(await page.locator('#media-options').getAttribute('open'),null);
  for(const lang of ['es','en','fr']){
    assert.equal(await page.locator('#alt-'+lang).inputValue(),'');
    assert.equal(await page.locator('#alt-'+lang).getAttribute('required'),null);
  }
  await page.locator('#save-media').click();assert.match(await page.locator('#media-error').textContent(),/Elige una foto/);
  const png=await sharp({create:{width:64,height:48,channels:3,background:'#a6ed74'}}).png().toBuffer();
  await page.locator('#media-file').setInputFiles({name:'mi-foto.png',mimeType:'image/png',buffer:png});
  const saved=page.waitForResponse(r=>r.url().endsWith('/api/media')&&r.request().method()==='POST');
  await page.locator('#save-media').click();assert.equal((await saved).status(),201);
  await page.locator('#media-dialog').waitFor({state:'hidden'});assert.equal(mediaRows.size,1);
  const row=[...mediaRows.values()][0];for(const lang of ['es','en','fr'])assert.ok(row['alt_'+lang]);
  assert.deepEqual(errors,[]);
});

test('Firefox: visible upload buttons accept a video, preview playback, save, reload and replace it with a photo',async t=>{
  const {page,mediaRows,errors}=await fixture(t);
  await page.locator('[data-upload-placement]').selectOption('logo');
  assert.equal(await page.locator('[data-add-video]').isDisabled(),true);
  await page.locator('[data-upload-placement]').selectOption('hero');
  assert.equal(await page.locator('[data-add-video]').isEnabled(),true);
  const bytes=await page.evaluate(async()=>{
    const canvas=document.createElement('canvas');canvas.width=96;canvas.height=64;
    const context=canvas.getContext('2d'),stream=canvas.captureStream(10),recorder=new MediaRecorder(stream,{mimeType:'video/webm'}),chunks=[];
    const blob=new Promise(resolve=>{recorder.ondataavailable=event=>chunks.push(event.data);recorder.onstop=()=>resolve(new Blob(chunks,{type:'video/webm'}));});
    recorder.start();let tick=0;
    const drawing=setInterval(()=>{context.fillStyle=tick++%2?'#9aee68':'#171717';context.fillRect(0,0,96,64);},50);
    setTimeout(()=>{clearInterval(drawing);recorder.stop();stream.getTracks().forEach(track=>track.stop());},700);
    return [...new Uint8Array(await(await blob).arrayBuffer())];
  });
  const uploaded=page.waitForResponse(r=>r.url().endsWith('/api/upload')&&r.request().method()==='POST');
  const chooser=page.waitForEvent('filechooser');await page.locator('[data-add-video]').click();
  assert.equal(await page.locator('.visual-upload').getAttribute('accept'),'video/mp4,video/webm');
  await(await chooser).setFiles({name:'mi-video.webm',mimeType:'video/webm',buffer:Buffer.from(bytes)});
  assert.equal((await uploaded).status(),201);
  const video=page.frameLocator('iframe').locator('.hero-art video');await video.waitFor();
  await page.locator('[data-visual-save]:enabled').waitFor();assert.equal(mediaRows.size,0);
  await page.locator('[data-visual-mode="preview"]').click();
  assert.equal(await video.evaluate(node=>getComputedStyle(node).pointerEvents),'auto');
  await video.evaluate(async node=>{node.muted=true;await node.play();});
  assert.equal(await video.evaluate(node=>node.paused),false);
  await page.locator('[data-visual-mode="edit"]').click();
  assert.equal(await video.evaluate(node=>node.paused),true);
  const saved=page.waitForResponse(r=>r.url().endsWith('/api/media')&&r.request().method()==='POST');
  await page.locator('[data-save]').click();assert.equal((await saved).status(),201);
  await page.locator('.visual-page-status[data-visual-ready]').waitFor();
  const row=[...mediaRows.values()][0];assert.equal(row.placement,'hero');assert.equal(row.image.type,'video/webm');
  await page.reload();await page.locator('.visual-page-status[data-visual-ready]').waitFor();assert.equal(await video.count(),1);
  await page.locator('[data-upload-placement]').selectOption('hero');
  const photoChooser=page.waitForEvent('filechooser');await page.locator('[data-add-photo]').click();
  assert.ok(!(await page.locator('.visual-upload').getAttribute('accept')).includes('video/'));
  const png=await sharp({create:{width:64,height:48,channels:3,background:'#a6ed74'}}).png().toBuffer();
  await(await photoChooser).setFiles({name:'mi-foto.png',mimeType:'image/png',buffer:png});
  await page.frameLocator('iframe').locator('.hero-art img').waitFor();await page.locator('[data-save]:enabled').waitFor();
  const replaced=page.waitForResponse(r=>r.url().includes('/api/media/')&&r.request().method()==='PATCH');
  await page.locator('[data-save]').click();assert.equal((await replaced).status(),200);
  await page.locator('.visual-page-status[data-visual-ready]').waitFor();assert.equal(mediaRows.size,1);
  assert.equal([...mediaRows.values()][0].image.type,'image/png');assert.equal(await video.count(),0);
  assert.deepEqual(errors,[]);
});
