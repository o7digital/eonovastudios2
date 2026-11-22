import test from 'node:test';
import assert from 'node:assert/strict';
import {createAutoTranslator,protectTranslationSource,translationHash,parseTranslationReply,validateTranslationItems,TranslationError} from './translation.mjs';

test('translation protects colors, markup, names, URLs and literal placeholder text',()=>{
 const source='<strong>Hola &amp; adiós</strong> <span style="color:#ff00aa">EON NOVA</span> https://example.com/book?x=1&amp;y=2 [[EON_19]]';
 const prepared=protectTranslationSource(source,'html');
 assert.ok(!prepared.text.includes('<strong>'));assert.ok(!prepared.text.includes('#ff00aa'));assert.ok(!prepared.text.includes('example.com'));
 assert.equal(prepared.restore(prepared.text.replace('Hola & adiós','Hello & goodbye')),'<strong>Hello &amp; goodbye</strong> <span style="color:#ff00aa">EON NOVA</span> https://example.com/book?x=1&amp;y=2 [[EON_19]]');
 const adjacent=protectTranslationSource('<b>https://example.com</b> escribe','html');assert.equal(adjacent.restore(adjacent.text),'<b>https://example.com</b> escribe');
});
test('translation rejects missing, duplicated or reordered protected content and invalid payloads',()=>{
 const items=[{id:'0',text:'[[EON_0]] Hola [[EON_1]]'}];
 for(const translations of [[],[{id:'0',en:'Hello',fr:'Bonjour'}],[{id:'0',en:'[[EON_1]] Hello [[EON_0]]',fr:items[0].text}]])assert.throws(()=>parseTranslationReply({translations},items),TranslationError);
 assert.throws(()=>validateTranslationItems([{id:'0',text:'a'.repeat(8001)}]),TranslationError);
 assert.throws(()=>validateTranslationItems([{id:'0',text:'Hola'},{id:'0',text:'Hola'}]),TranslationError);
});
test('automatic translation batches both languages, preserves formatting, and reuses unchanged Spanish sources',async()=>{
 const calls=[],translator=createAutoTranslator({enabled:true,url:'https://translate.example',key:'test',fetcher:async(url,options)=>{calls.push(JSON.parse(options.body));assert.equal(options.headers.Authorization,'Bearer test');return Response.json({translations:calls.at(-1).items.map(item=>({id:item.id,en:item.text.replaceAll('Hola','Hello'),fr:item.text.replaceAll('Hola','Bonjour')}))});}});
 const group={key:'text',value:{es:'<span style="color:#ff00aa">Hola</span> EON NOVA'},format:'html'};
 const hashes=await translator.apply([group],'editor');assert.equal(group.value.fr,'<span style="color:#ff00aa">Bonjour</span> EON NOVA');assert.equal(group.value.en,'<span style="color:#ff00aa">Hello</span> EON NOVA');assert.equal(calls.length,1);
 await translator.apply([{...group,value:{es:group.value.es},previous:group.value,previousHash:hashes.text}]);assert.equal(calls.length,1);
 await translator.apply([{key:'cached',value:{es:group.value.es},format:'html'}]);assert.equal(calls.length,1);
 const empty={key:'empty',value:{es:'',en:'old',fr:'old'}};await translator.apply([empty]);assert.equal(empty.value.en,'');assert.equal(calls.length,1);
 const brand={key:'brand',value:{es:'EON NOVA #ffaa00 2026'}};await translator.apply([brand]);assert.equal(brand.value.fr,brand.value.es);assert.equal(calls.length,1);
 assert.equal(hashes.text,translationHash(group.value.es,'html'));
});
test('translation splits long rich text without breaking tags and rejects provider failures before returning',async()=>{
 let calls=0;const fetcher=async(url,options)=>{calls++;return Response.json({translations:JSON.parse(options.body).items.map(item=>({...item,en:item.text,fr:item.text})).map(({text,...rest})=>rest)});};
 const translator=createAutoTranslator({enabled:true,url:'https://translate.example',key:'test',fetcher});const value={es:'<b>'+('Hola '.repeat(2100))+'</b>'};await translator.apply([{key:'long',value,format:'html'}]);assert.equal(value.en,value.es);assert.ok(calls>=2);
 const bad=createAutoTranslator({enabled:true,url:'https://translate.example',key:'test',fetcher:async()=>new Response('',{status:503})});const unchanged={es:'Hola',en:'old',fr:'old'};await assert.rejects(bad.apply([{key:'fail',value:unchanged}]),TranslationError);assert.equal(unchanged.en,'old');
});
test('provider uses the existing account with strict JSON output, no stored response and validated translations',async()=>{
 const {createTranslationProvider}=await import('./translation.mjs');let request;
 const translate=createTranslationProvider({apiKey:'private-provider-key',model:'configured-model',fetcher:async(url,options)=>{request={url,options,body:JSON.parse(options.body)};return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({translations:[{id:'0',en:'Hello',fr:'Bonjour'}]})}]}]});}});
 assert.deepEqual(await translate([{id:'0',text:'Hola'}]),[{id:'0',en:'Hello',fr:'Bonjour'}]);assert.equal(request.url,'https://api.openai.com/v1/responses');assert.equal(request.body.store,false);assert.equal(request.body.text.format.strict,true);assert.equal(request.body.model,'configured-model');assert.equal(request.body.input,JSON.stringify([{id:'0',text:'Hola'}]));assert.equal(request.options.headers.Authorization,'Bearer private-provider-key');
 for(const payload of [{status:'incomplete',output_text:'{}'},{status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'No'}]}]}]){const fail=createTranslationProvider({apiKey:'private',model:'model',fetcher:async()=>Response.json(payload)});await assert.rejects(fail([{id:'0',text:'Hola'}]),TranslationError);}
});
