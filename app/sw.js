/* Offline support: app shell is precached (stale-while-revalidate); posters/videos are cached on first view
   (or all at once via Settings → Download all). Videos answer Range requests from cache. */
const VERSION = "v16";
const SHELL = `gym-shell-${VERSION}`;
const MEDIA = "gym-media-v1"; // keep name stable so downloaded media survives app updates
const SHELL_FILES = ["./", "index.html", "css/app.css", "fonts/Inter.woff2", "manifest.webmanifest",
  ...["main", "ui", "store", "data", "calc", "body", "anatomy", "train", "timer", "sync", "home", "exercise", "me", "guide", "share", "view3d", "warmup"].map((m) => `js/${m}.js`),
  "data/exercises.json", "data/families.en.json", "data/figures.json", "data/guide/heads.json", "data/guide/joints.json",
  ...["plans", "nutrition", "standards", "onboarding", "equipment", "warmups"].map((n) => `data/guide/${n}.json`),
  ...["empty-history", "empty-workouts", "hero-start", "plan", "pr", "rest-recovery", "timer", "warmup"].map((n) => `illustrations/${n}.svg`),
  "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("gym-shell-") && k !== SHELL) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function rangeResponse(resp, rangeHeader) {
  const buf = await resp.arrayBuffer();
  const m = /bytes=(\d*)-(\d*)/.exec(rangeHeader || "");
  const size = buf.byteLength;
  let start = m && m[1] ? +m[1] : 0;
  let end = m && m[2] ? +m[2] : size - 1;
  if (m && !m[1] && m[2]) { start = size - +m[2]; end = size - 1; }
  end = Math.min(end, size - 1);
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      "Content-Type": resp.headers.get("Content-Type") || "video/mp4",
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Content-Length": String(end - start + 1),
      "Accept-Ranges": "bytes",
    },
  });
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (url.pathname.includes("/media/")) {
    e.respondWith((async () => {
      const cache = await caches.open(MEDIA);
      const key = url.origin + url.pathname;
      let hit = await cache.match(key);
      if (!hit) {
        try {
          const full = await fetch(key); // fetch whole file (no Range) so it can be cached
          if (full.ok) { await cache.put(key, full.clone()); hit = full; }
          else return full;
        } catch {
          return new Response("", { status: 504 });
        }
      }
      const range = req.headers.get("range");
      return range ? rangeResponse(hit, range) : hit;
    })());
    return;
  }

  // app shell & data: stale-while-revalidate → instant start even with weak gym signal; fresh copy next launch
  e.respondWith((async () => {
    const cache = await caches.open(SHELL);
    const hit = await cache.match(req, { ignoreSearch: true });
    const net = fetch(req).then((r) => { if (r.ok) cache.put(req, r.clone()); return r; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    return (await net) || (req.mode === "navigate" ? cache.match("index.html") : new Response("", { status: 504 }));
  })());
});
