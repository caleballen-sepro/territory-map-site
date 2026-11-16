/* Directory page: the map buttons choose which map's contacts are shown (click again for all maps), and the search box under them filters in place.
   It uses the same matching as the menu search (search.js: names, titles, states, ZIP codes, cities, territories, maps), and the menu's own
   search box drives the same filter on this page, so the two always show the same text. The "all maps" Generate buttons hide while anything is filtered, and every
   Generate button hides while a search is on. */
document.addEventListener('DOMContentLoaded', () => {
  const main = document.querySelector('main.directory'), S = window.TerritorySearch;
  const box = document.querySelector('.dir-search'), q = document.getElementById('dir-q'), menuQ = document.getElementById('search');
  const status = document.getElementById('dir-status'), clear = box && box.querySelector('.dir-clear');
  if (!main || !S || !box || !q) return;
  box.hidden = false;
  document.body.classList.add('dir-page');   // (the menu's dropdown list stays closed here: the page list below is the result)

  const rows = [...main.querySelectorAll('tr[data-k]')];
  const bodies = [...main.querySelectorAll('.dir-table tbody')];
  const divs = [...main.querySelectorAll('article.dir-div')];
  const sections = [...main.querySelectorAll('.brand-section')];
  const pills = [...main.querySelectorAll('.dir-jump a[data-div]')];
  let value = '', sel = '', timer = 0;   // value: the search text; sel: the chosen map (a division id) or ''

  const apply = () => {
    const raw = value.trim(), on = !!raw, r = on ? S.filter(raw) : null;
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

  S.ready().then(() => { if (value.trim()) apply(); });   // ZIP and city lookups arrive a moment later
  const qs = new URLSearchParams(location.search), first = qs.get('q'), mapId = qs.get('map') || location.hash.slice(1);   // (a link ending in #water opens with just that map)
  if (pills.some(a => a.dataset.div === mapId)) { sel = mapId; apply(); }
  if (first) set(first, null);
});
