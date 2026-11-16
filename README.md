# SEPRO Territory Maps (Hugo)

    hugo server        # then open http://localhost:1313
    hugo               # builds the finished site into public/

## Where things live
- **content/divisions/*.md**: one page per division (title, order via `weight`, short summary, and `territoryData`, the name of its data file).
- **data/divisions/*.yaml**: each division's territories, colors, states, contacts, the always-visible national team, and the revised date.
- **hugo.toml**: site title, fonts and sizes, state-abbreviation styling, border width/color.
- **assets/css/custom.css**: your own CSS; loaded last, so it wins.

## Add a division
1. Copy a file in `data/divisions/` and edit it.
2. Copy a file in `content/divisions/`, change the title/weight, and set `territoryData` to the new data file's name (without `.yaml`).
It appears on the home page and in the top navigation automatically.

## Contact fields (data/divisions/*.yaml)
- `national:` people shown under the map at all times (`nationalTitle` is the heading; delete `national:` to hide it).
- Each territory has `contacts:` (specialists) and optional `managers:` (shown below them, e.g. a regional manager) and optional `group:` (small label above the name).

## State abbreviations
Each label is placed at the state's visual center (not the plain centroid), in the brand font (Helvetica Neue), with no shadow or outline. Text color is chosen per state, dark or light, whichever has more contrast on that state's color.
`[params.mapLabels]` in hugo.toml controls the font, size, weight, letter spacing, upper/lowercase, the auto-contrast colors (`darkColor`, `lightColor`) or one forced `color`, an optional outline (off by default), the offshore labels' color, leader lines, and which small states are labeled offshore. For anything else, edit `.lbl`, `.lbl.out` and `.leader` in `assets/css/custom.css`.
The PDF uses the same label positions but Helvetica (browser-built PDFs can't use web fonts without embedding the font file).

## Top menu bar
`[params.header]` in `hugo.toml`: company logo (left), logo link, bar color and text color. Each division link has a dot and underline in its brand color (blue for water, green for land). The five division links are on the right and use each division's short `navTitle` from its content file (falls back to `title`). Below 900px wide the links collapse behind a Menu button. The bar is a floating pill (`background` #ebebeb, with `glass` setting how see-through it is and a blur behind it, like Apple's Liquid Glass), so it uses the color master logo. In dark mode the pill turns dark (`backgroundDark`) and switches to the white logo (`logoDark`).

## Regions in the legend
When territories have a `group:` (Water: West / North / South Region), the legend lists each region with its territories under it. Hovering or clicking a region heading highlights all its territories and shows the region manager plus every specialist.

## Request Change button
White pill at the far right of the menu: `[params.header.cta]` in hugo.toml (`label` and `url`; opens in a new tab). Remove the `url` to hide it.

## Dark mode
A round floating button at the bottom left of every page switches dark mode. A visitor's choice is saved in their browser; until they choose, the site follows their system setting. Colors are the CSS variables at the top of `map.css` (the dark set appears twice: once for the system setting, once for the switch). The downloaded PDF is always light.

## PDF generation
Each division page has a **Generate PDF** button. The PDF is built in the browser (jsPDF from cdnjs, loaded on first click): one US Letter page, portrait (8.5 x 11 in).
- **Same map every time:** the map is always the same size (7.8 in wide) and in the same place on every division's PDF, with the title and logo above it.
- **Contacts:** each contact is listed with name (bold), job title, phone and email, with a color bullet beside the name matching their territory on the map. No region names.
- **Managers:** territories that list `managers:` in their data file are grouped by manager. The manager is shown in a shaded box at the top of a column, with a dot for each region they cover, and the specialists they oversee are listed beneath (Water: West / North / South). Territories with no manager flow west to east in three columns. The national team is listed below.
- **Text size:** as large as fits, never above `maxFontSize` (12pt). Spare vertical space is spread evenly between entries. If a division has so many contacts that 12pt won't fit below the map, the text steps down in small increments so the map size never changes.
- **Branding:** the PDF follows the site: brand black / dark grey / light grey, the header split like the SEPRO technical sheets (round logo mark left, title beside it, SEPRO + division wordmark right, both cut from the division's logo file), a "Generated <date>" line bottom-left (the day the PDF was made) and the revised date bottom-right, Helvetica text (the closest built-in match to Helvetica Neue; Light is approximated with regular weight) and a monospace revised date like the site's DM Mono detail copy. Unassigned states use the brand light grey.
- Layout code: `themes/territory-map/assets/js/pdf.js`.

## Brand: colors, fonts, logos
Follows the SEPRO Scientific style guide.
- **Fonts:** Helvetica Neue (Light for headlines in sentence case, Regular for body; a system font) and DM Mono for captions/detail copy (loaded from Google Fonts). Set in `[params.typography]`. The PDF uses Helvetica.
- **Colors:** `[params.brand]` in hugo.toml: `water` blue, `land` green, `sunset` orange (Generate PDF button, white text). Page neutrals (black, dark grey, light grey, white) are the CSS variables at the top of `map.css`.
- **Division color:** each division's content file has `brand: "water"` or `brand: "land"`. It colors that division's dot/underline in the menu, its home-page card, the line under its page title and a small bar in its PDF.
- **Logos:** `static/logos/` holds the master logo (a white version in the menu bar) and the Water and Land logos. The Water and Land logos appear in the PDFs (top right, set by `logo:` in each division's content file) and as the section headers on the landing page (`[params.landing.water]` / `[params.landing.eutrophix]` / `[params.landing.land]` in hugo.toml, with a dark-mode version for each). They are not shown on the division pages themselves. EutroPHIX has its own logo (`sepro-eutrophix.svg` and a dark-mode version), its own section between Water and Land on the landing page and in the Directory (`[params.landing.eutrophix]`; a division joins a section with `group:` in its content file, default its `brand:`), and its own cut of the logo in the PDF header. The tagline is converted to outlines, so it looks the same on every computer.
- **Territory colors:** set per territory in `data/divisions/*.yaml`. Land and the smaller water divisions use blues or greens only. Water is grouped by region, each region a color family (West purples, North greys, South blues) with every territory a shade of it, so you can read both the regions and the territories within them. Any division can do this: give its territories a `group:` and pick shades of one hue.

## Menu
The division links are condensed into a **Maps** dropdown (caret opens a list of the maps, each with its blue/green dot; the current map is highlighted). Maps are listed in `weight` order from the content files. The search box beside it reads "Search maps, states and more" and also matches map names.

## Directory
A **Directory** link in the menu (next to Maps) opens `/directory/`: a text-only contact list for every map, grouped under the SEPRO Water and SEPRO Land logos. Each map has a table with name, job title, phone, email and the states covered. Order within a map: national team (all states), regional managers (the combined states of their territories), then territory contacts (their territory's states). It reads the same `data/divisions/*.yaml` files as the maps, so it updates automatically. The only color is the water blue / land green accent. The page is in `content/directory/_index.md` and `layouts/directory/list.html`.

## Landing page
The home page groups the division cards by brand: a SEPRO Water section (Water, Municipal & Industrial, EutroPHIX), then a SEPRO Land section (Turf & Landscape, Ornamental). A division's section comes from `brand: "water"` or `brand: "land"` in its content file; the order within a section follows `weight`.

## Search
A search box in the menu bar (before the Request Change button, on every page) searches every contact in every division: name, job title, email, phone, state (full name or 2-letter code such as `FL`), territory and region names. Results open in a dropdown under the menu, grouped by division with this page's division first. "Show on map" pins that person's territory (or region, for managers); for another division it opens that division's page with the territory pinned. Matching territories on the current map are highlighted while you type. Esc clears the search. Links of the form `/divisions/water/#t=florida` open a page with that territory pinned.

## Self-hosting the map files (no public CDNs)
By default the map outlines, d3, topojson and the PDF library load from public CDNs. To serve everything from your own site, run this once from the project folder:

    sh scripts/fetch-vendor.sh

It saves `d3.min.js`, `topojson-client.min.js`, `us-states.json` (the map outlines) and `jspdf.umd.min.js` into `static/vendor/`. The site uses those files automatically whenever they are there (delete a file to go back to the CDN for it). `d3.min.js` is already included. The only remaining outside request is the DM Mono caption font from Google Fonts; set `monoURL = ""` in `hugo.toml` to drop it and use the system monospace font instead.

## Search engines, favicon and link previews
- **Hidden from search engines:** every page has a `noindex, nofollow, noarchive` tag (`layouts/partials/head-meta.html`), Netlify sends the same instruction as an `X-Robots-Tag` header (`netlify.toml`), and `static/robots.txt` asks crawlers to stay away. The sitemap, RSS feed and tag pages are switched off (`disableKinds` in `hugo.toml`). This keeps the site out of search results; it is not a lock, since anyone with the link can still open it.
- **Link-preview bots** (Slack, Teams, Facebook, X, LinkedIn) are allowed in `robots.txt` so shared links still show a title and image. They are not search engines. To block every bot, delete the second group in `robots.txt`.
- **Favicon:** the SEPRO Scientific circle mark: `static/favicon.svg`, `favicon.ico` and `apple-touch-icon.png` (iPhone/iPad home screen).
- **Link previews:** the title and description come from each page (`summary` on a division page, `description` on the Directory page, `description` in `[params]` for the home page). The image is `static/og-image.png` (1200 x 630, the full SEPRO Scientific logo). Replace that file to change it.

## Search by ZIP code or city, open positions, copy buttons
- **ZIP and city search:** typing a 5-digit ZIP ("46204") or a city ("Indianapolis", "Springfield MO") in the menu search lists everyone who covers that state, grouped by division, and highlights those territories on the map you are viewing. ZIPs are matched on their first three digits, so a few border ZIPs can land in the neighboring state. The built-in city list is large but not complete. Add anything missing, or exact ZIP overrides, in `data/places_extra.yaml` (instructions are at the top of that file). The built-in data lives in `themes/territory-map/data/places.yaml`.
- **Open positions:** a contact named "Open ..." (or marked `open: true`) shows "Contact <regional manager>" with their phone and email on the map cards and in search. If the territory has no manager, the site looks for a manager or national-team name in the open position's `title` (for example "Please contact Joe Lynch"). The Directory still hides open positions.
- **Tap to call / email:** phone numbers and emails are `tel:` and `mailto:` links everywhere.
- **Copy:** each contact has a Copy button (name, title, phone and email, one per line). The Directory uses the same labeled button, under each name.
- **Desktop Mode:** the white button left of Generate PDF (desktop only: hidden on phones and tablets). It shrinks the map slightly, hides the side panel and places every territory's contact card around the map (left, right, top or bottom, whichever its region faces), joined to its region by a thin black line (white in dark mode) with a dot (cards are ordered so lines never cross). Map text keeps its normal size. Regions are not dimmed in this mode. Hovering a card highlights its territory. Click the button again to exit. The card style is `.desk-card` at the bottom of `map.css` (margin width: `DESK_M` in `map.js` and the `calc(100% - 500px)` in `map.css`). **Generate PDF while in Desktop Mode** (the button turns citrus, `--citrus` in `map.css`, and reads "Generate Landscape PDF") makes a landscape Letter (11 x 8.5 in) PDF of exactly what is on screen: the map, the cards around it and the lines, with tappable phone and email links. Its cards are laid out at a real type size (10 to 14 pt; the map takes whatever room is left), using the same placement and line routing as on screen. The normal portrait PDF is what you get outside Desktop Mode; its text also never goes below 10 pt. State abbreviations on the maps are the exception (about 8 pt) because they have to fit inside the states.
- **Menu (desktop):** pressing *Maps* drops one glass pill per map in under the menu (they slide down one after another), spread evenly across the full page width, each with its colored dot; the current map is tinted. The menu itself does not change size. The pills stay (also across page loads, per browser tab) until *Maps* is pressed again. On phones and tablets the menu and Maps dropdown work as before. Code: `.maps-row` / `.maps-pill` in `baseof.html` and the bottom of `map.css`. The search field is the same height as the Request Change button.
- **Desktop Mode stays on between maps** (per browser tab, `sessionStorage`) and the change is animated and happens in place with no page load, and the page glides rather than jumps: the map slides to its new height, the buttons keep their labels, and the cards, lines, dots and colors animate in one after another (the map stays up; `map.js` fetches the next map's page, swaps the text and re-runs itself; the browser Back button falls back to a normal load): the current cards float off toward their side while lines and colors fade, then the new cards fly in, each line draws from its card to the region, the dots pop and the colors fade up. Skipped when the visitor prefers reduced motion. CSS: `desk-leaving` / `desk-arriving` at the bottom of `map.css`; click hook in `map.js`.
- **Map -> Directory transition.** From a map page (normal or Desktop Mode), the Directory menu link and "View this map as a text list" first fade the page out (`body.dir-leaving`, 0.28 s), then load the Directory, which rises from the bottom and fades in (`html.dir-enter`, set by a tiny script in `baseof.html`'s `<head>` from a `sessionStorage` flag that expires after 6 s; keyframes `dirIn` in `map.css`). It is a normal page load underneath (the header repaints, the Maps row stays open). Skipped for reduced motion.
- **Smoothness details.** The state outlines, borders and abbreviation positions are worked out once per visit (`window.__tmGeo`) and reused when switching maps, so a switch doesn't redo the heavy geometry. The menu highlights the new map the instant you click it. Directory -> map: the Directory sinks and fades out and the map page fades in (`html.map-enter`, same flag mechanism as the Directory entrance). Filtering the Directory lets the lists settle in with a short fade/slide instead of snapping.
- **Directory map buttons are filters.** Clicking a map button shows only that map's contacts (the button turns solid; click it again for every map). It combines with the search box below, `?map=water` in the address saves the choice, and a link ending `#water` also works (the `#` is dropped so the browser doesn't scroll to it). "View this map as a text list" uses `?map=`. `dirsearch.js` runs as soon as the lists exist, so a chosen map is in place on the first paint. While a map is chosen the "all maps" Generate buttons hide; that map keeps its own.
- **Directory filter.** A search box under the map buttons (`dirsearch.js`) filters the lists as you type, by name, title, state, ZIP code, city, territory or map, using the same matching as the menu search (`window.TerritorySearch` in `search.js`). Rows that don't match are hidden, along with any group or map left empty; the map buttons at the top dim for maps with no match, and the Generate buttons are hidden while a filter is on. The menu search box on that page drives the same filter (and stays in step with the page box), and `?q=...` in the address saves a filtered view. Each Directory row carries a `data-k` key (see `dirrow.html`) that must match the key built in `search.js`.
- **Normal view switches maps in place too.** Choosing another map from the header (Maps pills or phone menu) keeps the map on screen: the colors fade out, the new map's page is fetched and swapped in, and the colors and text fade up (`nm-leaving` / `nm-arriving` in `map.css`; the same `softNav` in `map.js`). The Back and Forward buttons work the same way, and the header (with its open Maps row) is never reloaded. Links to anything that isn't a map (Directory, landing page) load normally, with a browser cross-fade (`@view-transition`) where supported. Skipped for reduced motion.
- **Directory PDFs:** the Directory page has *Generate All PDFs* and *Generate All Landscape PDFs* at the top (one file with every map, in Directory order) and *Generate PDF* / *Generate Landscape PDF* beside each map's heading. Orange is portrait, citrus is landscape, matching the map pages. Each map is produced by loading its own page in a hidden frame, so the PDFs are identical to the ones from that page; it takes a few seconds per map. The landscape buttons are hidden on phones and tablets (they need the wide Desktop Mode layout). Code: `assets/js/dirpdf.js`.


## Hosting on GitHub Pages (instead of, or as well as, Netlify)

`.github/workflows/hugo.yml` builds the site with Hugo and publishes it on every push to `main`. One-time setup: on GitHub open the repo's **Settings > Pages > Build and deployment** and set **Source** to **GitHub Actions**. After the next push the site is at `https://<user>.github.io/<repo>/` (the workflow passes that address to Hugo as the base URL). Keep `HUGO_VERSION` in the workflow equal to the one in `netlify.toml`. Every page already carries a `noindex` tag, so no Netlify-style headers are needed. `netlify.toml` can stay (Netlify keeps working) or be deleted once you have moved. If you later add a custom domain, set it under Settings > Pages and add a `static/CNAME` file containing it.


## Desktop Mode performance
The card layout (`layoutDesk` in `map.js`) is cached: the same map and card sizes are never laid out twice, and the line-routing search stops early on lines that can't win and uses a grid for the abbreviation checks, so switching Desktop Mode on or changing maps responds in about a tenth of a second instead of half a second (the result is identical).

## Map text size in Desktop Mode
The state abbreviations keep exactly the same on-screen size in Desktop Mode, including while the map glides in and out (the text is counter-scaled each frame) and when the window is resized (the abbreviations' font-size transition, which exists for the hover growth, is switched off for those changes: `.map.lbl-still` in `map.css`, `setLbl` in `map.js`). Hovering a territory or card in Desktop Mode does not change the abbreviations' size or weight either (`body.desk .lbl.on` in `map.css`); in the normal view the hovered territory's abbreviations still grow 12% and turn bold.
