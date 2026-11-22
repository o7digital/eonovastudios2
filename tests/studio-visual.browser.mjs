import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:net';
import {firefox} from 'playwright';
import {createStudioServer} from '../cms/studio/server.mjs';

async function fixture(t, {readonly = false} = {}) {
  const css = await readFile(new URL('../src/styles/global.css', import.meta.url), 'utf8');
  const reservation=createServer();
  await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));
  const port=reservation.address().port,base=`http://127.0.0.1:${port}`;
  await new Promise(resolve=>reservation.close(resolve));
  const rows = [{id:'12345678-1234-4123-a123-123456789012',label:'Título de inicio',section:'hero',source:'Las ideas<br>no se quedan<br><em>quietas.</em>',es:'Las ideas<br>no se quedan<br><em>quietas.</em>',en:'Ideas<br>keep <em>moving.</em>',fr:'Les idées<br>restent en <em>mouvement.</em>',status:'published',sort:0}];
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
      if (path === '/items/section_media') return result([]);
      if (path === '/api/cms-publish') {publications++;return Response.json({id:'test-deployment'},{status:202});}
      if (['/','/en/','/fr/'].includes(path)) {
        return new Response(`<!doctype html><html><head><style>${css}</style></head><body><main><section class="hero" id="inicio"><div class="hero-art hero-motion"><canvas></canvas></div><div class="hero-copy"><h1 data-eon-source="Las ideas&lt;br&gt;no se quedan&lt;br&gt;&lt;em&gt;quietas.&lt;/em&gt;">${rows[0].es}</h1></div></section></main></body></html>`);
      }
      throw new Error('Unexpected fixture request '+path);
    },
  });
  await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
  const browser = await firefox.launch();
  t.after(()=>browser.close());
  const page = await browser.newPage({viewport:{width:1500,height:1050}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.context().request.post(base+'/api/login',{headers:{Origin:base},data:{email:'owner@example.com',password:'test-password'}});
  await page.goto(base+'/#visual');
  await page.locator('.visual-page-status').filter({hasText:'textos editables'}).waitFor();
  return {page,rows,errors,publications:()=>publications};
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
