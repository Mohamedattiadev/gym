#!/bin/bash
# usage: sheets.sh outdir "fam prop muscles [wrong]" ...
# Run from the repo root (app served on :8765). Moved from a session scratchpad (session 55) so cleanup cannot delete it.
# env: ATS (json list of animation positions, default [0,0.36,0.65]), TW / TH (tile size px)
SP=$(dirname "$0"); out=$1; shift; mkdir -p $out
for spec in "$@"; do set -- $spec; n=$1${4:+-w$4}; python3 $SP/mk.py $1 $2 $3 $4 > $out/$n.json; node tools/test/shot.mjs $out $out/$n.json 2>&1 | grep -iE 'error|fail' | grep -vi vibrate | head -3; done
ls $out/*.png
