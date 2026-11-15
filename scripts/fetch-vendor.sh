#!/bin/sh
# Downloads the libraries and map data the site needs into static/vendor/ so nothing loads from a public CDN.
# Run once from anywhere:  sh scripts/fetch-vendor.sh      (re-run to update)
# The site automatically uses these local files whenever they exist.
set -e
cd "$(dirname "$0")/.."
mkdir -p static/vendor
get() { echo "Downloading $2"; curl -fsSL "$1" -o "static/vendor/$2"; [ -s "static/vendor/$2" ] || { echo "Failed: $2"; exit 1; }; }
get https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js                           d3.min.js
get https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/dist/topojson-client.min.js topojson-client.min.js
get https://cdn.jsdelivr.net/npm/us-atlas@3/states-albers-10m.json                 us-states.json
get https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js            jspdf.umd.min.js
echo "Done. Files are in static/vendor/. Restart 'hugo server' if it is running."
