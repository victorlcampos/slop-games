// The one file that makes the installed app work with the plane in flight mode.
//
// Everything here is already a single self-contained HTML page, so there is
// nothing to fetch *inside* a game — but the page itself still has to come from
// somewhere, and without a service worker that somewhere is the network. An
// installed PWA with no connection shows the dinosaur, one file or not. That is
// what this fixes, and it is the only reason it exists.
//
// It is deliberately small and readable rather than minified: it is the piece
// of the site that lives longest in a player's browser, and the one nobody can
// reach with a refresh when it goes wrong.
//
// The build fills in the two blanks below — see build.mjs at the root.

const VERSION = '/*__VERSION__*/';
const FILES = /*__FILES__*/ [];
const CACHE = 'slop-games:' + VERSION;

/**
 * The catalog and every game, taken in one go.
 *
 * The whole point is a player who installs the app on airport wifi and opens it
 * on the plane: caching only what has already been visited would leave them
 * with one game and four dinosaurs. It is under two megabytes for the lot.
 *
 * The catalog itself must land or there is no app; the games are best-effort,
 * so one failed request cannot throw away an otherwise good install.
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await cache.add(new Request(FILES[0], { cache: 'reload' }));
      await Promise.allSettled(
        FILES.slice(1).map((file) => cache.add(new Request(file, { cache: 'reload' })))
      );
      await self.skipWaiting();
    })
  );
});

/** A new build means a new cache: the old one goes, and this one takes over now. */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((n) => n.startsWith('slop-games:') && n !== CACHE).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

/**
 * A directory and its index.html are the same page and two different cache
 * keys. The manifest's `start_url` is the directory, every card on the index
 * links to the file — so a cache filled by one would miss the other. Both are
 * asked under the file's name.
 */
function keyFor(url) {
  return url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname;
}

/** The network, but only for so long — past this the cache answers. */
const PATIENCE = 4000;

/**
 * A page here is the whole app: one self-contained file, nothing to fetch after
 * it. So **the page asks the network first**, and that choice is the difference
 * between a site that updates and one that does not.
 *
 * Cache-first was the first version of this and it was measurably wrong: with a
 * new build published, a player who already had the app came back twice and was
 * still reading the old page, because the worker answered from its cache before
 * the new worker had finished taking over. Asking the network first costs one
 * round trip that the site would have paid anyway — and every push reaches
 * everybody on the next open, which is what publishing is for.
 *
 * Offline, or on a connection that is dragging, the cache answers instead: the
 * whole catalog is already in there. That is strictly better than what a page
 * with no worker does with a bad connection, which is spin.
 */
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(request.mode === 'navigate' ? freshFirst(request, url) : cachedFirst(request, url));
});

async function freshFirst(request, url) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await impatiently(fetch(request));
    if (fresh && fresh.ok && fresh.type === 'basic') cache.put(keyFor(url), fresh.clone());
    return fresh;
  } catch (err) {
    const hit = await cache.match(keyFor(url));
    if (hit) return hit;
    // never seen, and no network: the catalog is a screen the player can act
    // on, which beats the browser's error page
    const shell = await cache.match(FILES[0]);
    if (shell) return shell;
    throw err;
  }
}

/** Everything that is not a page: the manifest, the icons. Those never change
 *  inside a build, and a build change replaces the whole cache. */
async function cachedFirst(request, url) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(keyFor(url));
  if (hit) return hit;
  const fresh = await fetch(request);
  if (fresh && fresh.ok && fresh.type === 'basic') cache.put(keyFor(url), fresh.clone());
  return fresh;
}

function impatiently(promise) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('the network is taking too long')), PATIENCE);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}
