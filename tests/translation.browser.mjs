import test from 'node:test';
import assert from 'node:assert/strict';
import {firefox} from 'playwright';
import {journalFixture} from './helpers/journal-fixture.mjs';
async function setup(t,options={}){const state=await journalFixture(t,{autoTranslate:true,...options}),browser=await firefox.launch();t.after(()=>browser.close());const page=await browser.newPage({viewport:{width:1440,height:1100}});page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.request.post(state.base+'/api/login',{headers:{Origin:state.base},data:{email:'owner@example.com',password:'test-password'}});return {...state,page,errors};}
test('Firefox: Spanish visual edits generate both previews and translated tabs remain read-only',async t=>{
 const {page,base,texts,errors}=await setup(t);await page.goto(base+'/#visual');
 const frame=page.frameLocator('iframe'),heading=frame.locator('[data-eon-text]');await heading.waitFor();assert.equal(await heading.getAttribute('contenteditable'),'true');
 await heading.fill('Una nueva historia');await page.locator('[data-visual-save]:enabled').click();await page.locator('[data-visual-save]:disabled').waitFor();
 assert.equal(texts[0].en,'EN Una nueva historia');assert.equal(texts[0].fr,'FR Una nueva historia');
 for(const [lang,prefix] of [['en','EN'],['fr','FR']]){await page.locator(`[data-language=${lang}]`).click();await heading.waitFor();await page.waitForFunction(()=>document.querySelector('iframe')?.contentDocument?.querySelector('[data-eon-text]')?.getAttribute('contenteditable')==='false');assert.equal(await heading.textContent(),prefix+' Una nueva historia');assert.equal(await page.locator('[data-add-photo]').isEnabled(),true);}
 await page.locator('[data-language=es]').click();await heading.waitFor();await page.waitForFunction(()=>document.querySelector('iframe')?.contentDocument?.querySelector('[data-eon-text]')?.getAttribute('contenteditable')==='true');assert.deepEqual(errors,[]);
});
test('Firefox: articles are written in Spanish, translated on save and previewed read-only in English and French',async t=>{
 const {page,base,entries,errors}=await setup(t);await page.goto(base+'/#journal-blog');await page.locator('[data-journal-new]').click();await page.locator('[data-journal-title]').fill('Una historia creativa');await page.locator('[data-journal-summary]').fill('Nuestro equipo en acción');await page.locator('[data-add-block=text]').click();await page.locator('[data-rich-text]').fill('Creamos nuevos mundos');
 await page.locator('[data-text-color-code]').fill('#FF6600');await page.locator('[data-apply-color]').click();
 await page.locator('[data-journal-save]').click();await page.locator('[data-journal-save]:disabled').waitFor();assert.equal(entries.length,1);assert.match(entries[0].blocks[0].text.fr,/color:#ff6600/);
 await page.locator('[data-journal-lang=en]').click();assert.equal(await page.locator('[data-journal-title]').inputValue(),'EN Una historia creativa');assert.equal(await page.locator('[data-journal-title]').evaluate(n=>n.readOnly),true);assert.equal(await page.locator('[data-journal-summary]').evaluate(n=>n.readOnly),true);assert.equal(await page.locator('[data-rich-text]').getAttribute('contenteditable'),'false');assert.equal(await page.locator('[data-add-block=text]').isDisabled(),true);assert.equal(await page.locator('[data-add-block=image]').isEnabled(),true);
 await page.locator('[data-journal-lang=fr]').click();assert.equal(await page.locator('[data-journal-title]').inputValue(),'FR Una historia creativa');await page.locator('[data-journal-preview]').click();assert.match(await page.locator('.journal-preview').textContent(),/FR Creamos nuevos mundos/);assert.deepEqual(errors,[]);
});
test('Firefox: a failed translation leaves the Spanish draft available and the published content unchanged',async t=>{
 const {page,base,texts}=await setup(t,{translationFailure:true});await page.goto(base+'/#visual');const heading=page.frameLocator('iframe').locator('[data-eon-text]');await heading.waitFor();await heading.fill('Mi borrador pendiente');await page.locator('[data-visual-save]').click();await page.locator('#toast').filter({hasText:'No se pudieron generar las traducciones'}).waitFor();await heading.waitFor();assert.equal(await heading.textContent(),'Mi borrador pendiente');assert.equal(texts[0].es,'Diseñamos historias');assert.equal(await page.locator('[data-visual-save]').isEnabled(),true);assert.equal(await page.locator('[data-publish]').isDisabled(),true);
});
