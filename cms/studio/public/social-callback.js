const params=new URLSearchParams(location.search),state=params.get('state'),code=params.get('code'),denied=params.has('error');
history.replaceState(null,'','/social-callback.html');
const status=document.querySelector('#oauth-status');
if(denied)status.textContent='Vous avez annulé l’autorisation. Vos comptes restent inchangés.';
else if(!state||!code)status.textContent='L’autorisation est incomplète. Revenez au Studio pour recommencer.';
else{
 try{
  const response=await fetch('/api/social/oauth/complete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({state,code})});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'La connexion n’a pas abouti.');
  sessionStorage.setItem('eon-social-attempt',data.attemptId);location.replace('/#social');
 }catch(error){status.textContent=error.message+' Aucun contenu n’a été publié. Vous pouvez revenir au Studio et recommencer.';}
}
