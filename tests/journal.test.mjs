import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import sharp from 'sharp';
import {loadJournal,journalRoutes,emptyJournal} from '../src/lib/journal.mjs';
import {journalPath,journalText} from '../cms/studio/public/journal-data.js';
import {alternateLinks,pageSeo} from '../src/lib/seo.mjs';
test('disabled sections expose no routes or draft content; localized editorial paths have reciprocal canonicals',()=>{
 assert.equal(journalRoutes(emptyJournal()).length,0);assert.equal(journalText({es:'Español',en:''},'en'),'Español');
 const data={sections:[{id:'blog',enabled:true},{id:'news',enabled:false}],entries:[{section:'blog',status:'published',slug:'nuevo'},{section:'blog',status:'draft',slug:'privado'},{section:'news',status:'published',slug:'oculto'}]};
 assert.equal(journalRoutes(data).length,6);assert.ok(journalRoutes(data).every(r=>!r.path.includes('privado')&&!r.path.includes('oculto')));
 const path=journalPath('news','fr','un-proyecto');assert.equal(path,'/fr/actualites/un-proyecto/');assert.equal(alternateLinks(path)[1].url,'https://www.eonovastudios.com/en/news/un-proyecto/');assert.equal(pageSeo({lang:'fr',path,pageTitle:'Actualité'}).url,'https://www.eonovastudios.com'+path);
});
test('editorial loader publishes only enabled sections, copies media into the build and never ships CMS credentials',async t=>{
 const folder=await mkdtemp(tmpdir()+'/eon-journal-');t.after(()=>rm(folder,{recursive:true,force:true}));
 const image='12345678-1234-4123-a123-123456789012',video='12345678-1234-4123-a123-123456789013',png=await sharp({create:{width:32,height:24,channels:3,background:'#9aee68'}}).png().toBuffer();
 const assetBytes=Buffer.from('fixture-video');let enabled=true;
 const fetcher=async(url,options)=>{assert.equal(options.headers.Authorization,'Bearer private-editorial-token');const path=new URL(url).pathname;
  if(path==='/items/journal_sections')return Response.json({data:enabled?[{id:'book',enabled:true}]:[]});
  if(path==='/items/journal_entries')return Response.json({data:[{id:'entry',section:'book',status:'published',slug:'proyecto',title:{es:'Mi proyecto'},blocks:[{kind:'text',text:{es:'Hola'}},{kind:'image',file:image},{kind:'video',file:video}]},{section:'news',status:'published',slug:'oculto',title:{es:'Privado'},blocks:[]},{section:'book',status:'draft',slug:'borrador'}]});
  if(path.startsWith('/files/'))return Response.json({data:{type:path.endsWith(image)?'image/png':'video/mp4',filesize:100}});
  return new Response(path.endsWith(image)?png:assetBytes);
 };
 const data=await loadJournal({url:'https://cms.example',token:'private-editorial-token',fetcher,output:pathToFileURL(folder+'/')});assert.equal(data.entries.length,1);assert.equal(data.entries[0].blocks[1].media.type,'image/webp');assert.deepEqual(await readFile(folder+'/'+data.entries[0].blocks[2].media.src.split('/').at(-1)),assetBytes);assert.ok(!JSON.stringify(data).includes('private-editorial-token'));
 enabled=false;const hidden=await loadJournal({url:'https://cms.example',token:'private-editorial-token',fetcher});assert.deepEqual(hidden,{sections:[],entries:[]});
});
