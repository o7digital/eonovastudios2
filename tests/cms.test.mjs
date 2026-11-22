import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyCopy, cleanCopy, loadCms, validateRows } from '../src/lib/cms.mjs';
import publish from '../api/cms-publish.mjs';
import sharp from 'sharp';
import {normalizeTextColor} from '../cms/studio/public/text-color.js';

test('text colors survive public rendering while other CSS and executable attributes are removed',()=>{
  assert.equal(normalizeTextColor('#F60'),'#ff6600');
  assert.equal(normalizeTextColor('rgb(51, 102, 204)'),'#3366cc');
  for(const value of ['red','#abcd','rgb(256, 0, 0)','url(https://example.com)','var(--color)'])assert.equal(normalizeTextColor(value),null);
  const copy='<span style="color:rgb(255, 102, 0);background:url(https://example.com);position:fixed" onclick="alert(1)">Ideas</span> <em style="color:#36C">moving</em><font color="#F60">!</font>';
  const clean='<span style="color:#ff6600">Ideas</span> <em style="color:#3366cc">moving</em><span style="color:#ff6600">!</span>';
  assert.equal(cleanCopy(copy),clean);
  assert.equal(cleanCopy('<span style="color:expression(alert(1));background:red" onmouseover="x()">Safe</span><script>alert(1)</script>'),'<span>Safe</span>');
  for(const lang of ['es','en','fr']){
    const row={source:'Original',es:copy,en:copy,fr:copy};
    assert.equal(applyCopy('<h1>Original</h1>',[row],lang,{}),'<h1>'+clean+'</h1>');
  }
});

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
  const png=await sharp({create:{width:80,height:40,channels:4,background:{r:25,g:100,b:40,alpha:0.5}}}).png().toBuffer();
  const fetcher=async(url,options)=>{
    assert.equal(options.headers.Authorization,'Bearer private');
    const path=new URL(url).pathname;
    if(path==='/items/site_texts')return Response.json({data:[{source:'Hola',es:'Hola',en:'Hello',fr:'Bonjour'}]});
    if(path==='/items/section_media')return Response.json({data:media});
    return new Response(media[0]?.image.type==='image/png'?png:bytes);
  };
  const options={url:'https://cms.example',token:'private',fetcher,output:pathToFileURL(folder+'/')};
  const loaded=await loadCms(options);
  assert.equal(loaded.media.studio.type,'video/mp4');assert.equal(loaded.media.studio.position,'25% 75%');assert.equal(loaded.media.studio.fit,'contain');
  assert.match(loaded.media.studio.src,/^\/_cms\/[a-f\d]+\.mp4$/);
  assert.deepEqual(await readFile(join(folder,loaded.media.studio.src.split('/').at(-1))),bytes);
  media=[{...media[0],placement:'logo'}];await assert.rejects(loadCms(options),/logo/);
  media=[{...media[0],image:{id:'logo',type:'image/png'},position:'101% 0%'}];await assert.rejects(loadCms(options),/position/);
  media=[{...media[0],position:'50% 50%',fit:'contain'}];assert.equal((await loadCms(options)).media.logo.type,'image/webp');
  media=[{...media[0],logo_size:120,alt_es:'',alt_en:null,alt_fr:undefined}];
  const optionalDescriptions=await loadCms(options);assert.equal(optionalDescriptions.media.logo.size,120);
  for(const lang of ['es','en','fr'])assert.equal(optionalDescriptions.media.logo.alt[lang],'EON NOVA Studios');
  media.push(media[0]);await assert.rejects(loadCms(options),/duplicate/);
});

test('CMS publication uses a private EON deploy hook without a permanent Vercel token', async () => {
  const savedFetch=globalThis.fetch;
  const keys=['CMS_PUBLISH_SECRET','VERCEL_DEPLOY_TOKEN','CMS_DEPLOY_HOOK_URL'];
  const saved=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  const res=()=>({setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
  const req={method:'POST',headers:{authorization:'Bearer hook-test-secret'},body:{url:'https://other.example'}};
  try {
    process.env.CMS_PUBLISH_SECRET='hook-test-secret';
    delete process.env.VERCEL_DEPLOY_TOKEN;
    process.env.CMS_DEPLOY_HOOK_URL='https://api.vercel.com/v1/integrations/deploy/prj_bSppuywI4jwUlMZjBdHOwQ0b394s/private-hook';
    let calls=0;
    globalThis.fetch=async(url,options)=>{
      calls++;
      assert.equal(url.origin,'https://api.vercel.com');
      assert.equal(url.searchParams.get('buildCache'),'false');
      assert.equal(options.method,'POST');
      assert.equal(options.redirect,'error');
      assert.equal(options.headers,undefined);
      return calls===1?Response.json({error:'upstream failed'},{status:503}):Response.json({job:{id:'publication-job',state:'PENDING'}});
    };
    const unauthorized=res();await publish({method:'POST',headers:{}},unauthorized);assert.equal(unauthorized.code,401);assert.equal(calls,0);
    process.env.CMS_DEPLOY_HOOK_URL='https://other.example/v1/integrations/deploy/prj_bSppuywI4jwUlMZjBdHOwQ0b394s/private-hook';
    const invalid=res();await publish(req,invalid);assert.equal(invalid.code,502);assert.equal(calls,0);
    process.env.CMS_DEPLOY_HOOK_URL=saved.CMS_DEPLOY_HOOK_URL||'https://api.vercel.com/v1/integrations/deploy/prj_bSppuywI4jwUlMZjBdHOwQ0b394s/private-hook';
    const failed=res();await publish(req,failed);assert.equal(failed.code,502);
    const started=res();await publish(req,started);assert.equal(started.code,202);assert.equal(started.body.id,'publication-job');
    assert.ok(!JSON.stringify(started.body).includes('private-hook'));
    const repeated=res();await publish(req,repeated);assert.equal(repeated.code,429);assert.equal(calls,2);
  } finally {
    globalThis.fetch=savedFetch;
    for (const key of keys) {if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}
  }
});

test('CMS annotations keep edited text identifiable across publication without changing attributes or scripts',()=>{
 const row={source:'Hola <em>mundo</em>',es:'Nuevo <strong>mundo</strong>',en:'Hello',fr:'Bonjour'};
 const output=applyCopy('<h1>Hola <em>mundo</em></h1>',[row],'es',{}, {annotate:true});
 assert.match(output,/data-eon-source="Hola &lt;em&gt;mundo&lt;\/em&gt;"/);
 assert.match(output,/>Nuevo <strong>mundo<\/strong><\/h1>/);
});
