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
