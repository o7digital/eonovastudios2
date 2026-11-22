import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStudioServer } from './server.mjs';

const id = '12345678-1234-4123-a123-123456789012';
const row = {id,label:'Titre',source:'Hola',section:'hero',es:'Hola',en:'Hello',fr:'Bonjour',status:'published',sort:0};
const origin = 'https://studio.example';
async function fixture(t, options = {}) {
  const calls=[];let temporary=options.temporary===true;
  const fetcher=async(url, request)=>{
    const path=new URL(url).pathname;calls.push({path,...request});
    const result=data=>Response.json({data});
    if(path==='/auth/login'&&options.wrongPassword&&JSON.parse(request.body).password==='wrong-password')return Response.json({},{status:401});
    if(path==='/auth/login'||path==='/auth/refresh')return result({access_token:'private-access-token',refresh_token:'private-refresh-token',expires:options.expires??3600000});
    if(path==='/users/'+id){if(request.method==='PATCH')temporary=JSON.parse(request.body).studio_password_temporary;return result({id,studio_password_temporary:temporary});}
    if(path==='/users/me')return result({id,email:'owner@example.com',first_name:'Eon',last_name:'Owner'});
    if(path==='/permissions/me')return result({site_texts:{update:{access:options.readonly?'none':'full'}}});
    if(path==='/items/site_texts'){
      if(request.method==='PATCH'){
        if(options.readonly)return Response.json({}, {status:403});
        return result(JSON.parse(request.body).map(item=>({...row,...item})));
      }
      return result([row]);
    }
    if(path==='/items/section_media')return result([]);
    if(path==='/folders')return result([]);
    if(new URL(url).origin==='https://www.eonovastudios.com')return new Response('<!doctype html><html><head></head><body><main>Preview</main><script>window.forbidden=true</script></body></html>',{headers:{'Content-Type':'text/html'}});
    if(path==='/auth/logout')return new Response(null,{status:204});
    throw new Error('Unexpected upstream path '+path);
  };
  const server=createStudioServer({cms:'https://cms.example',origin,secret:'a-secure-test-session-key-with-more-than-32-characters',secure:true,fetcher,publishEnabled:false,accountToken:options.accounts?'private-account-writer':undefined});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
  const base=`http://127.0.0.1:${server.address().port}`;
  const request=(path,options={})=>fetch(base+path,{...options,headers:{Origin:origin,'Content-Type':'application/json',...options.headers}});
  const login=()=>request('/api/login',{method:'POST',body:JSON.stringify({email:'owner@example.com',password:'private-password'})});
  return {request,login,calls};
}

test('Studio isolates tokens in encrypted HttpOnly cookies and rejects unauthenticated access and forged writes',async t=>{
  const {request,login,calls}=await fixture(t);
  assert.equal((await request('/api/bootstrap')).status,401);
  assert.equal((await request('/api/login',{method:'POST',headers:{Origin:'https://other.example'},body:'{}'})).status,403);
  assert.equal(calls.length,0);
  const response=await login();assert.equal(response.status,200);
  const setCookie=response.headers.get('set-cookie');assert.match(setCookie,/HttpOnly/);assert.match(setCookie,/Secure/);assert.match(setCookie,/SameSite=Strict/);
  assert.ok(!setCookie.includes('private-access-token'));assert.ok(!setCookie.includes('private-refresh-token'));
  assert.deepEqual(await response.json(),{ok:true});
  const cookie=setCookie.split(';')[0];
  const bootstrap=await request('/api/bootstrap',{headers:{Cookie:cookie}});assert.equal(bootstrap.status,200);
  const data=await bootstrap.json();assert.equal(data.texts[0].fr,'Bonjour');assert.equal(data.canEdit,true);assert.equal(data.publishReady,false);
  assert.ok(!JSON.stringify(data).includes('private-access-token'));
  assert.equal((await request('/api/texts',{method:'PATCH',headers:{Cookie:cookie,Origin:'https://forged.example'},body:JSON.stringify({items:[{id,fr:'Test'}]})})).status,403);
  const forged=cookie.slice(0,-5)+'aaaaa';assert.equal((await request('/api/bootstrap',{headers:{Cookie:forged}})).status,401);
  assert.equal((await request('/server.mjs')).status,404);
  assert.equal((await request('/api/texts',{method:'DELETE',headers:{Cookie:cookie}})).status,405);
});

test('Studio allows only content fields, validates an entire batch before writing, and keeps deferred publishing disabled',async t=>{
  const {request,login,calls}=await fixture(t);const cookie=(await login()).headers.get('set-cookie').split(';')[0];
  const patch=items=>request('/api/texts',{method:'PATCH',headers:{Cookie:cookie},body:JSON.stringify({items})});
  assert.equal((await patch([{id,source:'replace immutable source'}])).status,400);
  assert.equal((await patch([{id,fr:'Valid'},{id:'bad-id',fr:'Invalid'}])).status,400);
  assert.equal((await patch([{id,fr:''}])).status,400);
  assert.equal(calls.filter(call=>call.method==='PATCH').length,0);
  const saved=await patch([{id,fr:'Nouveau texte'}]);assert.equal(saved.status,200);assert.equal((await saved.json())[0].fr,'Nouveau texte');
  const write=calls.find(call=>call.method==='PATCH');assert.equal(write.headers.Authorization,'Bearer private-access-token');assert.equal(write.path,'/items/site_texts');
  assert.equal((await request('/api/publish',{method:'POST',headers:{Cookie:cookie},body:'{}'})).status,409);
  assert.equal((await request('/api/upload',{method:'POST',headers:{Cookie:cookie,'Content-Type':'image/svg+xml'},body:'<svg/>'})).status,415);
  assert.equal((await request('/api/media',{method:'POST',headers:{Cookie:cookie},body:JSON.stringify({placement:'studio',image:'https://other.example'})})).status,400);
  const logout=await request('/api/logout',{method:'POST',headers:{Cookie:cookie},body:'{}'});assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
});

