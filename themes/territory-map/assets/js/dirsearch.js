/* Directory page: the map buttons choose which map's contacts are shown (click again for all maps), and the search box under them filters in place.
   It uses the same matching as the menu search (search.js: names, titles, states, ZIP codes, cities, territories, maps), and the menu's own
   search box drives the same filter on this page, so the two always show the same text. The "all maps" Generate buttons hide while anything is filtered, and every
   Generate button hides while a search is on. */
(() => {   // (runs as soon as the page's lists exist, so a chosen map is already in place on the first paint and nothing shifts)
  const main = document.querySelector('main.directory');
  const box = document.querySelector('.dir-search'), q = document.getElementById('dir-q'), menuQ = document.getElementById('search');
  const status = document.getElementById('dir-status'), clear = box && box.querySelector('.dir-clear');
  if (!main || !box || !q) return;
  document.body.classList.add('dir-page');   // (the menu's dropdown list stays closed here: the page list below is the result)

  const rows = [...main.querySelectorAll('tr[data-k]')];
  const bodies = [...main.querySelectorAll('.dir-table tbody')];
  const divs = [...main.querySelectorAll('article.dir-div')];
  const sections = [...main.querySelectorAll('.brand-section')];
  const pills = [...main.querySelectorAll('.dir-jump a[data-div]')];
  let value = '', sel = '', timer = 0, live = false, lastSig = '|' + '1'.repeat(rows.length);   // live: false while the page itself is still arriving   // value: the search text; sel: the chosen map (a division id) or ''

  const apply = () => {
    const raw = value.trim(), on = !!raw, S = window.TerritorySearch;
    if (on && !S) return;   // (the search code loads just after this file: the page waits for it below)
    const r = on ? S.filter(raw) : null;
    main.classList.toggle('dir-q', on); main.classList.toggle('dir-sel', !!sel);
    clear.hidden = !value;
    rows.forEach(tr => { tr.hidden = on && !r.keys.has(tr.dataset.k); });
    bodies.forEach(tb => { tb.hidden = on && !tb.querySelector('tr[data-k]:not([hidden])'); });
    divs.forEach(d => { d.hidden = (!!sel && d.id !== sel) || (on && !d.querySelector('tr[data-k]:not([hidden])')); });
    sections.forEach(s => { s.hidden = !s.querySelector('article.dir-div:not([hidden])'); });
    pills.forEach(a => {
      const d = document.getElementById(a.dataset.div), has = !on || rows.some(tr => !tr.hidden && d.contains(tr));
      a.classList.toggle('active', a.dataset.div === sel); a.setAttribute('aria-pressed', String(a.dataset.div === sel));
      a.classList.toggle('dim', on && !has);
    });
    const sig = sel + '|' + rows.map(tr => (tr.hidden ? 0 : 1)).join('');   // the lists changed: let them settle in softly instead of snapping
    if (live && sig !== lastSig && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      sections.forEach(sc => { if (!sc.hidden && sc.animate) sc.animate([{ opacity: .35, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'cubic-bezier(.2,.7,.2,1)' }); });
    }
    lastSig = sig;
    const shown = rows.filter(tr => !tr.hidden && !tr.closest('[hidden]')).length, name = sel && (pills.find(a => a.dataset.div === sel) || {}).textContent;
    status.textContent = on
      ? (r.place ? `${r.place.label} → ${r.place.states.join(', ')}: ` : '') + (shown ? `${shown} contact${shown === 1 ? '' : 's'} shown${name ? ' in ' + name : ''}`
        : name ? `No contacts in ${name} match. Click ${name} again to search every map.` : 'No contacts match. Try a state, a ZIP code, a city or a name.')
      : name ? `Showing ${name} only. Click it again to show every map.` : '';
  };
  const url = () => { try { const u = new URL(location.href); value.trim() ? u.searchParams.set('q', value.trim()) : u.searchParams.delete('q'); sel ? u.searchParams.set('map', sel) : u.searchParams.delete('map'); u.hash = ''; history.replaceState(history.state, '', u); } catch (e) {} };
  const set = (v, from) => {
    value = v; if (from !== q) q.value = v; if (menuQ && from !== menuQ) menuQ.value = v;
    clearTimeout(timer); timer = setTimeout(() => { apply(); url(); }, 90);
    if (!v) { clearTimeout(timer); apply(); url(); }
  };
  q.addEventListener('input', () => set(q.value, q));
  if (menuQ) {
    menuQ.addEventListener('input', () => set(menuQ.value, menuQ));
    menuQ.addEventListener('keydown', e => { if (e.key === 'Escape') setTimeout(() => set(menuQ.value, menuQ), 0); });
  }
  q.addEventListener('keydown', e => { if (e.key === 'Escape' && q.value) { e.preventDefault(); set('', null); } });
  clear.addEventListener('click', () => { set('', null); q.focus(); });
  const pick = id => {
    sel = sel === id ? '' : id; apply(); url();
    const bar = main.querySelector('.dir-jump');
    if (bar.getBoundingClientRect().top < 0) bar.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  pills.forEach(a => {
    a.setAttribute('role', 'button'); a.setAttribute('aria-pressed', 'false');   // (without scripting they stay plain jump links)
    a.addEventListener('click', e => { e.preventDefault(); pick(a.dataset.div); });
    a.addEventListener('keydown', e => { if (e.key === ' ') { e.preventDefault(); pick(a.dataset.div); } });
  });

  // Directory -> a map: the page sinks and fades out, and the map page fades in (html.map-enter, set by the script in baseof.html's <head>)
  const mapPaths = new Set([...document.querySelectorAll('.maps-pill')].map(a => a.pathname));
  document.addEventListener('click', e => {
    if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.target || a.origin !== location.origin || !mapPaths.has(a.pathname)) return;
    e.preventDefault();
    document.body.classList.add('dir-leaving');
    try { sessionStorage.setItem('territoryMapEnter', String(Date.now())); } catch (er) {}
    setTimeout(() => { location.href = a.href; }, 280);
  });
  window.addEventListener('pageshow', e => { if (e.persisted) document.body.classList.remove('dir-leaving'); });
  const qs = new URLSearchParams(location.search), first = qs.get('q'), mapId = qs.get('map') || location.hash.slice(1);   // (an old link ending in #water also opens with just that map)
  if (pills.some(a => a.dataset.div === mapId)) { sel = mapId; apply(); url(); }   // url() also drops a #hash so the browser doesn't scroll to it
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { live = true; }, 700);   // (the page's own entrance has finished)
    const S = window.TerritorySearch; if (!S) return;
    if (first) set(first, null);
    S.ready().then(() => { if (value.trim()) apply(); });   // ZIP and city lookups arrive a moment later
  });
})();
