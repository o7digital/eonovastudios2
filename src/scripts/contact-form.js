import {contactCopy,contactErrors} from '../lib/contact-copy.mjs';
for(const form of document.querySelectorAll('[data-contact-form]')){
 const copy=contactCopy[form.dataset.language]||contactCopy.es,button=form.querySelector('[type=submit]'),label=form.querySelector('[data-submit-label]'),status=form.querySelector('[data-contact-status]');
 let sending=false;
 function clearErrors(){
  for(const node of form.querySelectorAll('[aria-invalid]'))node.removeAttribute('aria-invalid');
  for(const node of form.querySelectorAll('.contact-field-error')){node.textContent='';node.hidden=true;}
  status.hidden=true;status.textContent='';
 }
 function showErrors(fields){
  for(const [field,key] of Object.entries(fields)){
   const input=form.elements.namedItem(field),error=form.querySelector('#contact-'+field+'-error');
   if(input&&error){input.setAttribute('aria-invalid','true');error.textContent=copy[key]||copy.required;error.hidden=false;}
  }
  form.querySelector('[aria-invalid=true]')?.focus();
 }
 function showStatus(text,error=false){status.textContent=text;status.hidden=false;status.classList.toggle('is-error',error);status.setAttribute('role',error?'alert':'status');status.focus();}
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(sending)return;clearErrors();
  const data=new FormData(form),input={name:String(data.get('name')||''),email:String(data.get('email')||''),phone:String(data.get('phone')||''),message:String(data.get('message')||''),_gotcha:String(data.get('_gotcha')||''),_subject:'EON NOVA Studios · Nuevo mensaje de contacto',language:form.dataset.language,consent:form.elements.namedItem('consent').checked};
  const errors=contactErrors(input);if(Object.keys(errors).length){showErrors(errors);return;}
  sending=true;button.disabled=true;label.textContent=copy.sending;form.setAttribute('aria-busy','true');
  try{
   const response=await fetch(form.action,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(24000)});
   const result=await response.json();
   if(!response.ok){showStatus(response.status===429?copy.limited:copy.unavailable,true);return;}
   form.reset();showStatus(copy.success);
  }catch{showStatus(copy.unavailable,true);}
  finally{sending=false;button.disabled=false;label.textContent=copy.submit;form.removeAttribute('aria-busy');}
 });
}
