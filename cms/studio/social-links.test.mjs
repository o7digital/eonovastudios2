import {test} from 'node:test';
import assert from 'node:assert/strict';
import {journalFixture} from '../../tests/helpers/journal-fixture.mjs';
import {normalizeSocialUrl} from './public/social-links-data.js';
import {loadSocialLinks} from '../../src/lib/social-links.mjs';
test('social profile URLs normalize pasted addresses and reject executable schemes or embedded credentials',()=>{
 assert.equal(normalizeSocialUrl('instagram.com/jorge'),'https://instagram.com/jorge');assert.equal(normalizeSocialUrl('  https://www.tiktok.com/@jorge  '),'https://www.tiktok.com/@jorge');
 for(const value of ['javascript:alert(1)','data:text/html,x','file:///private','https://user:password@example.com/','https://example.com/\nalert','not a url'])assert.equal(normalizeSocialUrl(value),null);
});
test('profile links save visibility independently, retain disabled URLs, validate the complete batch and support additional networks',async t=>{
 const {request,socialRows,base,cookie}=await journalFixture(t);
 assert.equal((await fetch(base+'/api/social-links')).status,401);
 assert.equal((await fetch(base+'/api/social-links',{method:'PATCH',headers:{Cookie:cookie,Origin:'https://foreign.example','Content-Type':'application/json'},body:'{}'})).status,403);
 assert.equal((await request('/api/social-links','PATCH',{items:[{id:'instagram',url:'instagram.com/jorge',enabled:true},{id:'facebook',url:'https://www.facebook.com/jorge',enabled:false}]})).status,200);assert.equal(socialRows.find(r=>r.id==='instagram').url,'https://instagram.com/jorge');assert.equal(socialRows.find(r=>r.id==='facebook').enabled,false);
 assert.equal((await request('/api/social-links','PATCH',{items:[{id:'instagram',url:'https://example.com/changed',enabled:false},{id:'tiktok',url:'',enabled:true}]})).status,400);assert.equal(socialRows.find(r=>r.id==='instagram').enabled,true);
 assert.equal((await request('/api/social-links','PATCH',{items:[{id:'instagram',url:'https://example.com',enabled:true,platform:'custom'}]})).status,400);
 const response=await request('/api/social-links','POST',{label:'Mi otra red'});assert.equal(response.status,201);const custom=await response.json();assert.equal(custom.enabled,false);assert.equal(custom.platform,'custom');
 assert.equal((await request('/api/social-links','PATCH',{items:[{id:custom.id,label:'Mi red',url:'https://example.com/jorge',enabled:true}]})).status,200);
});
test('read-only accounts cannot edit profile links and public snapshots omit every disabled network and all credentials',async t=>{
 const {request}=await journalFixture(t,{readonly:true});assert.equal((await request('/api/social-links')).status,200);assert.equal((await request('/api/social-links','POST',{label:'Extra'})).status,403);assert.equal((await request('/api/social-links','PATCH',{items:[{id:'instagram',url:'https://instagram.com/jorge',enabled:true}]})).status,403);
 const published=await loadSocialLinks({url:'https://cms.example',token:'private-profile-token',fetcher:async(url,options)=>{assert.equal(options.headers.Authorization,'Bearer private-profile-token');return Response.json({data:[{enabled:true,platform:'instagram',label:'Instagram',url:'instagram.com/jorge'},{enabled:false,platform:'facebook',url:'https://facebook.com/private-disabled'}]});}});
 assert.deepEqual(published,[{label:'Instagram',url:'https://instagram.com/jorge'}]);assert.ok(!JSON.stringify(published).includes('private-profile-token'));assert.ok(!JSON.stringify(published).includes('disabled'));
 await assert.rejects(loadSocialLinks({url:'https://cms.example',token:'x',fetcher:async()=>Response.json({data:[{enabled:true,platform:'instagram',url:'javascript:alert(1)'}]})}),/Invalid/);
});
