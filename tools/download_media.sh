#!/usr/bin/env bash
# Downloads each exercise video from Mux, re-encodes it to a small silent looping MP4
# (GIF-like, 720p ~600KB) plus a WebP poster (PERF-13). Skips files that already exist, so it can be re-run.
set -uo pipefail
cd "$(dirname "$0")/.."
mkdir -p media/video media/poster
JOBS="${JOBS:-4}"

one() {
  slug="$1"; stream="$2"; thumb="$3"
  mp4="media/video/$slug.mp4"; jpg="media/poster/$slug.webp"
  if [[ -n "$stream" && ! -s "$mp4" ]]; then
    # use the 720p variant (sharp but small); fall back to master playlist
    variant=$(curl -s --max-time 20 "$stream" | awk '/RESOLUTION=720x|RESOLUTION=[0-9]+x720/{getline; print; exit}')
    [[ -z "$variant" ]] && variant="$stream"
    if ffmpeg -nostdin -v error -y -i "$variant" -an -vf "scale='min(720,iw)':-2,fps=30" \
         -c:v libx264 -crf 27 -preset medium -pix_fmt yuv420p -movflags +faststart "$mp4.tmp.mp4"; then
      mv "$mp4.tmp.mp4" "$mp4"
    else
      rm -f "$mp4.tmp.mp4"; echo "FAIL video $slug" >&2
    fi
  fi
  if [[ ! -s "$jpg" ]]; then
    if [[ -s "$mp4" ]]; then
      ffmpeg -nostdin -v error -y -ss 1 -i "$mp4" -frames:v 1 -vf scale=480:-2 -c:v libwebp -quality 75 "$jpg" || echo "FAIL poster $slug" >&2
    elif [[ -n "$thumb" ]]; then
      curl -s --max-time 30 -o "$jpg.tmp" "${thumb%%\?*}?width=480" && \
        ffmpeg -nostdin -v error -y -i "$jpg.tmp" -c:v libwebp -quality 75 "$jpg"; rm -f "$jpg.tmp"
    fi
  fi
  echo "ok $slug"
}
export -f one

# only exercises kept in app/data (deduped), skipping long talking "Program Videos"
jq -r --slurpfile keep app/data/exercises.json '
  ($keep[0] | map(select(.group != "Program Videos") | {(.slug): 1}) | add) as $k
  | .[] | select($k[.cached_slug]) | [.cached_slug, (.stream_url // ""), (.thumbnail // "")] | @tsv' raw/exercises.json |
  xargs -P "$JOBS" -d '\n' -I{} bash -c 'IFS=$'"'"'\t'"'"' read -r a b c <<< "{}"; one "$a" "$b" "$c"' 2>>raw/download_errors.log |
  awk '{n++; if (n%25==0) print n" done"; fflush()}'
echo "Finished. videos: $(ls media/video/*.mp4 2>/dev/null | wc -l), posters: $(ls media/poster | wc -l)"
echo "Errors (if any): raw/download_errors.log"
