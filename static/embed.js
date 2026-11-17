/* SEPRO Territory Maps: embed.
   On any web page, paste:
       <script src="https://findmyspecialist.site/embed.js" data-page="divisions/water/"></script>
   It puts the map in an iframe right there and keeps it exactly as tall as its content (no scrollbars).
   Options (all optional):  data-page  = the page to show, e.g. "divisions/water/" or "" (the map list)
                            data-theme = "light" or "dark" (default: follows the visitor's device)
                            data-min-height = least height in px before the page reports its size (default 560)
                            data-title = what screen readers call it */
(function () {
  var s = document.currentScript; if (!s || !s.src) return;
  var base = s.src.replace(/[^\/]*(\?.*)?$/, ''), origin = new URL(base).origin;
  var u = new URL(base + (s.getAttribute('data-page') || '').replace(/^\//, '')); u.searchParams.set('embed', '1');
  var th = s.getAttribute('data-theme'); if (th === 'light' || th === 'dark') u.searchParams.set('theme', th);
  var f = document.createElement('iframe');
  f.src = u.href; f.title = s.getAttribute('data-title') || 'SEPRO territory map'; f.loading = 'lazy';
  f.setAttribute('allow', 'clipboard-write; web-share');
  f.style.cssText = 'display:block;width:100%;border:0;overflow:hidden;min-height:' + (+s.getAttribute('data-min-height') || 560) + 'px';
  s.parentNode.insertBefore(f, s);
  addEventListener('message', function (e) {
    if (e.origin !== origin || e.source !== f.contentWindow || !e.data || e.data.sepro !== 'embed-height') return;
    f.style.height = Math.max(+e.data.height || 0, +s.getAttribute('data-min-height') || 560) + 'px';
  });
})();
