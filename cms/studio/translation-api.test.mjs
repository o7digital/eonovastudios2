import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {journalFixture} from '../../tests/helpers/journal-fixture.mjs';

test('Spanish page edits save English and French together, preserve color markup, and reject direct target edits',async t=>{
 const {request,texts,translationCalls}=await journalFixture(t,{autoTranslate:true}),id=texts[0].id;
 assert.equal((await(await request('/api/bootstrap')).json()).autoTranslate,true);
 const es='<span style="color:#ff00aa">Una nueva historia</span> EON NOVA';
 let r=await request('/api/texts','PATCH',{items:[{id,es}]});assert.equal(r.status,200);assert.equal(texts[0].en,'EN '+es);assert.equal(texts[0].fr,'FR '+es);assert.ok(texts[0].translation_source.text);assert.equal(translationCalls.length,1);
 r=await request('/api/texts','PATCH',{items:[{id,es,status:'draft'}]});assert.equal(r.status,200);assert.equal(translationCalls.length,1);
 assert.equal((await request('/api/texts','PATCH',{items:[{id,en:'Manual override'}]})).status,400);assert.equal(translationCalls.length,1);
});
test('translation outages preserve every existing page text and do not create incomplete journal entries',async t=>{
 const {request,texts,entries}=await journalFixture(t,{autoTranslate:true,translationFailure:true});const before=structuredClone(texts);
 assert.equal((await request('/api/texts','PATCH',{items:[{id:texts[0].id,es:'Nuevo texto'}]})).status,503);assert.deepEqual(texts,before);
 assert.equal((await request('/api/journal/entries','POST',{section:'blog',slug:'nuevo',title:{es:'Título nuevo'},summary:{},blocks:[],status:'draft'})).status,503);assert.equal(entries.length,0);
});
test('journal titles, summaries, rich text and media captions translate on save and unchanged sources are reused',async t=>{
 const {request,entries,files,translationCalls}=await journalFixture(t,{autoTranslate:true}),file=randomUUID();files.set(file,{id:file,type:'image/png',bytes:Buffer.from('png')});
 const input={section:'blog',slug:'mi-historia',title:{es:'Mi historia'},summary:{es:'Un viaje creativo'},status:'draft',blocks:[{id:randomUUID(),kind:'text',text:{es:'Un <strong>mundo</strong> de color'}},{id:randomUUID(),kind:'image',file,caption:{es:'El equipo creando'}}]};
 const r=await request('/api/journal/entries','POST',input);assert.equal(r.status,201);const saved=await r.json();assert.equal(saved.title.en,'EN Mi historia');assert.equal(saved.summary.fr,'FR Un viaje creativo');assert.equal(saved.blocks[0].text.fr,'FR Un <strong>mundo</strong> de color');assert.equal(saved.blocks[1].caption.en,'EN El equipo creando');assert.equal(translationCalls.length,1);
 assert.equal((await request('/api/journal/entries/'+saved.id,'PATCH',{...input,status:'published'})).status,200);assert.equal(entries[0].status,'published');assert.equal(translationCalls.length,1);
});
test('optional media descriptions use existing localized defaults or translate Spanish only, and unauthorized users never invoke translation',async t=>{
 const {request,files,mediaRows,translationCalls}=await journalFixture(t,{autoTranslate:true}),file=randomUUID();files.set(file,{id:file,type:'image/png',bytes:Buffer.from('png')});
 let r=await request('/api/media','POST',{placement:'hero',image:file});assert.equal(r.status,201);assert.equal(translationCalls.length,0);assert.ok(mediaRows[0].alt_en);
 r=await request('/api/media/'+mediaRows[0].id,'PATCH',{alt_es:'Una animación de nuestro equipo'});assert.equal(r.status,200);assert.equal(mediaRows[0].alt_fr,'FR Una animación de nuestro equipo');assert.equal(translationCalls.length,1);
 const readonly=await journalFixture(t,{autoTranslate:true,readonly:true});assert.equal((await readonly.request('/api/texts','PATCH',{items:[{id:readonly.texts[0].id,es:'Texto privado'}]})).status,403);assert.equal((await readonly.request('/api/journal/entries','POST',{section:'book',slug:'proyecto',title:{es:'Proyecto'},summary:{},blocks:[],status:'draft'})).status,403);assert.equal(readonly.translationCalls.length,0);
});
