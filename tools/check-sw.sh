#!/usr/bin/env bash
# FE-27: a change under app/ must come with a new sw.js VERSION, or installed apps keep the old code.
#   tools/check-sw.sh <base-sha>   compare <base-sha>..HEAD, exit 1 if app/ changed but VERSION did not (CI)
#   tools/check-sw.sh              compare HEAD with the working tree, only warn (other sessions may have edits)
cd "$(dirname "$0")/.." || exit 1
ver() { grep -oE 'const VERSION = "[^"]+"' | head -1; }
base="$1"
if [ -n "$base" ] && ! echo "$base" | grep -qE '^0+$'; then
  git cat-file -e "$base^{commit}" 2>/dev/null || git fetch -q --depth=1 origin "$base" || { echo "base $base not found, skipped"; exit 0; }
  changed=$(git diff --name-only "$base" HEAD -- app/ ':!app/sw.js' ':!app/media' | head -5)
  old=$(git show "$base:app/sw.js" | ver); new=$(git show HEAD:app/sw.js | ver)
  [ -z "$changed" ] && { echo "app/ unchanged since ${base:0:7}"; exit 0; }
  [ "$old" != "$new" ] && { echo "app/ changed, VERSION ${old#*= } -> ${new#*= }"; exit 0; }
  echo "app/ changed since ${base:0:7} but sw.js VERSION is still ${new#*= }:"; echo "$changed"
  echo "run tools/bump-sw.sh and commit app/sw.js"; exit 1
fi
changed=$(git diff --name-only HEAD -- app/ ':!app/sw.js' ':!app/media' | head -5)
old=$(git show HEAD:app/sw.js | ver); new=$(ver < app/sw.js)
if [ -n "$changed" ] && [ "$old" = "$new" ]; then
  echo "WARNING: uncommitted app/ changes but VERSION is still ${new#*= } (run tools/bump-sw.sh before committing them):"; echo "$changed"
else echo "ok (${new#*= })"; fi
exit 0
