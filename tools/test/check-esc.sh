#!/usr/bin/env bash
# FE-24: every ${…name|note|title|label} in app/js template strings must go through esc() (rule at the top of ui.js),
# unless "<file> <expression>" is in tools/test/esc-allow.txt. Exit 1 lists the new ones.
cd "$(dirname "$0")/../.." || exit 1
allow=$(sed 's/#.*//; s/[[:space:]]*$//' tools/test/esc-allow.txt | grep -v '^$')
bad=0
while IFS=: read -r f n x; do
  key="$(basename "$f") $x"
  grep -qxF "$key" <<<"$allow" || { echo "not escaped: $f:$n $x"; bad=1; }
done < <(grep -noE '\$\{[^}{]*\.(name|note|notes|title|label|t)\}' app/js/*.js | grep -v 'esc(')
[ $bad = 0 ] && echo "all name/note/title/label values escaped or allowlisted"; exit $bad
