#!/usr/bin/env bash
# FE-27: bump the service worker VERSION in app/sw.js (v91 -> v92). Every release needs one,
# otherwise installed apps keep the old cached code.
#   tools/bump-sw.sh          next number
#   tools/bump-sw.sh v95      set it (when a parallel session already took the next one)
cd "$(dirname "$0")/.." || exit 1
cur=$(grep -oE 'const VERSION = "v[0-9]+"' app/sw.js | grep -oE '[0-9]+')
[ -n "$cur" ] || { echo "no VERSION = \"vNN\" in app/sw.js"; exit 1; }
if [ -n "$1" ]; then next="${1#v}"; else next=$((cur + 1)); fi
echo "$next" | grep -qE '^[0-9]+$' && [ "$next" -gt "$cur" ] || { echo "new version must be a number above v$cur"; exit 1; }
sed -i -E "s/const VERSION = \"v$cur\"/const VERSION = \"v$next\"/" app/sw.js
echo "sw VERSION v$cur -> v$next"