test('Studio preserves the logged-in identity permissions and refreshes expiring sessions',async t=>{
  const {request,login,calls}=await fixture(t,{readonly:true,expires:0});const cookie=(await login()).headers.get('set-cookie').split(';')[0];
  const bootstrap=await request('/api/bootstrap',{headers:{Cookie:cookie}});assert.equal((await bootstrap.json()).canEdit,false);
  assert.ok(calls.some(call=>call.path==='/auth/refresh'));
  const denied=await request('/api/texts',{method:'PATCH',headers:{Cookie:cookie},body:JSON.stringify({items:[{id,fr:'Not authorized'}]})});assert.equal(denied.status,403);
  assert.equal(calls.find(call=>call.method==='PATCH').headers.Authorization,'Bearer private-access-token');
});


test('visual preview requires authentication, fixes its target, and disables scripts inside the same-origin frame',async t=>{
 const {request,login,calls}=await fixture(t);
 assert.equal((await request('/api/preview?lang=es')).status,401);
 const cookie=(await login()).headers.get('set-cookie').split(';')[0];
 assert.equal((await request('/api/preview?lang=other',{headers:{Cookie:cookie}})).status,400);
 const preview=await request('/api/preview?lang=fr&url=https://other.example',{headers:{Cookie:cookie}});
 assert.equal(preview.status,200);assert.equal(preview.headers.get('x-frame-options'),'SAMEORIGIN');
 assert.match(preview.headers.get('content-security-policy'),/script-src 'none'/);
 assert.match(preview.headers.get('content-security-policy'),/frame-ancestors 'self'/);
 assert.match(await preview.text(),/<base href="https:\/\/www.eonovastudios.com\//);
 assert.equal(calls.at(-1).path,'/fr/');
 const library=await request('/api/library',{headers:{Cookie:cookie}});assert.equal(library.status,200);assert.deepEqual(await library.json(),[]);
});


test('temporary passwords allow Studio access and optional verified changes target only the signed-in user',async t=>{
 const {request,login,calls}=await fixture(t,{accounts:true,temporary:true});
 const cookie=(await login()).headers.get('set-cookie').split(';')[0];
 const headers={Cookie:cookie};
 const bootstrap=await(await request('/api/bootstrap',{headers})).json();
 assert.equal(bootstrap.profile.passwordTemporary,true);assert.equal(bootstrap.canEdit,true);
 assert.equal((await request('/api/texts',{method:'PATCH',headers,body:JSON.stringify({items:[{id,es:'Temporary account edit'}]})})).status,200);
 assert.equal((await request('/api/account/password',{method:'POST',headers:{...headers,Origin:'https://forged.example'},body:'{}'})).status,403);
 const changed=await request('/api/account/password',{method:'POST',headers,body:JSON.stringify({currentPassword:'private-password',newPassword:'my-new-private-password'})});
 assert.equal(changed.status,200);assert.equal((await changed.json()).ok,true);
 const written=calls.find(call=>call.path==='/users/'+id&&call.method==='PATCH');
 assert.deepEqual(JSON.parse(written.body),{password:'my-new-private-password',studio_password_temporary:false});
 assert.equal(written.headers.Authorization,'Bearer private-account-writer');
 const newCookie=changed.headers.get('set-cookie');assert.match(newCookie,/HttpOnly/);assert.ok(!newCookie.includes('my-new-private-password'));
 const unlocked=await(await request('/api/bootstrap',{headers:{Cookie:newCookie.split(';')[0]}})).json();
 assert.equal(unlocked.profile.passwordTemporary,false);assert.equal(unlocked.canEdit,true);
});

test('account password changes reject injected targets, short passwords and incorrect current passwords before writing',async t=>{
 const {request,login,calls}=await fixture(t,{accounts:true,wrongPassword:true});
 const cookie=(await login()).headers.get('set-cookie').split(';')[0],headers={Cookie:cookie};
 const change=body=>request('/api/account/password',{method:'POST',headers,body:JSON.stringify(body)});
 for(const input of [
  {currentPassword:'private-password',newPassword:'short'},
  {currentPassword:'private-password',newPassword:'private-password'},
  {currentPassword:'private-password',newPassword:'new-private-password',id:'someone-else'},
  {currentPassword:'wrong-password',newPassword:'new-private-password'},
 ])assert.equal((await change(input)).status,400);
 assert.equal(calls.filter(call=>call.path==='/users/'+id&&call.method==='PATCH').length,0);
 for(let i=0;i<4;i++)assert.equal((await change({currentPassword:'wrong-password',newPassword:'new-private-password'})).status,400);
 assert.equal((await change({currentPassword:'wrong-password',newPassword:'new-private-password'})).status,429);
});
