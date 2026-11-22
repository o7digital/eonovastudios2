import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyCopy, cleanCopy, loadCms, validateRows } from '../src/lib/cms.mjs';
import publish from '../api/cms-publish.mjs';

test('CMS edits only text and inline fragments, never attributes or scripts', () => {
  const rows = [{source:'Hola',es:'Nuevo <em>texto</em><script>alert(1)</script>',en:'Hello new',fr:'Bonjour neuf'}];
  const html = '<a title="Hola" href="/Hola">Hola</a><script>const s="Hola";</script><style>.Hola{}</style>';
  assert.equal(applyCopy(html,rows,'es',{}),'<a title="Hola" href="/Hola">Nuevo <em>texto</em></a><script>const s="Hola";</script><style>.Hola{}</style>');
  assert.equal(applyCopy('<h1>Bonjour</h1>',rows,'fr',{Hola:{fr:'Bonjour'}}),'<h1>Bonjour neuf</h1>');
  assert.equal(applyCopy('<p>A<br><em>B</em></p>',[{source:'A<br><em>B</em>',es:'X<br><strong>Y</strong>'}],'es',{}),'<p>X<br><strong>Y</strong></p>');
  assert.equal(cleanCopy('<img src=x onerror=alert(1)><span onclick="alert(1)">Safe</span>'),'<span>Safe</span>');
});

test('CMS validates translations and fails closed when a configured backend is unavailable', async () => {
  assert.deepEqual(await loadCms(),{rows:[],media:{}});
  await assert.rejects(loadCms({url:'https://cms.example'}),/TOKEN/);
  await assert.rejects(loadCms({url:'https://cms.example',token:'private',fetcher:async()=>new Response('',{status:503})}),/503/);
  assert.throws(()=>validateRows([{source:'A',es:'A',en:'',fr:'B'}]),/Invalid/);
  assert.throws(()=>validateRows(Array(2).fill({source:'A',es:'A',en:'B',fr:'C'})),/duplicate/);
});

test('publishing requires its server secret and creates only the fixed EON production deployment', async () => {
  const saved = {fetch:globalThis.fetch,secret:process.env.CMS_PUBLISH_SECRET,token:process.env.VERCEL_DEPLOY_TOKEN};
  const res = () => ({setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
  process.env.CMS_PUBLISH_SECRET='secret';process.env.VERCEL_DEPLOY_TOKEN='private-vercel';
  try {
    globalThis.fetch=()=>{throw new Error('Unauthorized requests must not reach Vercel');};
    for (const [req,code] of [[{method:'GET',headers:{}},405],[{method:'POST',headers:{}},401]]) {const r=res();await publish(req,r);assert.equal(r.code,code);}
    let calls=0;
    globalThis.fetch=async(url,options)=>{
      assert.equal(options.headers.Authorization,'Bearer private-vercel');
      if (++calls===1) return Response.json({deployments:[]});
      const body=JSON.parse(options.body);assert.equal(body.target,'production');assert.equal(body.gitSource.ref,'dev');assert.equal(body.project,'prj_bSppuywI4jwUlMZjBdHOwQ0b394s');
      return Response.json({id:'deployment'});
    };
    const r=res();await publish({method:'POST',headers:{authorization:'Bearer secret'},body:{project:'other',ref:'main'}},r);
    assert.equal(r.code,202);assert.equal(r.body.id,'deployment');assert.equal(JSON.stringify(r.body).includes('private-vercel'),false);
    globalThis.fetch=async()=>Response.json({deployments:[{state:'BUILDING'}]});
    const pending=res();await publish({method:'POST',headers:{authorization:'Bearer secret'}},pending);assert.equal(pending.code,202);assert.match(pending.body.message,/already/);
  } finally {
    globalThis.fetch=saved.fetch;
    for (const [key,value] of [['CMS_PUBLISH_SECRET',saved.secret],['VERCEL_DEPLOY_TOKEN',saved.token]]) {if(value===undefined) delete process.env[key];else process.env[key]=value;}
  }
});

test('CMS publishes private video assets and logo framing, rejects invalid types and duplicate placements', async t => {
  const {mkdtemp,rm,readFile}=await import('node:fs/promises');
  const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {pathToFileURL}=await import('node:url');
  const folder=await mkdtemp(join(tmpdir(),'eon-cms-'));t.after(()=>rm(folder,{recursive:true,force:true}));
  let media=[{placement:'studio',image:{id:'video-file',type:'video/mp4'},alt_es:'Video',alt_en:'Video',alt_fr:'Vidéo',position:'25% 75%',fit:'contain'}];
  const bytes=Buffer.from('video-fixture');
  const fetcher=async(url,options)=>{
    assert.equal(options.headers.Authorization,'Bearer private');
    const path=new URL(url).pathname;
    if(path==='/items/site_texts')return Response.json({data:[{source:'Hola',es:'Hola',en:'Hello',fr:'Bonjour'}]});
    if(path==='/items/section_media')return Response.json({data:media});
    return new Response(bytes);
  };
  const options={url:'https://cms.example',token:'private',fetcher,output:pathToFileURL(folder+'/')};
  const loaded=await loadCms(options);
  assert.equal(loaded.media.studio.type,'video/mp4');assert.equal(loaded.media.studio.position,'25% 75%');assert.equal(loaded.media.studio.fit,'contain');
  assert.match(loaded.media.studio.src,/^\/_cms\/[a-f\d]+\.mp4$/);
  assert.deepEqual(await readFile(join(folder,loaded.media.studio.src.split('/').at(-1))),bytes);
  media=[{...media[0],placement:'logo'}];await assert.rejects(loadCms(options),/logo/);
  media=[{...media[0],image:{id:'logo',type:'image/png'},position:'101% 0%'}];await assert.rejects(loadCms(options),/position/);
  media=[{...media[0],position:'50% 50%',fit:'contain'}];assert.equal((await loadCms(options)).media.logo.type,'image/png');
  media.push(media[0]);await assert.rejects(loadCms(options),/duplicate/);
});

test('CMS annotations keep edited text identifiable across publication without changing attributes or scripts',()=>{
 const row={source:'Hola <em>mundo</em>',es:'Nuevo <strong>mundo</strong>',en:'Hello',fr:'Bonjour'};
 const output=applyCopy('<h1>Hola <em>mundo</em></h1>',[row],'es',{}, {annotate:true});
 assert.match(output,/data-eon-source="Hola &lt;em&gt;mundo&lt;\/em&gt;"/);
 assert.match(output,/>Nuevo <strong>mundo<\/strong><\/h1>/);
});
