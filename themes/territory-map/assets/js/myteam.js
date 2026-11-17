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
    const SAVE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>';
    const ARROW = d => '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + (d < 0 ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7') + '"/></svg>';
    const card = (x, i, all) => {
      const p = x.p, f = TS.photos[p.name];
      const hs = f ? `<div class="hs has-photo" aria-hidden="true"><img src="${esc(TS.peopleBase + f)}" alt="" loading="lazy" decoding="async"></div>` : `<div class="hs" aria-hidden="true">${esc(initials(p.name))}</div>`;
      const vc = [p.name, p.title, p.phone, p.email].filter(Boolean).join('\n');
      return `<article class="mt-card ${esc(x.dv.brand || '')}" style="--i:${i}" role="group" aria-roledescription="slide" aria-label="${esc(p.name)}, ${i + 1} of ${all.length}">
        <p class="mt-map">${esc(x.dv.title)}</p>
        <p class="mt-reg">${esc(x.t.name)}</p>
        <div class="contact mt-contact">
          <div class="mt-head">${hs}<div><strong>${esc(p.name)}</strong>${p.title ? `<span>${esc(p.title)}</span>` : ''}</div></div>
          <div class="mt-links">${p.phone ? `<a href="tel:${esc(String(p.phone).replace(/[^\d+]/g, ''))}">${esc(p.phone)}</a>` : ''}${p.email ? `<a href="mailto:${esc(p.email)}">${mail(p.email)}</a>` : ''}
          <button type="button" class="copy-btn" data-copy="${esc(vc)}" aria-label="Copy ${esc(p.name)}'s contact details">${COPY}<span class="cb-t">Copy</span></button></div>
        </div>
        <button type="button" class="mt-save" data-i="${i}">${SAVE}<span>Save to Contacts</span></button></article>`;
    };
    // ---- Phones: the team is a row of swipeable cards, each with a Save to Contacts button ----
    let team = [];
    const nav = document.createElement('div'); nav.className = 'mt-nav'; nav.hidden = true;
    nav.innerHTML = '<div class="mt-pager"><button type="button" class="mt-arrow" data-d="-1" aria-label="Previous specialist">' + ARROW(-1) + '</button><span class="mt-count" aria-live="polite"></span><button type="button" class="mt-arrow" data-d="1" aria-label="Next specialist">' + ARROW(1) + '</button></div><button type="button" class="mt-all">' + SAVE + '<span></span></button>';
    row.after(nav);
    const count = nav.querySelector('.mt-count'), allBtn = nav.querySelector('.mt-all');
    const phone = matchMedia('(max-width:700px)');
    const cards = () => [...row.querySelectorAll('.mt-card')];
    const here = () => { const cs = cards(), mid = row.scrollLeft + row.clientWidth / 2; let b = 0, bd = 1e9; cs.forEach((c, i) => { const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid); if (d < bd) { bd = d; b = i; } }); return b; };
    const go = i => {   // to card i (the arrows wrap round at either end); a short slide, or none if motion is reduced
      const cs = cards(); if (!cs.length) return; i = (i + cs.length) % cs.length; const c = cs[i];
      row.scrollTo({ left: c.offsetLeft - (row.clientWidth - c.offsetWidth) / 2, behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth' });
    };
    let raf = 0; const mark = () => { raf = 0; if (team.length > 1) count.textContent = (here() + 1) + ' of ' + team.length; };
    row.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(mark); }, { passive: true });
    nav.addEventListener('click', e => { const b = e.target.closest('.mt-arrow'); if (b) go(here() + +b.dataset.d); });
    const carousel = () => {
      const on = phone.matches && team.length > 0;
      row.setAttribute('role', 'region'); row.setAttribute('aria-roledescription', 'carousel'); row.setAttribute('aria-label', 'Your SEPRO team');
      if (on) row.tabIndex = 0; else row.removeAttribute('tabindex');   // focus the row and the arrow keys scroll it; no extra tab stop where the cards sit in a grid
      nav.hidden = !(phone.matches && team.length > 1); row.scrollLeft = 0; allBtn.hidden = team.length < 2; allBtn.lastChild.textContent = 'Save all ' + team.length + ' to Contacts'; mark();
    };
    phone.addEventListener('change', carousel);

    // The contact file (vCard): name, SEPRO, job title, phone, email, the map and region as a note, and the photo when there is one. Phones offer to add it to Contacts.
    const vEsc = v => String(v).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1');
    const fold = l => { const o = []; while (l.length > 74) { o.push(l.slice(0, 74)); l = ' ' + l.slice(74); } o.push(l); return o.join('\r\n'); };
    const photo64 = async p => {   // the headshot, embedded; skipped quietly if it can't be read or is large
      const f = TS.photos[p.name]; if (!f) return null;
      try {
        const b = await (await fetch(TS.peopleBase + f)).blob(); if (b.size > 250000) return null;
        const d = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });
        return { type: (b.type.split('/')[1] || 'jpeg').toUpperCase().replace('JPG', 'JPEG'), data: String(d).split(',')[1] };
      } catch (e) { return null; }
    };
    const vcard = async x => {
      const p = x.p, w = String(p.name).trim().split(/\s+/); let suffix = ''; if (w.length > 2 && /^(jr|sr|ii|iii|iv)\.?$/i.test(w[w.length - 1])) suffix = w.pop();
      const last = w.length > 1 ? w.pop() : '', first = w.join(' '), ph = await photo64(p);
      const L = ['BEGIN:VCARD', 'VERSION:3.0', 'N:' + [last, first, '', '', suffix].map(vEsc).join(';'), 'FN:' + vEsc(p.name), 'ORG:SEPRO Scientific'];
      if (p.title) L.push('TITLE:' + vEsc(p.title));
      if (p.phone) L.push('TEL;TYPE=WORK,VOICE:' + vEsc(p.phone));
      if (p.email) L.push('EMAIL;TYPE=INTERNET,WORK:' + vEsc(p.email));
      L.push('NOTE:' + vEsc(x.dv.title + ' - ' + x.t.name));
      if (ph) L.push('PHOTO;ENCODING=b;TYPE=' + ph.type + ':' + ph.data);
      L.push('END:VCARD'); return L.map(fold).join('\r\n');
    };
    const download = (name, text) => {
      const u = URL.createObjectURL(new Blob([text + '\r\n'], { type: 'text/vcard;charset=utf-8' })), a = document.createElement('a');
      a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
    };
    const saved = (b, label) => { const t = b.lastChild, was = label || t.textContent; t.textContent = 'Contact file ready'; b.classList.add('done'); setTimeout(() => { t.textContent = was; b.classList.remove('done'); b.disabled = false; }, 2600); };
    const fileName = n => String(n).replace(/[^\w]+/g, '_').replace(/^_|_$/g, '') + '.vcf';
    row.addEventListener('click', async e => {
      const b = e.target.closest('.mt-save'); if (!b || b.disabled) return; const x = team[+b.dataset.i]; if (!x) return;
      b.disabled = true; const was = b.lastChild.textContent; b.lastChild.textContent = 'Preparing…';
      try { download(fileName(x.p.name), await vcard(x)); saved(b, was); } catch (err) { b.lastChild.textContent = was; b.disabled = false; }
    });
    allBtn.addEventListener('click', async () => {
      if (allBtn.disabled || !team.length) return; allBtn.disabled = true; const was = allBtn.lastChild.textContent; allBtn.lastChild.textContent = 'Preparing…';
      try { download('SEPRO_Team.vcf', (await Promise.all(team.map(vcard))).join('\r\n')); saved(allBtn, was); } catch (err) { allBtn.lastChild.textContent = was; allBtn.disabled = false; }
    });

    const KEY = 'myTeam';   // the last place found, kept on this device only, so the team is still there when you come back
    const save = v => { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch (e) {} };
    const pdf = document.getElementById('team-pdf');
    const hide = () => { reveal.classList.remove('on'); reveal.setAttribute('aria-hidden', 'true'); document.documentElement.classList.remove('mt-has'); if (pdf) pdf.hidden = true; nav.hidden = true; };
    const show = (t, via, where) => {
      const list = TS.specialists(t.abbr);
      if (!list.length) return false;
      row.innerHTML = list.map((x, i) => card(x, i, list)).join(''); team = list; carousel();
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
