import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:net';
import {firefox} from 'playwright';
import sharp from 'sharp';
import {logoCss} from '../cms/studio/public/logo.js';
import {createStudioServer} from '../cms/studio/server.mjs';

async function fixture(t, {readonly = false,logo = false} = {}) {
  const css = await readFile(new URL('../src/styles/global.css', import.meta.url), 'utf8');
  const reservation=createServer();
  await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));
  const port=reservation.address().port,base=`http://127.0.0.1:${port}`;
  await new Promise(resolve=>reservation.close(resolve));
  const rows = [{id:'12345678-1234-4123-a123-123456789012',label:'Título de inicio',section:'hero',source:'Las ideas<br>no se quedan<br><em>quietas.</em>',es:'Las ideas<br>no se quedan<br><em>quietas.</em>',en:'Ideas<br>keep <em>moving.</em>',fr:'Les idées<br>restent en <em>mouvement.</em>',status:'published',sort:0}];
  const media={id:'12345678-1234-4123-a123-123456789013',placement:'logo',image:{id:'12345678-1234-4123-a123-123456789014',type:'image/png'},alt_es:'Logo',alt_en:'Logo',alt_fr:'Logo',status:'published',logo_size:80};
  const png=await sharp(Buffer.from('<svg width="800" height="600"><circle cx="400" cy="300" r="100" fill="white"/></svg>')).png().toBuffer();
  let publications = 0;
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
      if (path === '/items/section_media') return result(logo?[media]:[]);
      if (path === '/items/section_media/'+media.id) {if(options.method==='PATCH'){const {image,...fields}=JSON.parse(options.body);Object.assign(media,fields);}return result(media);}
      if (path === '/files/'+media.image.id) return result({type:'image/png',filesize:png.length});
      if (path === '/assets/'+media.image.id) return new Response(png,{headers:{'Content-Type':'image/png'}});
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
  await page.locator('.visual-page-status').filter({hasText:'textos editables'}).waitFor();
  return {page,rows,media,errors,publications:()=>publications};
}

test('Firefox: the actual site CSS permits clicking, editing, saving and reloading the hero in all three languages',async t=>{
  const {page,rows,errors,publications}=await fixture(t);
  for (const [lang,text] of [['es','Edición en español'],['en','Edited in English'],['fr','Modification en français']]) {
    await page.locator(`[data-language="${lang}"]`).click();
    await page.locator('.visual-page-status').filter({hasText:'textos editables'}).waitFor();
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
    await page.locator('.visual-page-status').filter({hasText:'textos editables'}).waitFor();
    assert.equal(await page.frameLocator('iframe').locator('h1').textContent(),text);
  }
  await page.locator('[data-device="1440"]').click();
  await page.frameLocator('iframe').locator('[data-eon-placement="hero"]').click({position:{x:700,y:200}});
  await page.locator('#media-dialog[open]').waitFor();
  assert.equal(await page.locator('#media-placement').inputValue(),'hero');
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
  assert.deepEqual(errors,[]);
});

test('Firefox: logo padding is removed and the size control survives saving and changes the actual page preview',async t=>{
  const {page,media,errors}=await fixture(t,{logo:true});
  const image=page.frameLocator('iframe').locator('header .brand-logo');
  assert.equal(await image.evaluate(e=>e.getBoundingClientRect().height),80);
  assert.equal(await image.evaluate(e=>e.naturalWidth),200);
  await image.click();await page.locator('#media-dialog[open]').waitFor();
  assert.equal(await page.locator('#media-framing').isHidden(),true);
  await page.locator('#logo-size').fill('120');
  await page.locator('#logo-size').dispatchEvent('input');
  assert.equal(await page.locator('#media-preview').evaluate(e=>e.getBoundingClientRect().height),120);
  const saved=page.waitForResponse(r=>r.url().includes('/api/media/')&&r.request().method()==='PATCH');
  await page.locator('#save-media').click();assert.equal((await saved).status(),200);
  await page.locator('.visual-page-status').filter({hasText:'textos editables'}).waitFor();
  assert.equal(media.logo_size,120);
  assert.equal(await page.frameLocator('iframe').locator('header .brand-logo').evaluate(e=>e.getBoundingClientRect().height),120);
  await page.reload();await page.locator('.visual-page-status').filter({hasText:'textos editables'}).waitFor();
  assert.equal(await page.frameLocator('iframe').locator('header .brand-logo').evaluate(e=>e.getBoundingClientRect().height),120);
  await page.locator('[data-device="390"]').click();
  assert.equal(await page.frameLocator('iframe').locator('header .brand-logo').evaluate(e=>e.getBoundingClientRect().height),84);
  assert.deepEqual(errors,[]);
});
