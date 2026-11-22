import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultLayout,validateLayout} from './public/layout-data.js';
import {arrangePage} from '../../src/lib/page-layout.mjs';
import {journalFixture} from '../../tests/helpers/journal-fixture.mjs';
test('layout validates full permutations and bounded spacing and preserves unconfigured page elements',()=>{
 const layout=defaultLayout();layout.sections.reverse();layout.hero.reverse();layout.spacing['hero-word']=80;
 const html=arrangePage('<section id="inicio"><div class="hero-art">background</div><div class="hero-top">Top</div><div class="hero-copy">Copy</div><div class="hero-bottom">Bottom</div><div class="hero-word">Brand</div></section><section id="studio">Studio</section><footer>Footer</footer>',layout);
 assert.ok(html.indexOf('id="studio"')<html.indexOf('id="inicio"'));assert.ok(html.indexOf('Brand')<html.indexOf('Copy'));assert.match(html,/margin-block-start:80px/);assert.match(html,/<footer>Footer<\/footer>$/);assert.ok(html.includes('background'));
 for(const invalid of [{...layout,sections:['inicio']},{...layout,spacing:{inicio:-1}},{...layout,spacing:{inicio:241}},{...layout,spacing:{foreign:0}},{...layout,hero:Array(4).fill('hero-top')}])assert.throws(()=>validateLayout(invalid));
});
test('authenticated arrangement saves without publishing, rejects invalid changes and respects read-only accounts',async t=>{
 const f=await journalFixture(t);const next=defaultLayout();next.sections.reverse();next.spacing['hero-word']=64;
 assert.equal((await f.request('/api/layout','PATCH',next)).status,200);assert.deepEqual((await(await f.request('/api/layout')).json()).config,next);assert.equal(f.publications(),0);
 assert.equal((await f.request('/api/layout','PATCH',{...next,spacing:{inicio:-4}})).status,400);assert.deepEqual(f.layout.config,next);
 const ro=await journalFixture(t,{readonly:true});assert.equal((await ro.request('/api/layout','PATCH',next)).status,403);assert.equal((await fetch(f.base+'/api/layout')).status,401);
});
