import {normalizeTextColor,inlineTextColor} from './text-color.js?v=color-1';
// Only supported inline formatting and a validated text color leave this editor.
export function cleanInline(value){
 const template=document.createElement('template');template.innerHTML=value;
 function walk(node){
  if(node.nodeType===Node.TEXT_NODE)return node.textContent.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  if(node.nodeType!==Node.ELEMENT_NODE||['SCRIPT','STYLE','IFRAME','OBJECT'].includes(node.tagName))return '';
  const inside=[...node.childNodes].map(walk).join('');
  if(node.tagName==='BR')return '<br>';
  if(['DIV','P'].includes(node.tagName))return inside+'<br>';
  const tag={B:'strong',STRONG:'strong',I:'em',EM:'em',SPAN:'span',FONT:'span'}[node.tagName];
  if(!tag)return inside;
  const color=inlineTextColor(node.getAttribute('style'))||(node.tagName==='FONT'?normalizeTextColor(node.getAttribute('color')):null);
  return `<${tag}${color?' style="color:'+color+'"':''}>${inside}</${tag}>`;
 }
 return [...template.content.childNodes].map(walk).join('').replace(/(?:<br>)+$/,'');
}
// Apply validated colors through CSS properties so the Studio can keep its strict style CSP.
export function renderInline(node,value){
 const template=node.ownerDocument.createElement('template');template.innerHTML=cleanInline(value);
 const colors=[...template.content.querySelectorAll('[style]')].map(element=>[element,inlineTextColor(element.getAttribute('style'))]);
 for(const [element] of colors)element.removeAttribute('style');
 node.replaceChildren(template.content);
 for(const [element,color] of colors)if(color)element.style.color=color;
}
export function mountEditors(root,{editable,onChange,colorTarget,onColorChange,onFocus,colorDocument}){
 const cleanups=[];
 for(const field of root.querySelectorAll('[data-rich-text]')){
  renderInline(field,field.textContent);field.contentEditable=String(editable);
  const wrapper=field.closest('.visual-editor');
  const changed=()=>{onChange(field.dataset.richText,cleanInline(field.innerHTML));wrapper.querySelector('.editor-length').textContent=`${field.textContent.length} caracteres`;};
  field.addEventListener('focus',()=>onFocus?.(field));
  field.addEventListener('input',changed);
  field.addEventListener('paste',event=>{event.preventDefault();if(field.isContentEditable)document.execCommand('insertText',false,event.clipboardData.getData('text/plain'));});
  field.addEventListener('drop',event=>event.preventDefault());
  field.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();if(field.isContentEditable)document.execCommand('insertLineBreak');}});
  for(const button of wrapper.querySelectorAll('[data-format]')){
   button.disabled=!editable;button.addEventListener('mousedown',event=>event.preventDefault());
   button.addEventListener('click',()=>{if(!field.isContentEditable)return;field.focus();document.execCommand(button.dataset.format);changed();});
  }
  const tools=wrapper.querySelector('.text-color-tools');
  if(tools){
   const picker=tools.querySelector('[data-text-color]'),hex=tools.querySelector('[data-text-color-code]'),apply=tools.querySelector('[data-apply-color]'),error=tools.querySelector('[data-color-error]');
   let savedTarget,savedRange;
   const target=()=>colorTarget?.()||field;
   function remember(){
    if(tools.contains(tools.ownerDocument.activeElement))return;
    const node=target(),selection=node.ownerDocument.getSelection();
    if(selection?.rangeCount&&node.contains(selection.getRangeAt(0).commonAncestorContainer)){
     savedTarget=node;savedRange=selection.getRangeAt(0).cloneRange();
     const anchor=selection.anchorNode?.nodeType===1?(selection.anchorNode.childNodes[selection.anchorOffset]||selection.anchorNode):selection.anchorNode;
     const current=anchor?.nodeType===1?anchor:anchor?.parentElement;
     const color=current&&normalizeTextColor(node.ownerDocument.defaultView.getComputedStyle(current).color);
     if(color){picker.value=color;hex.value=color;}
    }
   }
   function setColor(value){
    const color=normalizeTextColor(value),node=target();
    error.hidden=Boolean(color);hex.setAttribute('aria-invalid',String(!color));if(!color||!editable||!node.isContentEditable)return;
    const doc=node.ownerDocument,selection=doc.getSelection();
    let range=savedTarget===node&&savedRange&&node.contains(savedRange.commonAncestorContainer)?savedRange.cloneRange():doc.createRange();
    if(savedTarget!==node||!savedRange||range.collapsed||!node.contains(range.commonAncestorContainer))range.selectNodeContents(node);
    node.focus({preventScroll:true});selection.removeAllRanges();selection.addRange(range);
    // Replace the selected fragment in one undoable browser operation. Each text run
    // carries its color inside emphasis, whose site CSS may otherwise override it.
    const fragment=range.cloneContents(),walker=doc.createTreeWalker(fragment,4),texts=[];
    for(let text;(text=walker.nextNode());)if(text.textContent)texts.push(text);
    for(const text of texts){const span=doc.createElement('span');span.dataset.eonColor='';span.style.color=color;text.replaceWith(span);span.append(text);}
    for(let parent=range.commonAncestorContainer.nodeType===1?range.commonAncestorContainer:range.commonAncestorContainer.parentElement;parent&&parent!==node;parent=parent.parentElement){
     if(['EM','I','STRONG','B'].includes(parent.tagName)){const format=doc.createElement(parent.tagName);format.append(...fragment.childNodes);fragment.append(format);}
    }
    const holder=doc.createElement('div');holder.append(fragment);
    doc.execCommand('insertHTML',false,holder.innerHTML);
    const colored=[...node.querySelectorAll('[data-eon-color]')];
    for(const span of colored){span.style.color=color;span.removeAttribute('data-eon-color');}
    if(colored.length){const applied=doc.createRange();applied.setStartBefore(colored[0]);applied.setEndAfter(colored.at(-1));selection.removeAllRanges();selection.addRange(applied);}
    if(selection.rangeCount){savedTarget=node;savedRange=selection.getRangeAt(0).cloneRange();}
    picker.value=color;hex.value=color;
    if(onColorChange)onColorChange(node,cleanInline(node.innerHTML));else changed();
   }
   const docs=new Set([field.ownerDocument,colorDocument].filter(Boolean));
   for(const doc of docs){doc.addEventListener('selectionchange',remember);cleanups.push(()=>doc.removeEventListener('selectionchange',remember));}
   tools.addEventListener('pointerdown',remember);
   picker.addEventListener('input',()=>setColor(picker.value));
   hex.addEventListener('input',()=>{const color=normalizeTextColor(hex.value);if(color)picker.value=color;error.hidden=true;hex.removeAttribute('aria-invalid');});
   hex.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();setColor(hex.value);}});
   apply.addEventListener('click',()=>setColor(hex.value));
   for(const control of tools.querySelectorAll('input,button'))control.disabled=!editable;
  }
  wrapper.querySelector('.editor-length').textContent=`${field.textContent.length} caracteres`;
 }
 return ()=>cleanups.forEach(cleanup=>cleanup());
}
