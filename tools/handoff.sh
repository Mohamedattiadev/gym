#!/usr/bin/env bash
# Opens a fresh Claude Code session in a new kitty window that continues from NEXT_SESSION.md.
# Used by Claude itself when its context gets large (saves tokens vs. a long session).
cd "$(dirname "$0")/.." || exit 1
kitty --detach -d "$PWD" --title "gym-y (next)" \
  claude --permission-mode auto \
  "/home/ati/Attia-Pro/Projects/gym-y/NEXT_SESSION.md dosyasını oku ve aynen uygula. Bana Türkçe cevap ver." \
  >/dev/null 2>&1
echo "new session launched"
