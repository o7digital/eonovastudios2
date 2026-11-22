import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {journalFixture} from '../../tests/helpers/journal-fixture.mjs';
import {validateJournalEntry} from './journal.mjs';
const entry=()=>({section:'blog',slug:'mi-publicacion',title:{es:'Mi publicación'},summary:{},status:'published',blocks:[{id:randomUUID(),kind:'text',text:{es:'Mi <strong>contenido</strong>'}}]});
test('editorial API preserves content when sections are disabled and persists drafts, publication and archives',async t=>{
 const {request,entries,sections}=await journalFixture(t);
 let r=await request('/api/journal/sections/blog','PATCH',{enabled:true});assert.equal(r.status,200);
 r=await request('/api/journal/entries','POST',entry());assert.equal(r.status,201);const saved=await r.json();assert.ok(saved.published_on);assert.equal(saved.title.en,'');
 const changed={...entry(),status:'draft'};r=await request('/api/journal/entries/'+saved.id,'PATCH',changed);assert.equal(r.status,200);assert.equal(entries[0].status,'draft');
 assert.equal((await request('/api/journal/sections/blog','PATCH',{enabled:false})).status,200);assert.equal(sections[0].enabled,false);assert.equal(entries.length,1);
 assert.equal((await request('/api/journal/entries/'+saved.id,'PATCH',{...changed,status:'archived'})).status,200);assert.equal(entries[0].status,'archived');
 assert.equal((await request('/api/journal/entries','POST',entry())).status,409);
});
test('editorial API rejects forged requests, foreign keys, unsupported media and invalid blocks before saving',async t=>{
 const {base,request,entries,files,cookie}=await journalFixture(t);
 assert.equal((await fetch(base+'/api/journal')).status,401);
 assert.equal((await fetch(base+'/api/journal/sections/blog',{method:'PATCH',headers:{Cookie:cookie,Origin:'https://foreign.example','Content-Type':'application/json'},body:'{"enabled":true}'})).status,403);
 for(const value of [{...entry(),section:'other'},{...entry(),slug:'../private'},{...entry(),id:randomUUID()},{...entry(),blocks:[]},{...entry(),blocks:[{id:randomUUID(),kind:'iframe',src:'x'}]}])assert.throws(()=>validateJournalEntry(value));
 const id=randomUUID();files.set(id,{id,type:'application/pdf',bytes:Buffer.from('pdf')});const value=entry();value.blocks=[{id:randomUUID(),kind:'video',file:id}];assert.equal((await request('/api/journal/entries','POST',value)).status,400);assert.equal(entries.length,0);
});
test('read-only accounts can inspect sections but cannot activate or create publications',async t=>{
 const {request}=await journalFixture(t,{readonly:true});assert.equal((await request('/api/journal')).status,200);
 assert.equal((await request('/api/journal/sections/blog','PATCH',{enabled:true})).status,403);assert.equal((await request('/api/journal/entries','POST',entry())).status,403);
});
