/* Menu search: every contact in every division. Runs on every page. */
(function () {
  const input = document.getElementById('search');
  const results = document.getElementById('results');
  const countEl = document.getElementById('search-count');
  const box = input && input.closest('.hdr-search');
  const dataEl = document.getElementById('search-data');
  if (!input || !results || !dataEl) return;
  const data = JSON.parse(dataEl.textContent);
  const current = document.body.dataset.division || '';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const stName = {};
  Object.values(data.states || {}).forEach(x => { stName[x.abbr] = x.name; });
  const digits = x => String(x == null ? '' : x).replace(/\D/g, '');
  const entries = [], mgrIdx = {};
  (data.all || []).forEach(dv => {
    const push = (p, kind, t) => {
      if (kind === 'manager') { const k = dv.id + '|' + p.name; if (mgrIdx[k]) { mgrIdx[k].terrs.push(t); return; } mgrIdx[k] = { dv, p, kind, terrs: [t] }; entries.push(mgrIdx[k]); return; }
      entries.push({ dv, p, kind, terrs: t ? [t] : [] });
    };
    (dv.territories || []).forEach(t => {
      (t.contacts || []).forEach(p => push(p, 'specialist', t));
      (t.managers || []).forEach(m => push(m, 'manager', t));
    });
    (dv.national || []).forEach(p => push(p, 'national', null));
  });
  entries.forEach(e => {
    e.abbrs = new Set(); e.terrs.forEach(t => (t.states || []).forEach(a => e.abbrs.add(String(a).toUpperCase())));
    const names = [...e.abbrs].map(a => stName[a] || '').join(' ');
    e.hay = [e.p.name, e.p.title, e.p.email, e.p.phone, digits(e.p.phone), e.terrs.map(t => t.name + ' ' + (t.group || '')).join(' '), names, e.dv.title, e.kind === 'national' ? 'national team' : ''].join(' ').toLowerCase();
  });
  // A two-letter word that is a state code (FL, tx...) matches by state; everything else matches text anywhere.
  const isAbbr = tok => tok.length === 2 && Object.prototype.hasOwnProperty.call(stName, tok.toUpperCase());
  const hit = (e, tok) => isAbbr(tok) ? e.abbrs.has(tok.toUpperCase()) : (e.hay.includes(tok) || (digits(tok).length >= 3 && e.hay.includes(digits(tok))));
  const target = e => { const t = e.terrs[0]; return !t ? null : (e.kind === 'manager' && t.group ? 'g:' + t.group : t.id); };

  const row = e => {
    const p = e.p, tg = target(e), cur = e.dv.id === current, t = e.terrs[0];
    const meta = e.kind === 'national' ? 'National team'
      : e.kind === 'manager' ? (t.group ? t.group + ': ' : '') + e.terrs.map(x => x.name).join(', ')
      : t.name + ' \u00B7 ' + [...new Set((t.states || []).map(a => String(a).toUpperCase()))].sort().join(', ');
    const dot = t ? `<i style="background:${esc(t.color)}"></i>` : '';
    const go = !tg ? '' : cur && window.TerritoryMap ? `<button type="button" class="res-go" data-id="${esc(tg)}">Show on map</button>`
      : `<a class="res-go" href="${esc(e.dv.url)}#t=${encodeURIComponent(tg)}">Open map</a>`;
    return `<li class="res"><div class="res-main"><strong>${esc(p.name)}</strong>${p.title ? `<span>${esc(p.title)}</span>` : ''}<span class="res-meta">${dot}${esc(meta)}</span></div>` +
      `<div class="res-links">${p.phone ? `<a href="tel:${esc(String(p.phone).replace(/[^\d+]/g, ''))}">${esc(p.phone)}</a>` : ''}${p.email ? `<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>` : ''}</div>${go}</li>`;
  };

  const highlight = ids => { if (window.TerritoryMap) window.TerritoryMap.highlight(ids); };
  const run = () => {
    const toks = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!toks.length) { results.innerHTML = ''; countEl.textContent = ''; box.classList.remove('open'); highlight(null); return; }
    const hits = entries.filter(e => toks.every(tk => hit(e, tk)));
    const mapHits = (data.all || []).filter(dv => toks.every(tk => (dv.title + ' ' + (dv.nav || '')).toLowerCase().includes(tk)));
    const ids = new Set();
    hits.forEach(e => { if (e.dv.id === current) e.terrs.forEach(t => ids.add(t.id)); });
    highlight(ids);
    const MAX = 60; let shown = 0, html = '';
    if (mapHits.length) {   // maps whose name matches
      html += '<li class="res-div">Maps</li>';
      mapHits.forEach(dv => { html += `<li class="res res-map"><a class="${esc(dv.brand || '')}" href="${esc(dv.url)}">${esc(dv.title)}</a></li>`; });
    }
    [...(data.all || [])].sort((a, b) => (b.id === current) - (a.id === current)).forEach(dv => {   // this page's division first
      const rows = hits.filter(e => e.dv === dv); if (!rows.length) return;
      html += `<li class="res-div ${esc(dv.brand || '')}">${esc(dv.title)}${dv.id === current ? ' <em>(this map)</em>' : ''}</li>`;
      rows.forEach(e => { if (shown < MAX) { shown++; html += row(e); } });
    });
    if (hits.length > MAX) html += `<li class="res-more">Showing ${MAX} of ${hits.length}. Keep typing to narrow it down.</li>`;
    results.innerHTML = html;
    const parts = [];
    if (mapHits.length) parts.push(`${mapHits.length} map${mapHits.length === 1 ? '' : 's'}`);
    if (hits.length) parts.push(`${hits.length} contact${hits.length === 1 ? '' : 's'}`);
    countEl.textContent = parts.length ? parts.join(' and ') + ' found' : 'No matches';
    box.classList.add('open');
  };
  input.addEventListener('input', run);
  input.addEventListener('focus', () => { if (input.value.trim()) box.classList.add('open'); });
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') { if (input.value) { input.value = ''; run(); } else box.classList.remove('open'); e.stopPropagation(); }
  });
  results.addEventListener('click', e => {
    const b = e.target.closest('.res-go'); if (!b || b.tagName !== 'BUTTON') return;
    if (window.TerritoryMap) window.TerritoryMap.pin(b.dataset.id);
    box.classList.remove('open');
  });
  document.addEventListener('click', e => { if (!e.target.closest('.hdr-search')) box.classList.remove('open'); });   // click elsewhere closes the list (the text stays)
})();
