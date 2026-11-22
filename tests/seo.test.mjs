import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isIndexable,robotsText,pageSeo,schemaJson,SITE_URL,PUBLIC_PATHS} from '../src/lib/seo.mjs';

test('only opted-in production builds allow indexing, including when a preview inherits the flag',()=>{
  assert.equal(isIndexable({VERCEL_ENV:'production',SITE_INDEXABLE:'true'}),true);
  for(const env of [{},{SITE_INDEXABLE:'true'},{VERCEL_ENV:'preview',SITE_INDEXABLE:'true'},{VERCEL_ENV:'production',SITE_INDEXABLE:'false'}]){
    assert.equal(isIndexable(env),false);assert.equal(robotsText(env),'User-agent: *\nDisallow: /\n');
  }
  const robots=robotsText({VERCEL_ENV:'production',SITE_INDEXABLE:'true'});
  assert.match(robots,/Allow: \/\n/);assert.match(robots,/Disallow: \/admin/);assert.match(robots,/Sitemap: https:\/\/www\.eonovastudios\.com\/sitemap-index.xml/);
});

test('every public page has final canonical URLs, reciprocal language links and factual studio structured data',()=>{
  for(const lang of ['es','en','fr'])for(const legal of [false,true]){
    const seo=pageSeo({lang,legal,pageTitle:legal?'Privacy':undefined,logo:'/_cms/logo.webp'});
    assert.ok(PUBLIC_PATHS.includes(new URL(seo.url).pathname));assert.equal(new URL(seo.url).origin,SITE_URL);
    assert.deepEqual(seo.alternates.map(link=>link.lang),['es','en','fr','x-default']);
    assert.ok(seo.alternates.every(link=>link.url.startsWith(SITE_URL+'/')));
    const organization=seo.schema['@graph'].find(item=>item['@type']==='Organization');
    assert.equal(organization.email,'info@eonovastudios.com');assert.equal(organization.logo,SITE_URL+'/_cms/logo.webp');
    assert.equal(organization.address,undefined);assert.equal(organization.telephone,undefined);
    assert.ok(seo.schema['@graph'].some(item=>item['@type']==='WebPage'&&item.url===seo.url));
    if(legal)assert.notEqual(seo.description,pageSeo({lang}).description);
  }
  assert.throws(()=>pageSeo({lang:'other'}),/Unsupported/);
});


test('structured data safely escapes HTML without changing its JSON content',()=>{
  const value={name:'A </script><script>alert(1)</script>'};
  const serialized=schemaJson(value);assert.ok(!serialized.includes('<'));assert.deepEqual(JSON.parse(serialized),value);
});
