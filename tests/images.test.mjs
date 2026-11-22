import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import sharp from 'sharp';
import {prepareImage} from '../src/lib/images.mjs';

async function output(t){const path=await mkdtemp(join(tmpdir(),'eon-image-'));t.after(()=>rm(path,{recursive:true,force:true}));return {path,url:pathToFileURL(path+'/')};}
test('photos become responsive WebP and AVIF while retaining aspect ratio and the original input',async t=>{
  const folder=await output(t),bytes=await sharp({create:{width:1500,height:900,channels:3,background:'#245c3c'}}).png().toBuffer(),original=Buffer.from(bytes);
  const asset=await prepareImage(bytes,{output:folder.url,placement:'studio',extension:'png'});
  assert.deepEqual(bytes,original);assert.equal(asset.width,1500);assert.equal(asset.height,900);assert.equal(asset.type,'image/webp');
  assert.match(asset.srcset,/320w/);assert.match(asset.srcset,/1500w/);assert.ok(!asset.srcset.includes('1920w'));assert.match(asset.avifSrcset,/1500w/);
  for(const file of await readdir(folder.path)){
    const meta=await sharp(await readFile(join(folder.path,file))).metadata();assert.equal(meta.width/meta.height,1500/900);assert.ok(meta.width<=1500);
  }
});
test('transparent logos use lossless WebP with exact pixels, and animated images retain their original bytes',async t=>{
  const folder=await output(t),bytes=await sharp({create:{width:200,height:100,channels:4,background:{r:45,g:180,b:80,alpha:0.3}}}).png().toBuffer();
  const asset=await prepareImage(bytes,{output:folder.url,placement:'logo',extension:'png'});
  const converted=await readFile(join(folder.path,asset.src.split('/').at(-1)));
  assert.deepEqual(await sharp(converted).raw().toBuffer(),await sharp(bytes).raw().toBuffer());assert.equal(asset.avifSrcset,undefined);
  const animation=await sharp(Buffer.from('<svg width="4" height="8"><rect width="4" height="4" fill="red"/><rect y="4" width="4" height="4" fill="blue"/></svg>')).png().toBuffer();
  const animated=await sharp(animation).raw().toBuffer({resolveWithObject:true});
  const gif=await sharp(animated.data,{raw:{width:4,height:8,channels:4,pageHeight:4}}).gif({loop:0,delay:[100,100]}).toBuffer();
  const preserved=await prepareImage(gif,{output:folder.url,placement:'hero',extension:'gif'});
  assert.deepEqual(await readFile(join(folder.path,preserved.src.split('/').at(-1))),gif);assert.equal(preserved.height,4);assert.equal(preserved.srcset,undefined);
});

test('phone-photo orientation is applied before dimensions and responsive variants are computed',async t=>{
  const folder=await output(t),bytes=await sharp({create:{width:80,height:40,channels:3,background:'#a3c868'}}).jpeg().withMetadata({orientation:6}).toBuffer();
  const asset=await prepareImage(bytes,{output:folder.url,placement:'studio',extension:'jpg'});
  assert.equal(asset.width,40);assert.equal(asset.height,80);
  const metadata=await sharp(await readFile(join(folder.path,asset.src.split('/').at(-1)))).metadata();
  assert.equal(metadata.width,40);assert.equal(metadata.height,80);assert.equal(metadata.orientation,undefined);
});
