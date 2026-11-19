#!/usr/bin/env bash
# Fast checks (FE-27): no browser, no server, ~2 s. all.sh runs these first; CI runs them on every push.
#   tools/test/fast.sh              (locally: a missing sw VERSION bump is only a warning)
#   SW_BASE=<sha> tools/test/fast.sh (CI: fail if app/ changed since <sha> but VERSION did not)
cd "$(dirname "$0")/../.." || exit 1
fail=0
step() { printf '\n== %s\n' "$1"; shift; if "$@"; then echo "-> ok"; else echo "-> FAIL"; fail=1; fi; }
step "unit tests (calc, merge, sanitize, csv, search, stats, i18n)" node --test tools/test/unit/*.test.mjs
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
step "no module imports main.js (FE-12: no circular imports)" bash -c '! grep -nE "from \"\./main\.js\"|import\(\"\./main\.js\"\)" app/js/*.js'
step "user text escaped in templates (FE-24)" bash tools/test/check-esc.sh
step "i18n keys collected (t() keys are literals)" node tools/i18n/keys.mjs
step "sw VERSION bumped when app/ changed" bash tools/check-sw.sh "${SW_BASE:-}"
echo; [ $fail = 0 ] && echo "FAST PASS" || echo "FAST CHECKS FAILED"; exit $fail
