// Keep text colors explicit and portable between the browser editor and the public renderer.
export function normalizeTextColor(value){
 if(typeof value!=='string')return null;
 const color=value.trim().toLowerCase();
 if(/^#[0-9a-f]{6}$/.test(color))return color;
 if(/^#[0-9a-f]{3}$/.test(color))return '#'+[...color.slice(1)].map(char=>char+char).join('');
 const rgb=color.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/);
 if(rgb&&rgb.slice(1).every(channel=>Number(channel)<=255))return '#'+rgb.slice(1).map(channel=>Number(channel).toString(16).padStart(2,'0')).join('');
 return null;
}
export function inlineTextColor(style){
 let color=null;
 for(const declaration of String(style||'').split(';')){
  const match=declaration.match(/^\s*color\s*:\s*(.*?)\s*$/i),normalized=match&&normalizeTextColor(match[1]);
  if(normalized)color=normalized;
 }
 return color;
}
export function colorToolsMarkup(){
 return `<div class="text-color-tools" role="group" aria-label="Color del texto"><label class="text-color-picker">Color <input type="color" data-text-color value="#9aee68" aria-label="Elegir color del texto"></label><label class="text-color-code">HEX <input type="text" data-text-color-code value="#9aee68" maxlength="7" spellcheck="false" autocomplete="off" aria-label="Código de color HEX" placeholder="#RRGGBB"></label><button type="button" data-apply-color>Aplicar</button><p class="text-color-error" data-color-error role="alert" hidden>Usa un código válido, por ejemplo #FF6600.</p></div>`;
}
