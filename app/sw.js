/* Offline support. Code (js/css/html) = cache-first from ONE versioned cache, so a page never mixes versions
   (FE-3/PERF-5); a new version waits until the user taps "Reload" (or all windows close). data/*.json and
   illustrations = stale-while-revalidate. 3D engine + model = cache-first in a stable cache that survives app
   updates (PERF-4). Posters/videos are cached on first view (or Settings → Download all); videos answer Range. */
const VERSION = "v42";
const SHELL = `gym-shell-${VERSION}`;
const MEDIA = "gym-media-v1"; // keep name stable so downloaded media survives app updates
const THREE_D = "gym-3d-v1"; // vendor/three + 3d/body.glb + 3d/anim: bump ONLY when those files change
const SHELL_FILES = ["./", "index.html", "css/app.css", "fonts/Inter.woff2", "manifest.webmanifest",
  ...["main", "ui", "store", "data", "calc", "body", "anatomy", "train", "timer", "sync", "home", "exercise", "me", "guide", "share", "view3d", "warmup", "media", "csv", "log", "sanitize"].map((m) => `js/${m}.js`),
  "data/exercises.json", "data/families.en.json", "data/figures.json", "data/guide/heads.json", "data/guide/joints.json",
  ...["plans", "nutrition", "standards", "onboarding", "equipment", "warmups"].map((n) => `data/guide/${n}.json`),
  ...["empty-history", "empty-workouts", "hero-start", "plan", "pr", "rest-recovery", "timer", "warmup"].map((n) => `illustrations/${n}.svg`),
  "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png"];

self.addEventListener("install", (e) => {
  // cache:"reload" bypasses the HTTP cache so a new version never precaches 10-minute-old copies (FE-4)
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES.map((u) => new Request(u, { cache: "reload" })))));
});
self.addEventListener("message", (e) => { if (e.data === "skip") self.skipWaiting(); });

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("gym-shell-") && k !== SHELL) await caches.delete(k);
    await self.clients.claim();
  })());
});

// rest-end notification (media.js) -> tap opens / focuses the app
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (all.length) return all[0].focus();
    return self.clients.openWindow("./#/train");
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
      const hit = await cache.match(key);
      if (!hit) {
        // a whole-file request (poster, Download all) is fetched once and stored as it streams through
        if (!req.headers.get("range")) {
          const r = await fetch(key).catch(() => null);
          if (r && r.ok && r.status === 200) e.waitUntil(cache.put(key, r.clone()).catch(() => {}));
          return r || new Response("", { status: 504 });
        }
        // PERF-1: video Range request — stream the network response now (playback starts after the first ~100 KB);
        // cache the whole file in the background
        e.waitUntil(fetch(key).then((r) => r.ok && cache.put(key, r)).catch(() => {}));
        return fetch(req).catch(() => new Response("", { status: 504 }));
      }
      const range = req.headers.get("range");
      return range ? rangeResponse(hit, range) : hit;
    })());
    return;
  }

  const p = url.pathname, key = url.origin + p; // one entry per file (query strings ignored)
  const is3d = /\/vendor\/three\/|\/3d\/(body\.glb|anim\/)/.test(p);
  const swr = /\/data\/|\/illustrations\//.test(p);
  e.respondWith((async () => {
    const cache = await caches.open(is3d ? THREE_D : SHELL);
    const hit = await cache.match(key) || (req.mode === "navigate" && await cache.match(new URL("./", location).href));
    const net = fetch(req).then((r) => { if (r.ok && r.status === 200) cache.put(key, r.clone()); return r; }).catch(() => null);
    if (hit) { if (swr) e.waitUntil(net); return hit; }
    return (await net) || (req.mode === "navigate" ? cache.match(new URL("index.html", location).href) : new Response("", { status: 504 }));
  })());
});
