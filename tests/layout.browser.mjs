import test from 'node:test';
import assert from 'node:assert/strict';
import {firefox} from 'playwright';
import {journalFixture} from './helpers/journal-fixture.mjs';
test('Firefox: drag sections and hero blocks, preview spacing, preserve unsaved arrangement across languages and save/reload',async t=>{
 const f=await journalFixture(t),browser=await firefox.launch();t.after(()=>browser.close());const page=await browser.newPage({viewport:{width:1440,height:1200}});page.setDefaultTimeout(15000);await page.request.post(f.base+'/api/login',{headers:{Origin:f.base},data:{email:'owner@example.com',password:'test-password'}});await page.goto(f.base+'/#visual');await page.frameLocator('iframe').locator('#studio').waitFor();await page.locator('[data-layout-toggle]').click();
 await page.locator('[data-layout-id="studio"]').dragTo(page.locator('[data-layout-id="universos"]'));
 await page.waitForFunction(()=>{const d=document.querySelector('iframe').contentDocument;return !!(d.querySelector('#studio').compareDocumentPosition(d.querySelector('#universos'))&Node.DOCUMENT_POSITION_FOLLOWING);});
 await page.locator('[data-layout-id="hero-word"]').dragTo(page.locator('[data-layout-id="hero-bottom"]'));
 const slider=page.locator('[data-layout-id="hero-word"] input');await slider.fill('80');await slider.dispatchEvent('input');assert.equal(await page.frameLocator('iframe').locator('.hero-word').evaluate(n=>n.style.marginBlockStart),'80px');
 assert.equal(await page.frameLocator('iframe').locator('#studio').evaluate(n=>!!(n.compareDocumentPosition(n.ownerDocument.querySelector('#universos'))&4)),true);
 await page.locator('[data-language=fr]').click();await page.frameLocator('iframe').locator('.hero-word[style*="80px"]').waitFor();assert.equal(await page.locator('[data-publish]').isDisabled(),true);
 await page.locator('[data-visual-save]').click();await page.locator('[data-visual-save]:disabled').waitFor();assert.equal(f.layout.config.spacing['hero-word'],80);assert.ok(f.layout.config.sections.indexOf('studio')<f.layout.config.sections.indexOf('universos'));assert.ok(f.layout.config.hero.indexOf('hero-word')<f.layout.config.hero.indexOf('hero-bottom'));
 await page.reload();await page.frameLocator('iframe').locator('.hero-word[style*="80px"]').waitFor();
});
