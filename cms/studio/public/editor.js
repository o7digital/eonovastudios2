// Only the site's supported inline formatting leaves this editor.
export function cleanInline(value) {
  const template = document.createElement('template');
  template.innerHTML = value;
  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    if (node.nodeType !== Node.ELEMENT_NODE || ['SCRIPT','STYLE','IFRAME','OBJECT'].includes(node.tagName)) return '';
    const inside = [...node.childNodes].map(walk).join('');
    if (node.tagName === 'BR') return '<br>';
    if (['B','STRONG'].includes(node.tagName)) return `<strong>${inside}</strong>`;
    if (['I','EM'].includes(node.tagName)) return `<em>${inside}</em>`;
    if (['DIV','P'].includes(node.tagName)) return inside + '<br>';
    if (node.tagName === 'SPAN') return `<span>${inside}</span>`;
    return inside;
  }
  return [...template.content.childNodes].map(walk).join('').replace(/(?:<br>)+$/,'');
}
export function mountEditors(root, {editable, onChange}) {
  for (const field of root.querySelectorAll('[data-rich-text]')) {
    field.innerHTML = cleanInline(field.textContent);
    field.contentEditable = String(editable);
    const wrapper = field.closest('.visual-editor');
    const changed = () => {
      onChange(field.dataset.richText, cleanInline(field.innerHTML));
      wrapper.querySelector('.editor-length').textContent = `${field.textContent.length} caracteres`;
    };
    field.addEventListener('input', changed);
    field.addEventListener('paste', event => {
      event.preventDefault();
      if (editable) document.execCommand('insertText', false, event.clipboardData.getData('text/plain'));
    });
    field.addEventListener('drop', event => event.preventDefault());
    field.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); if (editable) document.execCommand('insertLineBreak'); }
    });
    for (const button of wrapper.querySelectorAll('[data-format]')) {
      button.disabled = !editable;
      button.addEventListener('mousedown', event => event.preventDefault());
      button.addEventListener('click', () => {
        field.focus();
        document.execCommand(button.dataset.format);
        changed();
      });
    }
    wrapper.querySelector('.editor-length').textContent = `${field.textContent.length} caracteres`;
  }
}
