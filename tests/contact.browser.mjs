import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {firefox} from 'playwright';
import {contactCopy} from '../src/lib/contact-copy.mjs';
async function fixture(t){
 const directory=resolve('dist');
 const server=http.createServer(async(req,res)=>{
  try{
   let path=resolve(directory,'.'+new URL(req.url,'http://test').pathname);
   if(!path.startsWith(directory+'/')&&path!==directory)throw Error('Invalid path');
   if((await stat(path)).isDirectory())path=resolve(path,'index.html');
   const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.webp':'image/webp','.avif':'image/avif'}[extname(path)]||'application/octet-stream';
   res.writeHead(200,{'Content-Type':mime});res.end(await readFile(path));
  }catch{res.writeHead(404);res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
 const browser=await firefox.launch();t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(10000);
 const sent=[];let failed=false;
 await page.route('https://formspree.io/f/mrpqogbn',async route=>{
  const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Accept'};
  if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
  sent.push(route.request().postDataJSON());assert.equal(route.request().headers().accept,'application/json');
  await route.fulfill({status:failed?503:200,headers:cors,contentType:'application/json',body:JSON.stringify(failed?{errors:[{message:'Temporary failure'}]}:{ok:true})});
 });
 return {page,sent,base:`http://127.0.0.1:${server.address().port}`,fail:value=>{failed=value;}};
}
async function fill(page){await page.locator('#contact-name').fill('Contact form test');await page.locator('#contact-email').fill('contact-test@example.invalid');await page.locator('#contact-message').fill('A creative project for EON NOVA Studios.');await page.locator('#contact-consent').check();}

test('Firefox: the form submits to the supplied Formspree endpoint in all three languages and fits mobile',async t=>{
 const {page,sent,base}=await fixture(t);
 for(const lang of ['es','en','fr']){
  await page.goto(base+(lang==='es'?'/':'/'+lang+'/')+'#contacto');
  assert.equal(await page.locator('[data-contact-form]').getAttribute('action'),'https://formspree.io/f/mrpqogbn');
  assert.equal(await page.locator('label[for=contact-name]').textContent(),contactCopy[lang].name+' *');
  await fill(page);await page.locator('.contact-submit').click();
  await page.locator('[data-contact-status]').filter({hasText:contactCopy[lang].success}).waitFor();
  assert.equal(sent.at(-1).language,lang);assert.equal(sent.at(-1).consent,true);assert.equal(sent.at(-1)._gotcha,'');
  assert.equal(await page.locator('#contact-message').inputValue(),'');
 }
 assert.equal(sent.length,3);
 await page.locator('#contacto').screenshot({path:'/tmp/eon-contact-desktop.png'});
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 const box=await page.locator('[data-contact-form]').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390);
 await page.locator('#contacto').screenshot({path:'/tmp/eon-contact-mobile.png'});
});

test('Firefox: validation is localized and a failed Formspree request preserves the visitor message for retry',async t=>{
 const {page,sent,base,fail}=await fixture(t);await page.goto(base+'/#contacto');
 await page.locator('.contact-submit').click();assert.equal(sent.length,0);assert.equal(await page.locator('#contact-name-error').textContent(),contactCopy.es.required);
 await fill(page);await page.locator('#contact-email').fill('invalid');await page.locator('.contact-submit').click();assert.equal(sent.length,0);assert.equal(await page.locator('#contact-email-error').textContent(),contactCopy.es.invalidEmail);
 await page.locator('#contact-email').fill('contact-test@example.invalid');fail(true);await page.locator('.contact-submit').click();
 await page.locator('[data-contact-status]').filter({hasText:contactCopy.es.unavailable}).waitFor();
 assert.equal(await page.locator('#contact-message').inputValue(),'A creative project for EON NOVA Studios.');assert.equal(await page.locator('.contact-submit').isEnabled(),true);
 fail(false);await page.locator('.contact-submit').click();await page.locator('[data-contact-status]').filter({hasText:contactCopy.es.success}).waitFor();assert.equal(sent.length,2);
});
