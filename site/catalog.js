export const SORT_RECENT = 'recent';
export const SORT_ALPHA = 'alpha';
export const SORT_MODES = [SORT_RECENT, SORT_ALPHA];

export function normalizeSort(mode) {
  return SORT_MODES.includes(mode) ? mode : SORT_RECENT;
}

function nameOf(entry, lang) {
  return String(entry.name?.[lang] || entry.name?.en || '');
}

/**
 * A new array, leaving the build's canonical catalog untouched. Recent uses an
 * ISO day, so the comparison is both timezone-free and lexicographically exact;
 * games committed on the same day fall back to their name in the active flag.
 */
export function sortCatalog(entries, mode = SORT_RECENT, lang = 'en') {
  const chosen = normalizeSort(mode);
  const locale = lang === 'pt' ? 'pt-BR' : 'en';
  return [...entries].sort((a, b) => {
    if (chosen === SORT_RECENT) {
      const byDay = String(b.added || '').localeCompare(String(a.added || ''));
      if (byDay) return byDay;
    }
    return nameOf(a, lang).localeCompare(nameOf(b, lang), locale, { sensitivity: 'base' });
  });
}
