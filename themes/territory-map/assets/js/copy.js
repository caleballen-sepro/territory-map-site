/* "Copy" buttons: any <button class="copy-btn" data-copy="text"> copies its text (name, title, phone, email on separate lines). */
(function () {
  const fallback = text => {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta); return ok;
  };
  const write = text => (navigator.clipboard && window.isSecureContext
    ? navigator.clipboard.writeText(text).then(() => true, () => fallback(text))
    : Promise.resolve(fallback(text)));
  document.addEventListener('click', e => {
    const b = e.target.closest('.copy-btn'); if (!b || b.tagName === 'A' || b.classList.contains('share-btn')) return;   // (Share and Save-to-Contacts look the same but do their own thing)
    e.preventDefault();
    const label = b.querySelector('.cb-t'), was = label ? label.textContent : '', aria = b.getAttribute('aria-label');
    write(b.dataset.copy || '').then(ok => {
      b.classList.add(ok ? 'done' : 'fail');
      if (label) label.textContent = ok ? 'Copied' : 'Copy failed';
      b.setAttribute('aria-label', ok ? 'Copied' : 'Copy failed');
      b.title = ok ? 'Copied' : 'Copy failed';
      clearTimeout(b._t);
      b._t = setTimeout(() => {
        b.classList.remove('done', 'fail');
        if (label) label.textContent = was;
        b.setAttribute('aria-label', aria); b.removeAttribute('title');
      }, 1600);
    });
  });
})();
