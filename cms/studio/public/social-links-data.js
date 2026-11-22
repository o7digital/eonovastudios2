export const socialLinkDefinitions=[
 {id:'facebook',label:'Facebook',example:'https://www.facebook.com/tu-pagina'},
 {id:'instagram',label:'Instagram',example:'https://www.instagram.com/tu-cuenta/'},
 {id:'tiktok',label:'TikTok',example:'https://www.tiktok.com/@tu-cuenta'},
 {id:'youtube',label:'YouTube',example:'https://www.youtube.com/@tu-canal'},
 {id:'vimeo',label:'Vimeo',example:'https://vimeo.com/tu-cuenta'},
 {id:'linkedin',label:'LinkedIn',example:'https://www.linkedin.com/in/tu-perfil/'},
 {id:'behance',label:'Behance',example:'https://www.behance.net/tu-cuenta'},
 {id:'dribbble',label:'Dribbble',example:'https://dribbble.com/tu-cuenta'},
 {id:'pinterest',label:'Pinterest',example:'https://www.pinterest.com/tu-cuenta/'},
 {id:'x',label:'X',example:'https://x.com/tu-cuenta'},
 {id:'threads',label:'Threads',example:'https://www.threads.net/@tu-cuenta'},
];
export function normalizeSocialUrl(value){
 if(typeof value!=='string')return null;
 const input=value.trim();if(!input)return '';
 if(input.length>2048||/[\u0000-\u0020\u007f]/.test(input))return null;
 const prefixed=input.startsWith('//')?'https:'+input:/^[a-z][a-z0-9+.-]*:/i.test(input)?input:'https://'+input;
 try{const url=new URL(prefixed);if(!['https:','http:'].includes(url.protocol)||url.username||url.password||!url.hostname.includes('.')||url.href.length>2048)return null;return url.href;}catch{return null;}
}
