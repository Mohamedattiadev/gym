#!/usr/bin/env bash
# Q6 / block 23: Lighthouse mobile scores (default mobile emulation: Moto G class CPU x4, slow 4G).
#   tools/test/lighthouse.sh [url] [outDir]
#   url default http://localhost:8765/#/train (the app served by python http.server, no gzip -> worse than live)
#   live:  tools/test/lighthouse.sh https://mohamedattiadev.github.io/gym/#/train
# Boot at #/train: a fresh profile at #/ is sent to the onboarding (#/start).
# Needs network once (npx fetches lighthouse 13.6.0); uses the system chromium. Writes report.html + report.json.
cd "$(dirname "$0")/../.." || exit 1
URL="${1:-http://localhost:8765/#/train}"; OUT="${2:-/tmp/gym-lighthouse}"; mkdir -p "$OUT"
export CHROME_PATH="${CHROME_PATH:-$(command -v chromium || command -v chromium-browser || command -v google-chrome)}"
LH="${LH:-npx --yes lighthouse@13.6.0}"
$LH "$URL" --quiet --output=json --output=html --output-path="$OUT/report" \
  --chrome-flags="--headless=new --no-first-run" || exit 1
node -e '
const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
const c = r.categories, a = r.audits;
console.log("Lighthouse mobile", r.finalDisplayedUrl || r.finalUrl);
for (const k of Object.keys(c)) console.log("  " + c[k].title.padEnd(16), Math.round(c[k].score * 100));
for (const k of ["first-contentful-paint", "largest-contentful-paint", "total-blocking-time", "cumulative-layout-shift", "speed-index"])
  console.log("  " + a[k].title.padEnd(26), a[k].displayValue);
const bad = Object.values(a).filter((x) => x.score !== null && x.score < 0.9 && x.scoreDisplayMode !== "informative" && x.scoreDisplayMode !== "notApplicable");
if (bad.length) console.log("  below 0.9:", bad.map((x) => x.id).join(", "));
' "$OUT/report.report.json"
echo "report: $OUT/report.report.html"
