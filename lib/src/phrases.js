// The kit's own phrases, in both languages.
//
// `createSave` has things to say — "saved", "that file belongs to another
// game" — and so does every game's exit back to the catalog. Leaving those to
// each game meant four copies of the same four sentences, and four chances for
// one of them to ship in one language only.
//
// `createI18n` merges these in under the game's dictionary, so a game that
// wants different wording just declares the same key and wins.

export const KIT_PHRASES = {
  'slop.saved': { en: '💾 Game saved', pt: '💾 Jogo salvo' },
  'slop.saveFailed': { en: "⚠️ Couldn't save: {error}", pt: '⚠️ Não deu para salvar: {error}' },
  'slop.downloaded': { en: '📥 Save downloaded', pt: '📥 Save baixado' },
  'slop.downloadFailed': { en: '⚠️ Download failed', pt: '⚠️ Download falhou' },
  'slop.unreadableFile': { en: 'unreadable file', pt: 'arquivo ilegível' },
  'slop.wrongGame': {
    en: 'that save belongs to "{game}", not this game',
    pt: 'esse save é do "{game}", não deste jogo',
  },
  'slop.nothingChosen': { en: 'nothing chosen', pt: 'nada escolhido' },
  'slop.readFailed': { en: 'failed to read the file', pt: 'falha ao ler o arquivo' },

  // every game owes the player a way back — see the catalog contract
  'slop.backToCatalog': { en: '🕹️ all games', pt: '🕹️ todos os jogos' },
  'slop.rotateDevice': { en: 'Rotate your device', pt: 'Gire o aparelho' },
  'slop.sound': { en: 'Sound', pt: 'Som' },
  'slop.on': { en: 'on', pt: 'ligado' },
  'slop.off': { en: 'off', pt: 'desligado' },
};
