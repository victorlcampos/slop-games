// Testes do slopkit. As contas que importam — quantos passos o laço dá, que
// largura a tela escolhe, o que a normalização faz com um save velho — são
// funções puras de propósito, justamente para caberem num teste sem navegador.

import { cenario, conferir, conferirIgual, rodar } from '../testes.mjs';
import { medir } from '../src/tela.js';
import { passosPara } from '../src/laco.js';

// ------------------------------------------------------------------- tela

cenario('tela: largura acompanha a proporção da janela', () => {
  conferirIgual(medir(1920, 1080, 1, false).L, 1280, '16:9 devia dar 1280');
  conferir(medir(2560, 1080, 1, false).L > 1280, 'ultrawide devia enxergar mais mundo');
  conferir(medir(1024, 768, 1, false).L < 1280, '4:3 devia enxergar menos');
  conferirIgual(medir(1920, 1080, 1, false).A, 720, 'a altura lógica é fixa');
});

cenario('tela: largura tem piso e teto', () => {
  conferirIgual(medir(4000, 800, 1, false).L, 1900, 'ultra-ultrawide precisa parar de crescer');
  conferirIgual(medir(600, 900, 1, false).L, 1040, 'tela estreita precisa de um piso');
});

cenario('tela: DPR de celular é limitado mais que o de desktop', () => {
  conferirIgual(medir(844, 390, 3, true).dpr, 1.6, 'celular pequeno com DPR 3 devia cair para 1.6');
  conferirIgual(medir(1440, 900, 2, false).dpr, 2, 'desktop retina fica em 2');
  conferirIgual(medir(1180, 820, 3, true).dpr, 2, 'tablet grande não é celular pequeno');
  conferirIgual(medir(1440, 900, 1, false).dpr, 1, 'sem retina, sem inventar');
});

cenario('tela: escala converte tela em coordenada lógica', () => {
  const m = medir(1920, 1080, 1, false);
  conferirIgual(m.escala, 1.5, '1080 de altura para 720 lógicos = 1.5');
});

// ------------------------------------------------------------------- laço

cenario('laço: passo fixo dá o número certo de passos', () => {
  conferirIgual(passosPara(0, 1 / 60, 1 / 60).passos, 1, 'um quadro de 60Hz = um passo');
  conferirIgual(passosPara(0, 1 / 30, 1 / 60).passos, 2, 'quadro lento = dois passos');
  conferirIgual(passosPara(0, 1 / 144, 1 / 60).passos, 0, 'quadro rápido demais ainda não fecha um passo');
});

cenario('laço: sobra vira passo no quadro seguinte, sem perder tempo', () => {
  const passo = 1 / 60;
  let resto = 0;
  let total = 0;
  // dez quadros de 144Hz devem somar o mesmo tempo simulado que o real
  for (let i = 0; i < 20; i++) {
    const r = passosPara(resto, 1 / 144, passo);
    total += r.passos;
    resto = r.resto;
  }
  const simulado = total * passo + resto;
  const real = 20 / 144;
  conferir(Math.abs(simulado - real) < 1e-9, `tempo simulado (${simulado}) devia bater com o real (${real})`);
});

cenario('laço: guarda impede a espiral da morte', () => {
  // a aba voltou do segundo plano com 30 segundos de atraso
  const r = passosPara(0, 30, 1 / 60, 8);
  conferir(r.passos <= 8, 'nunca mais que o teto de passos');
  conferirIgual(r.resto, 0, 'o atraso é descartado, não vira dívida impagável');
});

cenario('laço: dt maluco não quebra a conta', () => {
  conferirIgual(passosPara(0, -5, 1 / 60).passos, 0, 'dt negativo (relógio voltou) não simula nada');
  conferir(passosPara(0, Infinity, 1 / 60).passos <= 8, 'dt infinito não trava');
});

// ------------------------------------------------------------------- save

/** Reimplementa o miolo de criarSave que não depende de localStorage. */
function sanearCom(normalizar, inicial, bruto, versao = 2) {
  const base = inicial();
  const s = normalizar(bruto, base) || base;
  s.versao = versao;
  return s;
}

const inicialExemplo = () => ({ versao: 2, moedas: 0, itens: [], nivel: 1 });
const normalizarExemplo = (bruto, base) => {
  if (!bruto || typeof bruto !== 'object') return base;
  const s = { ...base, ...bruto };
  s.moedas = Number.isFinite(s.moedas) ? Math.max(0, Math.floor(s.moedas)) : 0;
  s.itens = Array.isArray(s.itens) ? s.itens : [];
  s.nivel = Number.isFinite(s.nivel) ? Math.min(Math.max(1, s.nivel), 10) : 1;
  return s;
};

cenario('save: versão antiga ganha os campos novos em vez de quebrar', () => {
  const velho = { moedas: 50 }; // salvo antes de existirem itens e nível
  const s = sanearCom(normalizarExemplo, inicialExemplo, velho);
  conferirIgual(s.moedas, 50, 'o que existia é preservado');
  conferirIgual(s.itens, [], 'o que faltava ganha o padrão');
  conferirIgual(s.nivel, 1, 'idem');
  conferirIgual(s.versao, 2, 'e o save é recarimbado com a versão de hoje');
});

cenario('save: lixo no arquivo não vira estado inválido', () => {
  conferirIgual(sanearCom(normalizarExemplo, inicialExemplo, null).moedas, 0, 'null');
  conferirIgual(sanearCom(normalizarExemplo, inicialExemplo, 'oi').moedas, 0, 'string');
  conferirIgual(sanearCom(normalizarExemplo, inicialExemplo, { moedas: 'muito' }).moedas, 0, 'tipo errado');
  conferirIgual(sanearCom(normalizarExemplo, inicialExemplo, { moedas: -9 }).moedas, 0, 'negativo');
  conferirIgual(sanearCom(normalizarExemplo, inicialExemplo, { nivel: 999 }).nivel, 10, 'fora da faixa');
  conferirIgual(sanearCom(normalizarExemplo, inicialExemplo, { itens: 'não é lista' }).itens, [], 'lista falsa');
});

cenario('save: o retrato exportado é o mesmo do autosave', () => {
  const estado = normalizarExemplo({ moedas: 120, itens: ['a'], nivel: 3 }, inicialExemplo());
  const exportado = JSON.parse(JSON.stringify({ ...estado, jogo: 'exemplo', versao: 2 }));
  const reimportado = sanearCom(normalizarExemplo, inicialExemplo, exportado);
  conferirIgual(reimportado.moedas, estado.moedas, 'ida e volta preserva moedas');
  conferirIgual(reimportado.itens, estado.itens, 'ida e volta preserva itens');
  conferirIgual(reimportado.nivel, estado.nivel, 'ida e volta preserva nível');
});

await rodar('slopkit');
