/* "Share" buttons: <button class="share-btn" data-url="/s/rory-roten/" data-name="..." data-title="...">.
   Phones and tablets open the system share sheet (Messages, Mail, Teams, AirDrop...); a computer copies the person's link and says so on the button. */
(function () {
  const fallback = text => {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta); return ok;
  };
  const copy = text => (navigator.clipboard && window.isSecureContext
    ? navigator.clipboard.writeText(text).then(() => true, () => fallback(text))
    : Promise.resolve(fallback(text)));
  const touch = matchMedia('(hover:none) and (pointer:coarse)');
  const flash = (b, ok) => {
    const l = b.querySelector('.cb-t'), was = l ? l.textContent : '';
    b.classList.add(ok ? 'done' : 'fail'); if (l) l.textContent = ok ? 'Link copied' : 'Copy failed';
    clearTimeout(b._t); b._t = setTimeout(() => { b.classList.remove('done', 'fail'); if (l) l.textContent = was || 'Share'; }, 1800);
  };
  document.addEventListener('click', e => {
    const b = e.target.closest('.share-btn'); if (!b) return;
    e.preventDefault();
    const url = new URL(b.dataset.url || '', location.href).href, name = b.dataset.name || '', title = b.dataset.title || '';
    const data = { title: name + ' · SEPRO Scientific', text: name + (title ? ', ' + title : ''), url };
    if (touch.matches && navigator.share) {   // closing the sheet is not an error; if the phone refuses to open it, the link is copied instead
      navigator.share(data).catch(err => { if (!err || err.name !== 'AbortError') copy(url).then(ok => flash(b, ok)); });
      return;
    }
    copy(url).then(ok => flash(b, ok));
  });
})();
