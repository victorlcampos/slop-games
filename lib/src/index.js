// slopkit — o que todo jogo daqui precisa antes de virar jogo.
//
// Cada peça saiu do jogo que já fazia melhor:
//   tela  → largura elástica do Animais vs Monstros + teto de DPR do Zoo
//   laco  → passo fixo com acumulador e guarda, do Zoo Magnata
//   save  → formato único do Zoo + normalização defensiva do Animais
//   som   → mudo persistido, que 3 dos 4 já faziam
//
// Nada aqui desenha nada: o traço é de cada jogo.

export { criarTela, ehToque, medir } from './tela.js';
export { criarLaco, passosPara } from './laco.js';
export { criarSave, baixarTexto, lerArquivoTexto } from './save.js';
export { criarSom } from './som.js';
