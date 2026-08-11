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
  'slop.saved': { pt: '💾 Jogo salvo', en: '💾 Game saved' },
  'slop.saveFailed': { pt: '⚠️ Não deu para salvar: {error}', en: "⚠️ Couldn't save: {error}" },
  'slop.downloaded': { pt: '📥 Save baixado', en: '📥 Save downloaded' },
  'slop.downloadFailed': { pt: '⚠️ Download falhou', en: '⚠️ Download failed' },
  'slop.unreadableFile': { pt: 'arquivo ilegível', en: 'unreadable file' },
  'slop.wrongGame': {
    pt: 'esse save é do "{game}", não deste jogo',
    en: 'that save belongs to "{game}", not this game',
  },
  'slop.nothingChosen': { pt: 'nada escolhido', en: 'nothing chosen' },
  'slop.readFailed': { pt: 'falha ao ler o arquivo', en: 'failed to read the file' },

  // every game owes the player a way back — see the catalog contract
  'slop.backToCatalog': { pt: '🕹️ todos os jogos', en: '🕹️ all games' },
  'slop.rotateDevice': { pt: 'Gire o aparelho', en: 'Rotate your device' },
  'slop.sound': { pt: 'Som', en: 'Sound' },
  'slop.on': { pt: 'ligado', en: 'on' },
  'slop.off': { pt: 'desligado', en: 'off' },
};
