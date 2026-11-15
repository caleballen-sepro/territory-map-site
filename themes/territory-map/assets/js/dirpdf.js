/* Directory page: "Download PDF" buttons. Every map page is loaded in a hidden frame (so the maps, contacts and layouts are exactly
   what that page makes) and drawn onto one shared jsPDF document, which is saved here. */
(function () {
  const root = document.querySelector('.directory'); if (!root) return;
  const buttons = [...root.querySelectorAll('.dir-pdf')]; if (!buttons.length) return;
  let loading;
  const loadJsPdf = () => loading || (loading = new Promise((res, rej) => {
    if (window.jspdf) return res();
    const s = document.createElement('script'); s.src = root.dataset.jspdf; s.onload = res;
    s.onerror = () => rej(new Error('PDF library failed to load')); document.head.appendChild(s);
  }));
  const pages = () => [...root.querySelectorAll('.dir-div .dir-pdf[data-scope=one][data-mode=portrait]')].map(b => ({ url: b.dataset.page, title: b.dataset.title }));
  const slug = t => String(t).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const openFrame = url => new Promise((res, rej) => {
    const f = document.createElement('iframe');
    f.setAttribute('aria-hidden', 'true'); f.tabIndex = -1; f.title = 'PDF preparation';
    f.style.cssText = 'position:fixed;left:-20000px;top:0;width:1440px;height:1000px;border:0;visibility:hidden;pointer-events:none';
    f.src = url;
    f.onload = async () => {   // the map script defines exportPdf once the map has loaded and drawn
      for (let i = 0; i < 200; i++) {
        try { if (f.contentWindow.TerritoryMap && f.contentWindow.TerritoryMap.exportPdf && f.contentWindow.TerritoryPDF) return res(f); } catch (e) { return rej(e); }
        await new Promise(r => setTimeout(r, 100));
      }
      f.remove(); rej(new Error('a map page did not finish loading'));
    };
    f.onerror = () => rej(new Error('a map page failed to load'));
    document.body.appendChild(f);
  });

  const within = (p, ms, msg) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(msg)), ms))]);
  async function make(list, mode, filename) {
    await loadJsPdf();
    const doc = new window.jspdf.jsPDF({ orientation: mode === 'landscape' ? 'landscape' : 'portrait', unit: 'pt', format: 'letter' });
    for (let i = 0; i < list.length; i++) {
      const f = await openFrame(list[i].url);
      try { await within(f.contentWindow.TerritoryMap.exportPdf({ mode, doc, first: i === 0 }), 90000, (list[i].title || 'a map') + ' took too long to draw'); } finally { f.remove(); }
    }
    doc.save(filename);
  }

  buttons.forEach(b => b.addEventListener('click', async () => {
    const label = b.textContent; b.disabled = true; b.textContent = 'Preparing PDF…';
    try {
      const mode = b.dataset.mode, tail = mode === 'landscape' ? '-Landscape' : '';
      if (b.dataset.scope === 'all') await make(pages(), mode, 'SEPRO-Territory-Maps' + tail + '.pdf');
      else await make([{ url: b.dataset.page, title: b.dataset.title }], mode, slug(b.dataset.title) + '-Territory-Map' + tail + '.pdf');
    } catch (err) { alert('Could not create the PDF: ' + err.message); }
    b.textContent = label; b.disabled = false;
  }));
})();
