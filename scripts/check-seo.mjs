import {readFile} from 'node:fs/promises';
import {parse} from 'parse5';
import {SITE_URL,publicPaths,alternateLinks,isIndexable,robotsText} from '../src/lib/seo.mjs';
const PUBLIC_PATHS=publicPaths();
const check=(test,message)=>{if(!test)throw new Error('SEO build check: '+message);};
for(const path of PUBLIC_PATHS){
  const html=await readFile('dist'+path+'index.html','utf8'),nodes=[];
  function visit(node){nodes.push(node);for(const child of node.childNodes||[])visit(child);}visit(parse(html));
  const attr=(node,key)=>node?.attrs?.find(a=>a.name===key)?.value;
  const canonical=nodes.find(n=>n.tagName==='link'&&attr(n,'rel')==='canonical');
  check(attr(canonical,'href')===SITE_URL+path,'canonical must use the final www URL: '+path);
  const robots=nodes.find(n=>n.tagName==='meta'&&attr(n,'name')==='robots');
  check(Boolean(robots),'missing robots meta tag: '+path);
  check(Boolean(attr(robots,'content')?.includes('noindex'))===!isIndexable(),'indexing environment mismatch: '+path);
  for(const link of alternateLinks(path))check(nodes.some(n=>n.tagName==='link'&&attr(n,'hreflang')===link.lang&&attr(n,'href')===link.url),'missing language alternate: '+path);
  check(nodes.filter(n=>n.tagName==='h1').length===1,'expected one H1: '+path);
  const schema=nodes.find(n=>n.tagName==='script'&&attr(n,'type')==='application/ld+json');
  const graph=JSON.parse(schema?.childNodes?.map(n=>n.value||'').join('')||'null')?.['@graph'];
  check(graph?.some(n=>n['@type']==='Organization'&&n.email==='info@eonovastudios.com'),'missing studio structured data: '+path);
}
check(await readFile('dist/robots.txt','utf8')===robotsText(),'robots.txt does not match the deployment environment');
const sitemap=await readFile('dist/sitemap-0.xml','utf8');
const urls=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
check(urls.length===PUBLIC_PATHS.length&&urls.every(url=>url.startsWith(SITE_URL+'/')&&PUBLIC_PATHS.includes(new URL(url).pathname)),'sitemap must include only public canonical URLs');
check(!sitemap.includes('https://eonovastudios.com'),'sitemap contains redirecting URLs');
console.log(`SEO checks passed: ${PUBLIC_PATHS.length} public pages, ${isIndexable()?'production indexing enabled':'preview/local indexing blocked'}.`);
