#!/usr/bin/env bash
# One command (block 27) for every automated check. Exit 1 if anything fails.
#   tools/test/all.sh [outDir]      (starts the static server on :8765 if it is down)
cd "$(dirname "$0")/../.." || exit 1
OUT="${1:-/tmp/gym-all}"; mkdir -p "$OUT"; fail=0
if ! curl -sI localhost:8765 >/dev/null 2>&1; then
  (cd app && python3 -m http.server 8765 >/dev/null 2>&1 &); sleep 1.5
fi
step() { printf '\n== %s\n' "$1"; shift; if "$@"; then echo "-> ok"; else echo "-> FAIL"; fail=1; fi; }
step "unit tests (calc, merge, sanitize)" node --test tools/test/unit/*.test.mjs
step "JS syntax (app/js, sw.js)" bash -c 'for f in app/js/*.js app/sw.js; do node --check "$f" || exit 1; done'
step "sw.js precache files exist" node -e '
  const fs=require("fs"); const m=fs.readFileSync("app/sw.js","utf8").match(/SHELL_FILES\s*=\s*(\[[\s\S]*?\]);\n/);
  if(!m){console.log("no SHELL_FILES");process.exit(1)} const list=eval(m[1]);
  const miss=list.filter(f=>f!=="./"&&!fs.existsSync("app/"+f)); console.log(list.length+" files");
  if(miss.length){console.log("missing:",miss.join(" "));process.exit(1)}'
step "CSP hash matches the inline splash script (SEC-4)" python3 -c '
import re,hashlib,base64,sys; h=open("app/index.html").read(); sc=re.findall(r"<script>(.*?)</script>",h,re.S)
ok=all("sha256-"+base64.b64encode(hashlib.sha256(s.encode()).digest()).decode() in h for s in sc) and "Content-Security-Policy" in h
print(len(sc),"inline script(s)"); sys.exit(0 if ok else 1)'
step "no inline on*= handlers in templates (CSP blocks them)" bash -c '! grep -nE " on[a-z]+=\"" app/js/*.js app/index.html'
step "route smoke test (phone + desktop, light + dark)" node tools/test/routes.mjs "$OUT/routes"
step "3D prop check" node tools/test/check3d.mjs
echo; [ $fail = 0 ] && echo "ALL PASS" || echo "SOME CHECKS FAILED"; exit $fail
