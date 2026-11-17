#!/usr/bin/env bash
# Logs into Get SWOLE with YOUR account (password is never stored),
# saves the API token, and downloads the full exercise list as JSON.
set -euo pipefail
cd "$(dirname "$0")/.."
API="https://train.getswole.app/api/v4"
UA="okhttp/4.12.0"
H=(-H "Accept: application/json" -H "PLATFORM-NAME: android" -H "FROM-APP-STORE: true" -H "CLIENT-VERSION: 5.31.0" -A "$UA")
mkdir -p raw/pages
TOKEN_FILE="raw/.token"

if [[ ! -s "$TOKEN_FILE" ]]; then
  EMAIL="${GS_EMAIL:-}"; PASS="${GS_PASS:-}"
  if [[ -z "$EMAIL" || -z "$PASS" ]]; then
    if [[ ! -t 0 ]]; then
      echo "No keyboard input here. Run this script in a normal terminal window so it can ask for your login."; exit 1
    fi
    read -rp "Get SWOLE email: " EMAIL
    read -rsp "Password: " PASS; echo
  fi
  RESP=$(jq -n --arg e "$EMAIL" --arg p "$PASS" '{email:$e,password:$p}' |
    curl -s "${H[@]}" -H "Content-Type: application/json" -X POST --data @- "$API/users/sign_in")
  unset PASS
  TOKEN=$(echo "$RESP" | jq -r '.auth_token // .user.auth_token // empty')
  if [[ -z "$TOKEN" ]]; then echo "Login failed: $(echo "$RESP" | head -c 300)"; exit 1; fi
  umask 077; printf '%s' "$TOKEN" > "$TOKEN_FILE"
  echo "Logged in, token saved."
fi
TOKEN=$(cat "$TOKEN_FILE")

page=1
while :; do
  out="raw/pages/$page.json"
  code=$(curl -s -o "$out" -w '%{http_code}' "${H[@]}" -H "API-TOKEN: $TOKEN" "$API/exercises?page=$page&per=100")
  [[ "$code" == 200 ]] || { echo "Page $page failed: HTTP $code $(head -c 200 "$out")"; exit 1; }
  n=$(jq '.exercise | length' "$out")
  echo "page $page: $n exercises"
  [[ "$n" -lt 100 ]] && break
  page=$((page+1)); sleep 1
done
jq -s '[.[].exercise[]]' raw/pages/*.json > raw/exercises.json
echo "Done: $(jq length raw/exercises.json) exercises -> raw/exercises.json"
