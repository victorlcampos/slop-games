// Network helpers: fetch with a timeout, images with CORS, a concurrency pool
// The timeout only covers the wait for headers — a download in flight is not aborted.
export function fetchWithTimeout(url, opts = {}, ms = 25000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  return fetch(url, { ...opts, signal: ctl.signal }).finally(() => clearTimeout(t));
}

export function loadImage(url, ms = 25000) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const t = setTimeout(() => { img.src = ''; reject(new Error('timeout: ' + url)); }, ms);
    img.onload = () => { clearTimeout(t); resolve(img); };
    img.onerror = () => { clearTimeout(t); reject(new Error('failed to load: ' + url)); };
    img.src = url;
  });
}

// Runs `tasks` (fns returning a Promise) with at most `n` at a time.
// Individual errors become { __err } in the result — it never rejects the whole.
export async function pool(tasks, n, onDone) {
  let i = 0, done = 0;
  const results = new Array(tasks.length);
  async function worker() {
    while (i < tasks.length) {
      const idx = i++;
      try { results[idx] = await tasks[idx](); }
      catch (e) { results[idx] = { __err: e }; }
      done++;
      if (onDone) onDone(done, tasks.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, Math.max(1, tasks.length)) }, worker));
  return results;
}

/**
 * An error whose text is a sentence for the PLAYER. It carries the dictionary
 * key rather than the resolved string, so the loading card can show it on its
 * own — and say it again in the other language if the flag changes while the
 * card is up.
 */
export function localized(key, values) {
  const e = new Error(key);
  e.i18nKey = key;
  e.i18nValues = values;
  return e;
}
