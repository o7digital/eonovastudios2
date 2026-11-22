import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import sharp from 'sharp';

// Resize without cropping: the site's existing CSS and saved focal point control presentation.
export async function prepareImage(bytes,{output,placement,extension}) {
  const image=sharp(bytes,{limitInputPixels:64*1024*1024});
  const metadata=await image.metadata();
  const rotated=[5,6,7,8].includes(metadata.orientation);
  const naturalWidth=rotated?metadata.height:metadata.width;
  const naturalHeight=rotated?metadata.width:metadata.height;
  if(!naturalWidth||!naturalHeight)throw new Error('Cannot read website image dimensions.');
  const hash=createHash('sha256').update('eon-responsive-v1:').update(bytes).digest('hex').slice(0,24);
  if((metadata.pages||1)>1){
    const name=`${hash}.${extension}`;await writeFile(new URL(name,output),bytes);
    return {src:`/_cms/${name}`,type:`image/${extension==='jpg'?'jpeg':extension}`,width:metadata.width,height:metadata.pageHeight||metadata.height};
  }
  const logo=placement==='logo',maximum=Math.min(naturalWidth,logo?720:2560);
  const widths=[...new Set([...(logo?[180,360,720]:[320,640,960,1440,1920,2560]).filter(width=>width<maximum),maximum])];
  const variants=[];
  for(const width of widths){
    const transform=()=>image.clone().rotate().resize({width,withoutEnlargement:true});
    const webp=await transform().webp(logo?{lossless:true,effort:5}:{quality:84,effort:5}).toBuffer({resolveWithObject:true});
    const stem=`${hash}-${logo?'logo':'photo'}-${webp.info.width}`;
    await writeFile(new URL(stem+'.webp',output),webp.data);
    let avif;
    if(!logo){
      avif=await transform().avif({quality:62,effort:4,chromaSubsampling:'4:4:4'}).toBuffer();
      await writeFile(new URL(stem+'.avif',output),avif);
    }
    variants.push({width:webp.info.width,height:webp.info.height,webp:`/_cms/${stem}.webp`,...(avif?{avif:`/_cms/${stem}.avif`}:{})});
  }
  const largest=variants.at(-1);
  return {
    src:largest.webp,type:'image/webp',width:largest.width,height:largest.height,
    srcset:variants.map(item=>`${item.webp} ${item.width}w`).join(', '),
    ...(logo?{}:{avifSrcset:variants.map(item=>`${item.avif} ${item.width}w`).join(', ')}),
  };
}
