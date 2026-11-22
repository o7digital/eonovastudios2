export function logoSize(value) {
  const size=Number(value);
  return Number.isInteger(size)&&size>=40&&size<=120?size:80;
}

export function logoStyle(value) {
  const size=logoSize(value);
  return `--brand-logo-height:${size}px;--brand-logo-mobile-height:${Math.round(size*.7)}px`;
}

// Crop only fully transparent padding. Every visible pixel and the source file survive.
export function logoBounds(data,width,height) {
  let left=width,top=height,right=-1,bottom=-1;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>0){
    if(x<left)left=x;if(x>right)right=x;if(y<top)top=y;if(y>bottom)bottom=y;
  }
  return right<left?{left:0,top:0,width,height}:{left,top,width:right-left+1,height:bottom-top+1};
}

export const logoCss=`
.brand-logo{display:block;width:auto;max-width:280px;height:var(--brand-logo-height,80px);object-fit:contain}
.nav:has(.brand-logo){height:max(104px,calc(var(--brand-logo-height,80px) + 28px))}
body:has(header .brand-logo) .hero{padding-top:max(138px,calc(var(--brand-logo-height,80px) + 62px))}
@media(max-width:1000px){.brand-logo{max-width:220px}}
@media(max-width:760px){.brand-logo{max-width:160px;height:var(--brand-logo-mobile-height,56px)}}
@media(max-width:680px){
 .nav:has(.brand-logo){height:max(118px,calc(var(--brand-logo-mobile-height,56px) + 76px))}
 body:has(header .brand-logo) .hero{padding-top:max(145px,calc(var(--brand-logo-mobile-height,56px) + 103px))}
}
`;

const previews=new Map();
export function prepareLogoPreview(src) {
  if(!previews.has(src))previews.set(src,(async()=>{
    const image=new Image();image.src=src;await image.decode();
    const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
    const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);
    const bounds=logoBounds(context.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height);
    const cropped=document.createElement('canvas');cropped.width=bounds.width;cropped.height=bounds.height;
    cropped.getContext('2d').drawImage(image,bounds.left,bounds.top,bounds.width,bounds.height,0,0,bounds.width,bounds.height);
    return {src:cropped.toDataURL('image/png'),width:bounds.width,height:bounds.height};
  })().catch(error=>{previews.delete(src);throw error;}));
  return previews.get(src);
}
