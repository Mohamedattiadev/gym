#!/usr/bin/env bash
# One command (block 27) for every automated check. Exit 1 if anything fails.
#   tools/test/all.sh [outDir]      (starts the static server on :8765 if it is down)
cd "$(dirname "$0")/../.." || exit 1
OUT="${1:-/tmp/gym-all}"; mkdir -p "$OUT"; fail=0
if ! curl -sI localhost:8765 >/dev/null 2>&1; then
  (cd app && python3 -m http.server 8765 >/dev/null 2>&1 &); sleep 1.5
fi
step() { printf '\n== %s\n' "$1"; shift; if "$@"; then echo "-> ok"; else echo "-> FAIL"; fail=1; fi; }
step "fast checks (unit, syntax, precache, CSP, imports, sw VERSION)" bash tools/test/fast.sh
step "route smoke test (phone + desktop, light + dark)" node tools/test/routes.mjs "$OUT/routes"
# Q6: the route screenshots vs tools/test/baseline (diff PNGs in $OUT/routes/visual-diff). Intended look change -> python3 tools/test/visual.py "$OUT/routes" --update
step "visual baseline (route screenshots)" python3 tools/test/visual.py "$OUT/routes"
step "3D prop check" node tools/test/check3d.mjs
step "account sign-in + Supabase sync (fake Supabase, two phones)" node tools/test/cloud.mjs "$OUT/cloud"
# Q0b: every button on every page (phone light, ~8 min). SKIP_CLICK=1 skips it; the full 4-viewport run = node tools/test/clickthrough.mjs <dir>
[ -n "$SKIP_CLICK" ] || step "click-through (every button, phone light)" node tools/test/clickthrough.mjs "$OUT/click" --quick
echo; [ $fail = 0 ] && echo "ALL PASS" || echo "SOME CHECKS FAILED"; exit $fail
