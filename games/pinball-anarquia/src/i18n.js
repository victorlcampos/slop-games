// Every phrase the machine speaks, side by side — a hole in one language is
// visible on the line you are typing, and the test runs missingKeys() on it.

import { createI18n } from 'slopkit/i18n';

export const DICT = {
  'page.title': { en: 'Anarchy Pinball', pt: 'Pinball Anarquia' },
  'panel.title': { en: 'ANARCHY', pt: 'ANARQUIA' },
  'panel.sub': { en: 'pinball liberation front', pt: 'frente de libertação do pinball' },
  'panel.score': { en: 'score', pt: 'pontos' },
  'panel.ball': { en: 'ball', pt: 'bola' },
  'panel.mult': { en: 'multiplier', pt: 'multiplicador' },
  'panel.rank': { en: 'rank', pt: 'patente' },
  'panel.mission': { en: 'mission', pt: 'missão' },
  'panel.best': { en: 'best', pt: 'recorde' },
  'panel.tilt': { en: 'TILT', pt: 'TILT' },
  'panel.freeplay': { en: 'free play — no coins, ever', pt: 'jogo livre — sem fichas, nunca' },
  'panel.gameOver': { en: 'game over', pt: 'fim de jogo' },
  'panel.pull': { en: 'hold and release to launch', pt: 'segure e solte para lançar' },
  'panel.save': { en: 'ball saver on', pt: 'bola protegida' },

  // ranks: a ladder you climb by tearing it down — the top is nobody at all
  'rank.citizen': { en: 'citizen', pt: 'cidadão' },
  'rank.sympathizer': { en: 'sympathizer', pt: 'simpatizante' },
  'rank.punk': { en: 'punk', pt: 'punk' },
  'rank.agitator': { en: 'agitator', pt: 'agitador' },
  'rank.saboteur': { en: 'saboteur', pt: 'sabotador' },
  'rank.insurgent': { en: 'insurgent', pt: 'insurgente' },
  'rank.free': { en: 'nobody (free)', pt: 'ninguém (livre)' },

  'mission.barricades': { en: 'Raise the barricades', pt: 'Levante as barricadas' },
  'mission.barricades.how': { en: 'hit the riot bumpers {n} times', pt: 'acerte os bumpers do motim {n} vezes' },
  'mission.pillars': { en: 'Bring down the pillars', pt: 'Derrube os pilares' },
  'mission.pillars.how': { en: 'clear the target bank {n} times', pt: 'limpe o banco de alvos {n} vezes' },
  'mission.underground': { en: 'Occupy the underground', pt: 'Ocupe o subterrâneo' },
  'mission.underground.how': { en: 'drop into the wormhole {n} times', pt: 'caia no buraco {n} vezes' },
  'mission.freepress': { en: 'Run the free press', pt: 'Rode a imprensa livre' },
  'mission.freepress.how': { en: 'light all Ⓐ lanes {n} times', pt: 'acenda todas as vias Ⓐ {n} vezes' },
  'mission.presses': { en: 'Run the presses', pt: 'Rode as prensas' },
  'mission.presses.how': { en: 'send the spinner round {n} times', pt: 'gire o spinner {n} vezes' },
  'mission.blockade': { en: 'Break the blockade', pt: 'Rompa o bloqueio' },
  'mission.blockade.how': { en: 'take the full orbit {n} times', pt: 'faça a volta completa {n} vezes' },
  'mission.slings': { en: 'March on the slings', pt: 'Marche sobre os slings' },
  'mission.slings.how': { en: 'trip the slingshots {n} times', pt: 'dispare os slingshots {n} vezes' },

  'msg.launch': { en: 'PULL THE PLUNGER', pt: 'PUXE O LANÇADOR' },
  'msg.skillShot': { en: 'SKILL SHOT +2000', pt: 'TIRO CERTEIRO +2000' },
  'msg.ballSaved': { en: 'BALL SAVED', pt: 'BOLA SALVA' },
  'msg.tilt': { en: 'TILT — HANDS OFF THE MACHINE', pt: 'TILT — TIRE AS MÃOS DA MÁQUINA' },
  'msg.mult': { en: 'MULTIPLIER x{n}', pt: 'MULTIPLICADOR x{n}' },
  'msg.mission': { en: 'MISSION COMPLETE +25000', pt: 'MISSÃO CUMPRIDA +25000' },
  'msg.extraBall': { en: 'EXTRA BALL — SOLIDARITY', pt: 'BOLA EXTRA — SOLIDARIEDADE' },
  'msg.hole': { en: 'INTO THE UNDERGROUND', pt: 'PARA O SUBTERRÂNEO' },
  'msg.kickback': { en: 'MUTUAL AID KICKBACK', pt: 'APOIO MÚTUO — RESGATE' },
  'msg.kickbackLit': { en: 'KICKBACK LIT', pt: 'RESGATE ARMADO' },
  'msg.orbit': { en: 'ORBIT — ALL THE WAY ROUND', pt: 'ÓRBITA — VOLTA COMPLETA' },
};

export const i18n = createI18n({ dict: DICT });
export const t = (id, values) => i18n.t(id, values);
