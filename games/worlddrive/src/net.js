// Helpers de rede: fetch com timeout, imagens com CORS, pool de concorrência
// O timeout cobre apenas a espera pelos headers — um download em andamento não é abortado.
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
    img.onerror = () => { clearTimeout(t); reject(new Error('falha ao carregar: ' + url)); };
    img.src = url;
  });
}

// Executa `tasks` (fns que retornam Promise) com no máximo `n` simultâneas.
// Erros individuais viram { __err } no resultado — nunca rejeita o todo.
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
