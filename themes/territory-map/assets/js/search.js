/* Menu search: every contact in every division. Runs on every page.
   Also understands a ZIP code ("46204") or a city ("Indianapolis", "Springfield MO") and lists everyone who covers that state.
   Open positions show the person to contact instead (the territory's regional manager, or a name found in the open position's title). */
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

  const stName = {}, stByName = {};
  const norm = s => String(s == null ? '' : s).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
    .split(' ').map(w => (w === 'st' ? 'saint' : w === 'ft' ? 'fort' : w === 'mt' ? 'mount' : w)).join(' ');
  Object.values(data.states || {}).forEach(x => { stName[x.abbr] = x.name; stByName[norm(x.name)] = x.abbr; });
  const digits = x => String(x == null ? '' : x).replace(/\D/g, '');

  // ---- Open positions: who to contact instead ----
  const isOpen = p => !!p.open || /^\s*open\b/i.test(p.name || '');
  const coverFor = (p, t, dv) => {
    if (!isOpen(p)) return [];
    if (t && (t.managers || []).length) return t.managers;
    const pool = [].concat(dv.national || [], ...(dv.territories || []).map(x => x.managers || []));   // else a name mentioned in the open position's title
    const txt = String(p.title || '').toLowerCase();
    return pool.filter((x, i, a) => x.name && txt.includes(String(x.name).toLowerCase()) && a.findIndex(y => y.name === x.name) === i);
  };
  const vcard = p => [p.name, p.title, p.phone, p.email].filter(Boolean).join('\n');
  const ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  const copyBtn = text => `<button type="button" class="copy-btn" data-copy="${esc(text)}" aria-label="Copy contact details">${ICON}<span class="cb-t">Copy</span></button>`;
  const links = p => `${p.phone ? `<a href="tel:${esc(String(p.phone).replace(/[^\d+]/g, ''))}">${esc(p.phone)}</a>` : ''}${p.email ? `<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>` : ''}`;

  const setOpen = v => { box.classList.toggle('open', v); input.setAttribute('aria-expanded', String(v)); };

  const entries = [], mgrIdx = {};
  (data.all || []).forEach(dv => {
    const push = (p, kind, t) => {
      // key: how a Directory row finds its entry (see dirrow.html)
      if (kind === 'manager') { const k = dv.id + '|' + p.name; if (mgrIdx[k]) { mgrIdx[k].terrs.push(t); return; } mgrIdx[k] = { dv, p, kind, terrs: [t], key: dv.id + '|m|' + p.name }; entries.push(mgrIdx[k]); return; }
      entries.push({ dv, p, kind, terrs: t ? [t] : [], key: dv.id + '|' + (t ? 's|' + t.id : 'n') + '|' + p.name });
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

  // ---- ZIP code and city lookup (data loaded the first time the box is used) ----
  let places = null, loading = null;
  const loadPlaces = () => loading || (loading = (input.dataset.places ? fetch(input.dataset.places).then(r => r.json()) : Promise.reject())
    .then(p => {
      const zip = [];
      Object.entries(p.zip3 || {}).forEach(([st, spec]) => String(spec).split(',').forEach(r => { const [a, b] = r.split('-'); zip.push({ st, a: +a, b: +(b || a) }); }));
      const cities = {};
      const add = (name, v) => { const k = norm(name); if (!k) return; const s = cities[k] || (cities[k] = new Set()); [].concat(v).forEach(x => s.add(String(x).toUpperCase())); };
      Object.entries(p.cities || {}).forEach(([n, v]) => add(n, v));
      Object.entries(p.extraCities || {}).forEach(([n, v]) => add(n, v));
      const xz = {}; Object.entries(p.extraZips || {}).forEach(([z, s]) => { xz[String(z).padStart(5, '0')] = String(s).toUpperCase(); });
      places = { zip, cities, xz };
    }).catch(() => { places = { zip: [], cities: {}, xz: {} }; }).then(() => { if (input.value.trim()) run(); }));
  const cap = s => s.replace(/\b[a-z]/g, c => c.toUpperCase());
  const resolvePlace = raw => {
    const q = raw.trim(), z = /^(\d{5})(?:-\d{4})?$/.exec(q);
    if (z) {
      const p3 = +z[1].slice(0, 3), f = places.zip.find(r => p3 >= r.a && p3 <= r.b), st = places.xz[z[1]] || (f && f.st);
      return { kind: 'zip', label: 'ZIP ' + z[1], states: st ? [st] : [] };
    }
    const n = norm(q);
    if (!n || /\d/.test(n) || stByName[n]) return null;   // a state name by itself is handled as a normal search
    if (places.cities[n]) return { kind: 'city', label: cap(n), states: [...places.cities[n]].sort() };
    const w = n.split(' ');
    for (let k = 1; k <= 3 && w.length > k; k++) {   // "springfield mo", "kansas city missouri"
      const tail = w.slice(-k).join(' '), ab = k === 1 && isAbbr(tail) ? tail.toUpperCase() : stByName[tail];
      const head = w.slice(0, -k).join(' ');
      if (ab && places.cities[head] && places.cities[head].has(ab)) return { kind: 'city', label: cap(head) + ', ' + ab, states: [ab] };
    }
    return null;
  };

  const row = e => {
    const p = e.p, tg = target(e), cur = e.dv.id === current, t = e.terrs[0];
    const cover = coverFor(p, t, e.dv);
    const meta = e.kind === 'national' ? 'National team'
      : e.kind === 'manager' ? (t.group ? t.group + ': ' : '') + e.terrs.map(x => x.name).join(', ')
      : t.name + ' · ' + [...new Set((t.states || []).map(a => String(a).toUpperCase()))].sort().join(', ');
    const dot = t ? `<i style="background:${esc(t.color)}"></i>` : '';
    const go = !tg ? '' : cur && window.TerritoryMap ? `<button type="button" class="res-go" data-id="${esc(tg)}">Show on map</button>`
      : `<a class="res-go" href="${esc(e.dv.url)}#t=${encodeURIComponent(tg)}">Open map</a>`;
    if (cover.length) {   // open position: show who to contact
      return `<li class="res"><div class="res-main"><strong>${esc(p.name)}</strong>` +
        cover.map(m => `<span>Contact ${esc(m.name)}${m.title ? ', ' + esc(m.title) : ''}</span>`).join('') +
        `<span class="res-meta">${dot}${esc(meta)}</span></div>` +
        cover.map(m => `<div class="res-links">${links(m)}</div>`).join('') +
        `<div class="res-actions">${go}${copyBtn(cover.map(vcard).join('\n\n'))}</div></li>`;
    }
    return `<li class="res"><div class="res-main"><strong>${esc(p.name)}</strong>${p.title ? `<span>${esc(p.title)}</span>` : ''}<span class="res-meta">${dot}${esc(meta)}</span></div>` +
      `<div class="res-links">${links(p)}</div><div class="res-actions">${go}${p.phone || p.email ? copyBtn(vcard(p)) : ''}</div></li>`;
  };

  // Who matches a search (shared by the menu list and the Directory filter): a ZIP or city means everyone covering that state, anything else is a text match.
  const compute = raw => {
    const toks = raw.toLowerCase().split(/\s+/).filter(Boolean);
    const place = places && toks.length ? resolvePlace(raw) : null;
    const usePlace = !!place && place.states.length > 0 && place.states.length <= 4;
    const textHits = !toks.length ? [] : place && place.kind === 'zip' ? [] : entries.filter(e => toks.every(tk => hit(e, tk)));
    const set = new Set(usePlace ? place.states : []);
    let hits = textHits;
    if (usePlace) {
      const pHits = entries.filter(e => e.kind !== 'national' && [...e.abbrs].some(a => set.has(a)));
      hits = [...pHits, ...textHits.filter(e => !pHits.includes(e))];
    }
    return { toks, place, usePlace, set, hits };
  };
  window.TerritorySearch = {   // used by the Directory page's own search box (dirsearch.js)
    ready: () => places ? Promise.resolve() : loadPlaces(),
    filter: raw => { const q = compute(String(raw).trim()); return { keys: new Set(q.hits.map(e => e.key)), count: q.hits.length, place: q.usePlace ? { label: q.place.label, states: q.place.states.map(a => stName[a] || a) } : null }; }
  };

  const highlight = ids => { if (window.TerritoryMap) window.TerritoryMap.highlight(ids); };
  const run = () => {
    const raw = input.value.trim();
    if (!raw) { results.innerHTML = ''; countEl.textContent = ''; setOpen(false); highlight(null); return; }
    const { toks, place, usePlace, set, hits } = compute(raw);
    let banner = '';
    if (usePlace) {
      const where = place.states.map(a => stName[a] || a).join(', ');
      banner = `<li class="res-place"><strong>${esc(place.label)}</strong> → ${esc(where)}` +
        (place.kind === 'zip' ? '<small>Matched on the first 3 digits of the ZIP.</small>' : place.states.length > 1 ? '<small>More than one state has a city with this name. Add a state to narrow it.</small>' : '') + '</li>';
    } else if (place && place.kind === 'zip') {
      banner = `<li class="res-place"><strong>${esc(place.label)}</strong> is not in the ZIP lookup. Try the city or state.</li>`;
    } else if (place && place.states.length > 4) {
      banner = `<li class="res-place"><strong>${esc(place.label)}</strong> exists in ${esc(place.states.join(', '))}. Add a state to narrow it, like "${esc(place.label)} ${esc(place.states[0])}".</li>`;
    }
    const mapHits = (data.all || []).filter(dv => toks.every(tk => (dv.title + ' ' + (dv.nav || '')).toLowerCase().includes(tk)));
    const ids = new Set();
    if (usePlace) (data.all || []).forEach(dv => { if (dv.id === current) (dv.territories || []).forEach(t => { if ((t.states || []).some(a => set.has(String(a).toUpperCase()))) ids.add(t.id); }); });
    else hits.forEach(e => { if (e.dv.id === current) e.terrs.forEach(t => ids.add(t.id)); });
    highlight(ids);
    const MAX = 60; let shown = 0, html = banner;
    if (mapHits.length && !usePlace) {   // maps whose name matches
      html += '<li class="res-div">Maps</li>';
      mapHits.forEach(dv => { html += `<li class="res res-map"><a class="${esc(dv.brand || '')}" href="${esc(dv.url)}">${esc(dv.title)}</a></li>`; });
    }
    const missing = [];
    [...(data.all || [])].sort((a, b) => (b.id === current) - (a.id === current)).forEach(dv => {   // this page's division first
      const rows = hits.filter(e => e.dv === dv); if (!rows.length) { if (usePlace) missing.push(dv.title); return; }
      html += `<li class="res-div ${esc(dv.brand || '')}">${esc(dv.title)}${dv.id === current ? ' <em>(this map)</em>' : ''}</li>`;
      rows.forEach(e => { if (shown < MAX) { shown++; html += row(e); } });
    });
    if (usePlace && missing.length) html += `<li class="res-more">No territory lists ${esc(place.states.join(', '))} in: ${esc(missing.join(', '))}.</li>`;
    if (hits.length > MAX) html += `<li class="res-more">Showing ${MAX} of ${hits.length}. Keep typing to narrow it down.</li>`;
    results.innerHTML = html;
    const parts = [];
    if (mapHits.length && !usePlace) parts.push(`${mapHits.length} map${mapHits.length === 1 ? '' : 's'}`);
    if (hits.length) parts.push(`${hits.length} contact${hits.length === 1 ? '' : 's'}`);
    countEl.textContent = parts.length ? parts.join(' and ') + ' found' : 'No matches';
    setOpen(true);
  };
  input.addEventListener('input', () => { if (!places) loadPlaces(); run(); });
  input.addEventListener('focus', () => { loadPlaces(); if (input.value.trim()) setOpen(true); });
  const focusables = () => [...results.querySelectorAll('a[href], button')];   // arrow keys move through the results
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' && box.classList.contains('open')) { const f = focusables(); if (f.length) { e.preventDefault(); f[0].focus(); } }
    if (e.key === 'Escape') { if (input.value) { input.value = ''; run(); } else setOpen(false); e.stopPropagation(); }
  });
  results.addEventListener('keydown', e => {
    const f = focusables(), i = f.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); (f[i + 1] || f[0]).focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (i <= 0) input.focus(); else f[i - 1].focus(); }
    else if (e.key === 'Home') { e.preventDefault(); if (f[0]) f[0].focus(); }
    else if (e.key === 'End') { e.preventDefault(); if (f.length) f[f.length - 1].focus(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); input.focus(); }
  });
  box.addEventListener('focusout', e => { if (e.relatedTarget && !box.contains(e.relatedTarget)) setOpen(false); });   // Tab out of the list closes it
  results.addEventListener('click', e => {
    const b = e.target.closest('.res-go'); if (!b || b.tagName !== 'BUTTON') return;
    if (window.TerritoryMap) window.TerritoryMap.pin(b.dataset.id);
    setOpen(false);
  });
  document.addEventListener('click', e => { if (!e.target.closest('.hdr-search')) setOpen(false); });   // click elsewhere closes the list (the text stays)
})();
