/* Home page: "My Personal SEPRO Team". Type a ZIP code, city or state (or use your location) and your technical specialist from every map
   appears in one row. The lookup is the menu search's (search.js); "Use my location" works out the state on this device from the map's own
   state outlines, so the position is never sent anywhere. */
(function () {
  const init = () => {
    const sec = document.getElementById('myteam'), TS = window.TerritorySearch; if (!sec || !TS) return;
    const q = sec.querySelector('#mt-q'), clear = sec.querySelector('.dir-clear'), loc = sec.querySelector('#mt-loc'), status = sec.querySelector('#mt-status');
    const reveal = sec.querySelector('#mt-reveal'), row = sec.querySelector('#mt-row');
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const initials = n => { const w = String(n).trim().split(/\s+/); return (w[0][0] + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase(); };
    const COPY = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
    if (navigator.geolocation) loc.hidden = false;

    // an email may only wrap after the @ or before its last ".com" (".org" ...), never in the middle of a word
    const mail = e => esc(e).replace('@', '@<wbr>').replace(/\.([a-z]{2,})$/i, '<wbr>.$1');
    const card = (x, i) => {
      const p = x.p, f = TS.photos[p.name];
      const hs = f ? `<div class="hs has-photo" aria-hidden="true"><img src="${esc(TS.peopleBase + f)}" alt="" loading="lazy" decoding="async"></div>` : `<div class="hs" aria-hidden="true">${esc(initials(p.name))}</div>`;
      const vc = [p.name, p.title, p.phone, p.email].filter(Boolean).join('\n');
      return `<article class="mt-card ${esc(x.dv.brand || '')}" style="--i:${i}">
        <p class="mt-map">${esc(x.dv.title)}</p>
        <p class="mt-reg">${esc(x.t.name)}${x.open ? ' (open)' : ''}</p>
        <div class="contact mt-contact">
          <div class="mt-head">${hs}<div><strong>${esc(p.name)}</strong>${p.title ? `<span>${esc(p.title)}</span>` : ''}</div></div>
          <div class="mt-links">${p.phone ? `<a href="tel:${esc(String(p.phone).replace(/[^\d+]/g, ''))}">${esc(p.phone)}</a>` : ''}${p.email ? `<a href="mailto:${esc(p.email)}">${mail(p.email)}</a>` : ''}
          <button type="button" class="copy-btn" data-copy="${esc(vc)}" aria-label="Copy ${esc(p.name)}'s contact details">${COPY}<span class="cb-t">Copy</span></button></div>
        </div></article>`;
    };
    const KEY = 'myTeam';   // the last place found, kept on this device only, so the team is still there when you come back
    const save = v => { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch (e) {} };
    const pdf = document.getElementById('team-pdf');
    const hide = () => { reveal.classList.remove('on'); reveal.setAttribute('aria-hidden', 'true'); document.documentElement.classList.remove('mt-has'); if (pdf) pdf.hidden = true; };
    const show = (t, via, where) => {
      const list = TS.specialists(t.abbr);
      if (!list.length) return false;
      row.innerHTML = list.map(card).join('');
      if (pdf) { pdf.dataset.abbr = t.abbr; pdf.dataset.state = t.state; pdf.dataset.label = t.label; pdf.hidden = false; }   // the team PDF (teampdf.js) for this place
      reveal.classList.add('on'); reveal.removeAttribute('aria-hidden'); document.documentElement.classList.remove('mt-has');
      status.textContent = '';   // the cards speak for themselves; the line is only used for messages (nothing found, location off ...)
      return true;
    };
    const whereOf = t => t.label === t.state || /, [A-Z]{2}$/.test(t.label) ? t.label : t.label + ', ' + t.state;
    let seq = 0;
    const run = async (raw, via) => {
      raw = raw.trim(); const mine = ++seq;
      if (!raw) { hide(); status.textContent = ''; save(null); return; }
      await TS.ready().catch(() => {}); if (mine !== seq) return;
      const r = TS.filter(raw);
      if (r.team) {
        const where = whereOf(r.team);
        if (!show(r.team, via, where)) { hide(); status.textContent = 'No technical specialists are listed for ' + where + ' yet.'; save(null); return; }
        save({ q: raw, via: !!via, team: r.team });
      } else {
        hide();
        status.textContent = r.place && r.place.states.length > 1 ? r.place.label + ' is in more than one state (' + r.place.states.join(', ') + '). Add the state to narrow it down.' : 'Enter a ZIP code, a city (with its state if you can) or a state.';
      }
    };

    try {   // coming back: show the saved place's team straight away, with no animation
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (saved && saved.team && saved.team.abbr) { q.value = saved.q || saved.team.label; clear.hidden = !q.value; row.classList.add('mt-instant'); if (!show(saved.team, saved.via, whereOf(saved.team))) { hide(); save(null); } setTimeout(() => row.classList.remove('mt-instant'), 100); }
      else hide();
    } catch (e) { hide(); }
    let timer = 0;   // search once typing has paused, or at once on Enter
    q.addEventListener('input', () => { clear.hidden = !q.value; clearTimeout(timer); timer = setTimeout(() => run(q.value), 650); });
    q.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(timer); run(q.value); } });
    clear.addEventListener('click', () => { q.value = ''; clear.hidden = true; clearTimeout(timer); run(''); q.focus(); });

    // ---- Use my location ----
    const states = JSON.parse(document.getElementById('search-data').textContent).states || {};
    const load = src => new Promise((res, rej) => {
      if (document.querySelector('script[src="' + src + '"]')) return res();
      const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('script failed to load')); document.head.appendChild(s);
    });
    let geo;
    const stateAt = async (lat, lon) => {   // which state is this position in? (the same pre-projected outlines the maps draw)
      if (!geo) {
        await load(sec.dataset.d3); await load(sec.dataset.topo);
        const us = await (await fetch(sec.dataset.map)).json();
        geo = { feats: topojson.feature(us, us.objects.states).features, proj: d3.geoAlbersUsa().scale(1300).translate([487.5, 305]) };
      }
      const pt = geo.proj([lon, lat]); if (!pt) return null;
      const rings = g => g.type === 'Polygon' ? [g.coordinates[0]] : g.coordinates.map(poly => poly[0]);
      let hit = null;
      outer: for (const f of geo.feats) for (const ring of rings(f.geometry)) if (d3.polygonContains(ring, pt)) { hit = f; break outer; }
      if (!hit) {   // just off the coast or on a border: the state with the nearest outline point, if it is close
        let best = null;
        geo.feats.forEach(f => rings(f.geometry).forEach(ring => ring.forEach(v => { const d = Math.hypot(v[0] - pt[0], v[1] - pt[1]); if (!best || d < best.d) best = { d, f }; })));
        if (best && best.d < 15) hit = best.f;
      }
      return hit && (states[String(hit.id).padStart(2, '0')] || {}).name || null;
    };
    loc.addEventListener('click', async () => {
      const label = loc.lastChild.textContent; loc.disabled = true; loc.lastChild.textContent = 'Locating…'; status.textContent = 'Finding your location…';
      try {
        const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 12000, maximumAge: 600000 }));
        const name = await stateAt(pos.coords.latitude, pos.coords.longitude);
        if (!name) { hide(); status.textContent = 'Your location is outside the SEPRO territory maps. Enter a ZIP code, city or state instead.'; }
        else { q.value = name; clear.hidden = false; await run(name, true); }
      } catch (e) {
        hide(); status.textContent = e && e.code === 1 ? 'Location is turned off for this site. Enter a ZIP code, city or state instead.' : 'We could not find your location. Enter a ZIP code, city or state instead.';
      }
      loc.disabled = false; loc.lastChild.textContent = label;
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();   // search.js loads after the page content
})();
