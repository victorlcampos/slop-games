// Two languages for the whole world.
//
// The menu, the help card and the HUD labels are written inline in
// template.html as `data-pt` / `data-en`; what lives here is what the game
// builds while it runs — the loading steps, the toasts, the search states.

import { createI18n } from 'slopkit';

const DICT = {
  'page.title': {
    pt: 'WorldDrive — dirija em qualquer rua do mundo',
    en: 'WorldDrive — drive down any street in the world',
  },

  // ------------------------------------------------------------- loading
  'load.title': { pt: 'Preparando o mundo…', en: 'Preparing the world…' },
  'load.goingTo': { pt: 'Indo para {place}…', en: 'Heading to {place}…' },
  'load.osm': { pt: 'Ruas e prédios (OpenStreetMap)', en: 'Streets and buildings (OpenStreetMap)' },
  'load.mirror': { pt: 'espelho {i}/{n}', en: 'mirror {i}/{n}' },
  'load.retry': { pt: ' · 2ª rodada', en: ' · 2nd round' },
  'load.dem': { pt: 'Elevação do terreno (satélite)', en: 'Terrain elevation (satellite)' },
  'load.sat': { pt: 'Imagens de satélite', en: 'Satellite imagery' },
  'load.build': { pt: 'Construindo o mundo 3D', en: 'Building the 3D world' },
  'load.error': {
    pt: 'Erro inesperado ao carregar os dados.',
    en: 'Unexpected error while loading the data.',
  },
  'load.overpassBusy': {
    pt: 'Os servidores públicos do OpenStreetMap estão ocupados agora ({detail}). Aguarde alguns segundos e tente de novo.',
    en: 'The public OpenStreetMap servers are busy right now ({detail}). Wait a few seconds and try again.',
  },
  'load.noElevation': {
    pt: 'Não consegui baixar os dados de elevação.',
    en: "Couldn't download the elevation data.",
  },
  'load.noRoads': {
    pt: 'Não encontrei ruas dirigíveis nesse ponto. Escolha um lugar com estradas próximas (o pin precisa cair perto de uma rua).',
    en: 'No drivable streets found at that point. Pick a place with roads nearby (the pin has to land close to a street).',
  },

  // -------------------------------------------------------------- search
  'search.searching': { pt: 'Buscando…', en: 'Searching…' },
  'search.empty': {
    pt: 'Nada encontrado. Tente outro termo ou navegue no mapa.',
    en: 'Nothing found. Try another term or move around the map.',
  },

  // --------------------------------------------------------------- toasts
  'toast.youAreIn': { pt: 'Você está em {street}', en: 'You are on {street}' },
  'toast.goodTrip': { pt: 'Boa viagem!', en: 'Have a good trip!' },
  'toast.backToStreet': { pt: 'De volta à rua {name}', en: 'Back on the street {name}' },
  'toast.backToStreetPlain': { pt: 'De volta à rua', en: 'Back on the street' },
  'toast.camera': { pt: 'Câmera: {mode}', en: 'Camera: {mode}' },
  'camera.chase': { pt: 'perseguição', en: 'chase' },
  'camera.close': { pt: 'próxima', en: 'close' },
  'camera.aerial': { pt: 'aérea', en: 'aerial' },
  'toast.soundOff': { pt: 'Som desligado', en: 'Sound off' },
  'toast.soundOn': { pt: 'Som ligado', en: 'Sound on' },
  'toast.qualityDropped': {
    pt: 'Qualidade reduzida para manter a fluidez',
    en: 'Quality lowered to keep it smooth',
  },

  // ----------------------------------------------------------------- HUD
  'hud.noName': { pt: 'sem nome', en: 'unnamed' },
  'hud.thisSpot': { pt: 'este ponto', en: 'this spot' },
};

export const i18n = createI18n({ dict: DICT });

export const t = (id, values) => i18n.t(id, values);

/** Reads a bilingual field written next to the data it names. */
export function pick(field) {
  if (field && typeof field === 'object' && !Array.isArray(field)) {
    if (field[i18n.lang] !== undefined) return field[i18n.lang];
    return field.en !== undefined ? field.en : field.pt;   // English is the default
  }
  return field;
}
