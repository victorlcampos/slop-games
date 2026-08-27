import { createI18n } from 'slopkit/i18n';

export const dict = {
  'page.title': { en: 'Steam Stack', pt: 'Pilha a Vapor' },
  'game.kicker': { en: 'IRON · STEAM · RIFFS', pt: 'FERRO · VAPOR · RIFFS' },
  'game.title': { en: 'STEAM STACK', pt: 'PILHA A VAPOR' },
  'game.tagline': {
    en: 'Feed the engine. Vent the rows. Do not let the pressure win.',
    pt: 'Alimente o motor. Esvazie as fileiras. Não deixe a pressão vencer.',
  },
  'game.story': {
    en: 'Seven brass moulds fall through the foundry. Complete a row and the boiler punches it apart in sparks, smoke and a louder riff.',
    pt: 'Sete moldes de latão caem pela fundição. Complete uma fileira e a caldeira a desmonta em faíscas, fumaça e um riff mais alto.',
  },
  'menu.start': { en: 'Fire the boiler', pt: 'Acender a caldeira' },
  'menu.controls': {
    en: '← → move · ↓ soft drop · Space hard drop · Z/X rotate · C hold · P pause',
    pt: '← → movem · ↓ desce · Espaço despenca · Z/X giram · C guarda · P pausa',
  },
  'menu.touch': {
    en: 'On a phone, the brass controls stay under the board.',
    pt: 'No celular, os controles de latão ficam sob o tabuleiro.',
  },
  'menu.best': { en: 'best pressure run', pt: 'melhor turno' },
  'menu.noRun': { en: 'No shift worked yet', pt: 'Nenhum turno trabalhado' },
  'menu.runRecord': { en: '{score} points · {lines} rows', pt: '{score} pontos · {lines} fileiras' },
  'hud.score': { en: 'SCORE', pt: 'PONTOS' },
  'hud.lines': { en: 'ROWS', pt: 'FILEIRAS' },
  'hud.level': { en: 'PRESSURE', pt: 'PRESSÃO' },
  'hud.hold': { en: 'HOLD', pt: 'RESERVA' },
  'hud.next': { en: 'NEXT', pt: 'PRÓXIMAS' },
  'hud.combo': { en: '{n}× COMBO', pt: 'COMBO {n}×' },
  'hud.b2b': { en: 'BACK-TO-BACK', pt: 'EM SEQUÊNCIA' },
  'hud.perfect': { en: 'CLEAN BOILER!', pt: 'CALDEIRA LIMPA!' },
  'hud.pause': { en: 'PRESSURE PAUSED', pt: 'PRESSÃO PAUSADA' },
  'hud.pauseHint': { en: 'P or tap pause to resume', pt: 'P ou toque em pausa para voltar' },
  'clear.1': { en: 'SINGLE VENT', pt: 'UMA VÁLVULA' },
  'clear.2': { en: 'DOUBLE VENT', pt: 'VÁLVULA DUPLA' },
  'clear.3': { en: 'TRIPLE VENT', pt: 'VÁLVULA TRIPLA' },
  'clear.4': { en: 'BOILER BLAST!', pt: 'EXPLOSÃO DA CALDEIRA!' },
  'over.title': { en: 'THE BOILER WON', pt: 'A CALDEIRA VENCEU' },
  'over.score': { en: 'score', pt: 'pontos' },
  'over.lines': { en: 'rows vented', pt: 'fileiras abertas' },
  'over.level': { en: 'pressure', pt: 'pressão' },
  'over.record': { en: 'NEW WORKS RECORD', pt: 'NOVO RECORDE DA FÁBRICA' },
  'over.again': { en: 'Stoke it again', pt: 'Acender de novo' },
  'over.menu': { en: 'Foundry floor', pt: 'Voltar à fundição' },
  'touch.rotate': { en: 'ROTATE', pt: 'GIRAR' },
  'touch.drop': { en: 'DROP', pt: 'CAIR' },
  'touch.hold': { en: 'HOLD', pt: 'GUARDAR' },
  'sound.on': { en: 'Rock on', pt: 'Rock ligado' },
  'sound.off': { en: 'Sound off', pt: 'Som desligado' },
};

export const i18n = createI18n({ game: 'tetris-a-vapor', dict });
export const t = (key, values) => i18n.t(key, values);
