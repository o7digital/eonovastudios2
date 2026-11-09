const params=new URLSearchParams(location.search),state=params.get('state'),code=params.get('code'),denied=params.has('error');
history.replaceState(null,'','/social-callback.html');
const status=document.querySelector('#oauth-status');
if(denied)status.textContent='Cancelaste la autorización. Tus cuentas siguen sin cambios.';
else if(!state||!code)status.textContent='La autorización está incompleta. Vuelve al Studio para intentarlo de nuevo.';
else{
 try{
  const response=await fetch('/api/social/oauth/complete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({state,code})});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'No se pudo completar la conexión.');
  sessionStorage.setItem('eon-social-attempt',data.attemptId);location.replace('/#social');
 }catch(error){status.textContent=error.message+' No se publicó ningún contenido. Puedes volver al Studio e intentarlo de nuevo.';}
}
