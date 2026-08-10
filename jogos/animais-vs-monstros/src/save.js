// O save do jogo. A mecânica (localStorage, arquivo, normalização, versão) vem
// do slopkit; aqui fica só o que é deste jogo: o formato e as regras de
// saneamento de cada campo.

import { criarSave } from 'slopkit/save';
import { BARALHO_INICIAL, NIVEL_MAX } from './dados/animais.js';

/** Um save novo em folha. É também o gabarito do que precisa existir. */
export function saveNovo() {
  return {
    versao: 3,
    moedas: 0,
    baralho: [...BARALHO_INICIAL],
    // nível de treino de cada carta; ausente = nível 1
    niveis: {},
    faseAtual: 1,
    vencidas: [],
    humanos: 0,
    viuAbertura: false,
    recordes: {},
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
  };
}

/**
 * Conserta o que vier: save de versão antiga, arquivo editado à mão, campo com
 * o tipo errado. Na pior hipótese perde-se um campo, nunca a partida.
 */
function normalizar(bruto, base) {
  if (!bruto || typeof bruto !== 'object') return base;
  const s = { ...base, ...bruto };
  s.moedas = Number.isFinite(s.moedas) ? Math.max(0, Math.floor(s.moedas)) : 0;
  s.baralho = Array.isArray(s.baralho) && s.baralho.length ? [...new Set(s.baralho)] : [...BARALHO_INICIAL];
  s.vencidas = Array.isArray(s.vencidas) ? s.vencidas.filter((n) => Number.isFinite(n)) : [];
  s.faseAtual = Number.isFinite(s.faseAtual) ? Math.min(Math.max(1, s.faseAtual), 10) : 1;
  s.humanos = Number.isFinite(s.humanos) ? Math.max(0, s.humanos) : 0;
  s.recordes = s.recordes && typeof s.recordes === 'object' ? s.recordes : {};
  s.viuAbertura = !!s.viuAbertura;

  // níveis: save da v2 não tinha o campo, e nada impede um arquivo editado de
  // trazer nível 99 numa carta que o jogador nem tem
  const niveis = {};
  if (s.niveis && typeof s.niveis === 'object') {
    for (const [id, n] of Object.entries(s.niveis)) {
      if (!s.baralho.includes(id)) continue;
      if (!Number.isFinite(n)) continue;
      niveis[id] = Math.min(Math.max(1, Math.floor(n)), NIVEL_MAX);
    }
  }
  s.niveis = niveis;
  return s;
}

const cofre = criarSave({
  jogo: 'animais-vs-monstros',
  versao: 3,
  inicial: saveNovo,
  normalizar,
  chave: 'animais-vs-monstros:save',
});

export const carregar = () => cofre.carregar();
export const salvar = (estado) => cofre.salvar(estado);
export const apagar = () => cofre.apagar();

export function baixar(estado) {
  return cofre.exportar(estado, {
    nome: `animais-vs-monstros-fase${estado.faseAtual}-${new Date().toISOString().slice(0, 10)}.json`,
  });
}

export function importar() {
  return cofre.importar(document.getElementById('arquivo'));
}
