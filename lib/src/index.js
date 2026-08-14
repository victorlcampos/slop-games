// slopkit — what every game here needs before it can be a game.
//
// Each piece came from whichever game already did it best:
//   viewport → elastic width from Animals vs Monsters + Zoo's DPR ceiling
//   loop     → fixed step with accumulator and guard, from Zoo Tycoon
//   save     → Zoo's single format + Animals' defensive normalisation
//   sound    → persisted mute, which 3 of the 4 already did
//   i18n     → new: every game ships in Portuguese and English
//
// Nothing here draws anything: the artwork belongs to each game.

export { createViewport, isTouch, measure } from './viewport.js';
export { createLoop, stepsFor } from './loop.js';
export { createSave, downloadText, readTextFile } from './save.js';
export { createSound } from './sound.js';
export { createI18n, pickLang, interpolate, missingKeys, LANGS, FALLBACK } from './i18n.js';
export { LANG_NAMES } from './langs.js';
export { KIT_PHRASES } from './phrases.js';
export { drawFlag, flagDataURL, allFlags } from './flags.js';
export { mountLangPicker, bindText, drawLangPicker, pickLangAt } from './langpicker.js';
export { createCutscene, KIT_SKIP_HINT } from './cutscene.js';
