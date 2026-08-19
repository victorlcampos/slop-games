// Every phrase this cabinet says, in both languages, side by side.
//
// Keyed by phrase rather than by language, which is the house rule and the
// reason for it is visible here more than anywhere else in the repo: ten games
// with their own rules, their own end conditions and their own words for what
// just happened is a hundred and fifty phrases, and in a `{ pt: {...},
// en: {...} }` shape exactly one of them would be missing and nobody would find
// out until a player flipped the flag.
//
// `test/rules.test.mjs` runs `missingKeys` over this file.

import { createI18n } from 'slopkit/i18n';

export const DICT = {
  'page.title': { en: 'Ten Classics', pt: 'Dez Clássicos' },
  'app.name': { en: 'Ten Classics', pt: 'Dez Clássicos' },
  'app.tagline': {
    en: 'Ten boards, one opponent, four heads.',
    pt: 'Dez tabuleiros, um adversário, quatro cabeças.',
  },
  'app.blurb': {
    en: 'Every game is played against a machine that really thinks — and the level changes how well it thinks, never how the dice fall.',
    pt: 'Todo jogo é contra uma máquina que pensa de verdade — e o nível muda o quanto ela pensa, nunca o que sai nos dados.',
  },

  // ------------------------------------------------------------ the ten games
  'game.chess': { en: 'Chess', pt: 'Xadrez' },
  'game.chess.about': {
    en: 'Castling, en passant, promotion and the fifty-move rule. The machine searches, and at the top level it searches deep.',
    pt: 'Roque, en passant, promoção e a regra dos cinquenta lances. A máquina calcula, e no nível mais alto calcula fundo.',
  },
  'game.chess.how': {
    en: 'Tap a piece, then the square. A pawn reaching the last rank asks what it becomes.',
    pt: 'Toque na peça e depois na casa. O peão que chega à última fileira pergunta no que vira.',
  },

  'game.checkers': { en: 'Draughts', pt: 'Damas' },
  'game.checkers.about': {
    en: 'Brazilian rules: men capture backwards, kings fly, and you must take the line that captures the most.',
    pt: 'Regra brasileira: a pedra come para trás, a dama voa, e é obrigatório comer pelo lance que come mais.',
  },
  'game.checkers.how': {
    en: 'Tap a piece, then where it lands. A whole capture chain is chosen by its last square.',
    pt: 'Toque na pedra e depois onde ela para. Uma sequência inteira de capturas se escolhe pela casa final.',
  },

  'game.reversi': { en: 'Reversi', pt: 'Reversi' },
  'game.reversi.about': {
    en: 'Every move flips a line. The disc count means nothing until the board is full — what matters is who still has moves.',
    pt: 'Cada lance vira uma linha. A contagem de peças não diz nada até o tabuleiro encher — o que vale é quem ainda tem lances.',
  },
  'game.reversi.how': {
    en: 'Tap a marked square. The number on it is how many discs it turns.',
    pt: 'Toque numa casa marcada. O número nela é quantas peças ela vira.',
  },

  'game.connect4': { en: 'Four in a Row', pt: 'Lig 4' },
  'game.connect4.about': {
    en: 'Drop a disc, make four. Simple enough that the professional reads eleven moves ahead and never misses a threat.',
    pt: 'Solte a ficha, faça quatro. Simples o bastante para o profissional ler onze lances à frente e não perder uma ameaça.',
  },
  'game.connect4.how': { en: 'Tap a column.', pt: 'Toque numa coluna.' },

  'game.backgammon': { en: 'Backgammon', pt: 'Gamão' },
  'game.backgammon.about': {
    en: 'Dice, blots and the bar. The dice are the same at every level — only the choice of what to do with them changes.',
    pt: 'Dados, peças descobertas e a barra. Os dados são os mesmos em todo nível — o que muda é a escolha do que fazer com eles.',
  },
  'game.backgammon.how': {
    en: 'Tap a checker, then a point. One die per move; the turn ends when both are spent.',
    pt: 'Toque numa pedra e depois num ponto. Um dado por lance; o turno acaba quando os dois são usados.',
  },

  'game.ludo': { en: 'Ludo', pt: 'Ludo' },
  'game.ludo.about': {
    en: 'You against three. A six to leave the yard, a six plays again, and landing on somebody sends them home.',
    pt: 'Você contra três. Seis para sair, seis joga de novo, e cair em cima de alguém manda o peão para casa.',
  },
  'game.ludo.how': { en: 'Throw, then tap the pawn to move.', pt: 'Jogue o dado e toque no peão que vai andar.' },

  'game.morris': { en: "Nine Men's Morris", pt: 'Trilha' },
  'game.morris.about': {
    en: 'Place nine, then move them. Three in a line takes an enemy piece — and a piece inside a mill is safe while any other is not.',
    pt: 'Coloque nove, depois mova. Três em linha tira uma peça do adversário — e peça em moinho está a salvo enquanto houver outra fora.',
  },
  'game.morris.how': {
    en: 'Tap a point to place or move. Closing a mill asks which piece you take.',
    pt: 'Toque num ponto para colocar ou mover. Fechar um moinho pergunta que peça você tira.',
  },

  'game.mancala': { en: 'Mancala', pt: 'Mancala' },
  'game.mancala.about': {
    en: 'Sow six pits anticlockwise. A seed landing in your store plays again; one landing in an empty pit takes everything facing it.',
    pt: 'Semeie seis covas no sentido anti-horário. Semente que cai no seu celeiro joga de novo; semente que cai em cova vazia leva tudo o que está à frente.',
  },
  'game.mancala.how': { en: 'Tap one of your pits.', pt: 'Toque numa das suas covas.' },

  'game.tictactoe': { en: 'Noughts and Crosses', pt: 'Jogo da Velha' },
  'game.tictactoe.about': {
    en: 'A solved game: the professional cannot be beaten, only drawn with. The easy one can be beaten in four moves.',
    pt: 'Um jogo resolvido: o profissional não perde, no máximo empata. O fácil dá para ganhar em quatro lances.',
  },
  'game.tictactoe.how': { en: 'Tap a square.', pt: 'Toque num quadrado.' },

  'game.sudoku': { en: 'Sudoku', pt: 'Sudoku' },
  'game.sudoku.about': {
    en: 'One solution, and always reachable by logic — never by guessing. The level is which technique the grid demands of you.',
    pt: 'Uma solução, sempre alcançável por lógica — nunca por chute. O nível é a técnica que a grade exige de você.',
  },
  'game.sudoku.how': {
    en: 'Tap a square, then a digit. ✎ writes pencil marks; the hint says which square gives in next, and why.',
    pt: 'Toque numa casa e depois num número. ✎ escreve a lápis; a dica diz qual casa sai agora, e por quê.',
  },

  // --------------------------------------------------------------- difficulty
  'level.easy': { en: 'Easy', pt: 'Fácil' },
  'level.normal': { en: 'Medium', pt: 'Médio' },
  'level.hard': { en: 'Hard', pt: 'Difícil' },
  'level.pro': { en: 'Professional', pt: 'Profissional' },

  'level.easy.what': {
    en: 'Looks one move ahead, and often plays something worse on purpose.',
    pt: 'Enxerga um lance à frente, e muitas vezes joga pior de propósito.',
  },
  'level.normal.what': {
    en: 'Three moves ahead. Punishes the obvious mistake, misses the deep one.',
    pt: 'Três lances à frente. Castiga o erro óbvio, deixa passar o mais fundo.',
  },
  'level.hard.what': {
    en: 'Five moves ahead, and it plays the move it found.',
    pt: 'Cinco lances à frente, e joga o lance que encontrou.',
  },
  'level.pro.what': {
    en: 'As deep as its time allows, with no mercy at all.',
    pt: 'Tão fundo quanto o tempo deixa, sem nenhuma piedade.',
  },
  'level.sudoku.easy': { en: 'Single candidates only.', pt: 'Só candidato único.' },
  'level.sudoku.normal': { en: 'Needs hidden singles.', pt: 'Exige o único escondido.' },
  'level.sudoku.hard': { en: 'Needs naked pairs.', pt: 'Exige pares nus.' },
  'level.sudoku.pro': { en: 'Needs pointing pairs and box-line.', pt: 'Exige par apontado e bloco-linha.' },
  'level.ludo.what': {
    en: 'Only the top two levels count the ways a piece can be hit next turn.',
    pt: 'Só os dois níveis de cima contam de quantos jeitos a peça pode ser capturada na volta.',
  },

  'difficulty.title': { en: 'How well should it play?', pt: 'Quão bem ela deve jogar?' },
  'difficulty.promise': {
    en: 'The level changes the machine, not your luck: the dice, the shuffle and the deal are the same at all four.',
    pt: 'O nível muda a máquina, não a sua sorte: os dados, o embaralhamento e a distribuição são os mesmos nos quatro.',
  },
  'difficulty.side': { en: 'You play', pt: 'Você joga' },
  'side.first': { en: 'first', pt: 'primeiro' },
  'side.second': { en: 'second', pt: 'segundo' },
  'side.white': { en: 'white', pt: 'as brancas' },
  'side.black': { en: 'black', pt: 'as pretas' },
  'side.light': { en: 'light', pt: 'as claras' },
  'side.dark': { en: 'dark', pt: 'as escuras' },
  'side.red': { en: 'red', pt: 'o vermelho' },
  'side.random': { en: 'either', pt: 'tanto faz' },

  // ---------------------------------------------------------------- the match
  'match.you': { en: 'You', pt: 'Você' },
  'match.machine': { en: 'Machine', pt: 'Máquina' },
  'match.yourTurn': { en: 'Your move', pt: 'Sua vez' },
  'match.thinking': { en: 'Thinking…', pt: 'Pensando…' },
  'match.rolling': { en: 'Rolling…', pt: 'Rolando…' },
  'match.rolled': { en: 'Threw {dice}', pt: 'Tirou {dice}' },
  'match.tapToRoll': { en: 'Tap to throw', pt: 'Toque para jogar o dado' },
  'match.noMoves': { en: 'No legal move — the turn passes', pt: 'Sem lance possível — a vez passa' },
  'match.mustCapture': { en: 'You have to capture', pt: 'Você é obrigado a comer' },
  'match.check': { en: 'Check', pt: 'Xeque' },
  'match.mill': { en: 'Mill! Take a piece', pt: 'Moinho! Tire uma peça' },
  'match.again': { en: 'Another throw', pt: 'Joga de novo' },
  'match.won': { en: 'You won', pt: 'Você ganhou' },
  'match.lost': { en: 'You lost', pt: 'Você perdeu' },
  'match.drew': { en: 'Draw', pt: 'Empate' },
  'match.solved': { en: 'Solved!', pt: 'Resolvido!' },
  'match.place': { en: '{n}º place', pt: '{n}º lugar' },

  'end.checkmate': { en: 'Checkmate', pt: 'Xeque-mate' },
  'end.stalemate': { en: 'Stalemate — nowhere to go, and not in check', pt: 'Afogamento — sem lance e sem estar em xeque' },
  'end.fifty': { en: 'Fifty moves with no pawn and no capture', pt: 'Cinquenta lances sem peão e sem captura' },
  'end.material': { en: 'Not enough material to mate', pt: 'Material insuficiente para dar mate' },
  'end.idle': { en: 'Twenty moves with nothing taken', pt: 'Vinte lances sem nada ser comido' },
  'end.blocked': { en: 'No moves left', pt: 'Sem lances' },
  'end.ground': { en: 'Down to two pieces', pt: 'Restaram duas peças' },
  'end.four': { en: 'Four in a row', pt: 'Quatro em linha' },
  'end.line': { en: 'Three in a row', pt: 'Três em linha' },
  'end.full': { en: 'Board full', pt: 'Tabuleiro cheio' },
  'end.discs': { en: '{a} discs to {b}', pt: '{a} peças a {b}' },
  'end.equal': { en: 'Same number of discs', pt: 'Mesmo número de peças' },
  'end.seeds': { en: '{a} seeds to {b}', pt: '{a} sementes a {b}' },
  'end.single': { en: 'A single game', pt: 'Partida simples' },
  'end.gammon': { en: 'Gammon — double', pt: 'Gamão — vale o dobro' },
  'end.backgammon': { en: 'Backgammon — triple', pt: 'Gamão duplo — vale o triplo' },
  'end.home': { en: 'All four home', pt: 'Os quatro em casa' },
  'end.solved': { en: 'Every square, and not one wrong', pt: 'Casa por casa, sem errar uma' },

  // ------------------------------------------------------------------ buttons
  'ui.play': { en: 'Play', pt: 'Jogar' },
  'ui.back': { en: 'Back', pt: 'Voltar' },
  'ui.lobby': { en: 'All games', pt: 'Todos os jogos' },
  'ui.undo': { en: 'Undo', pt: 'Desfazer' },
  'ui.restart': { en: 'New game', pt: 'Novo jogo' },
  'ui.rematch': { en: 'Play again', pt: 'Jogar de novo' },
  'ui.hint': { en: 'Hint', pt: 'Dica' },
  'ui.flip': { en: 'Turn the board', pt: 'Virar o tabuleiro' },
  'ui.sound': { en: 'Sound', pt: 'Som' },
  'ui.rules': { en: 'How to play', pt: 'Como se joga' },
  'ui.close': { en: 'Close', pt: 'Fechar' },
  'ui.resume': { en: 'Resume', pt: 'Continuar' },
  'ui.roll': { en: 'Throw', pt: 'Jogar o dado' },
  'ui.promoteTo': { en: 'Promote to', pt: 'Promover para' },
  'ui.building': { en: 'Laying the board out…', pt: 'Montando o tabuleiro…' },
  'ui.record': { en: '{won}W · {lost}L · {drew}D', pt: '{won}V · {lost}D · {drew}E' },
  'ui.neverPlayed': { en: 'not played yet', pt: 'ainda não jogado' },
  'ui.bestTime': { en: 'best {time}', pt: 'melhor {time}' },
  'ui.mistakes': { en: '{n} wrong', pt: '{n} erro(s)' },
  'ui.difficulty': { en: 'Difficulty', pt: 'Dificuldade' },

  // sudoku's own words
  'sudoku.technique.single': {
    en: 'Only one digit fits this square.',
    pt: 'Só um número cabe nesta casa.',
  },
  'sudoku.technique.hidden': {
    en: 'This is the only square in its row, column or box where that digit fits.',
    pt: 'Esta é a única casa da linha, coluna ou bloco onde esse número cabe.',
  },
  'sudoku.technique.pair': {
    en: 'Two squares share the same two candidates, which frees this one.',
    pt: 'Duas casas dividem os mesmos dois candidatos, o que libera esta.',
  },
  'sudoku.technique.pointing': {
    en: 'That digit is stuck on one line inside a box, so it leaves the rest of the line.',
    pt: 'O número está preso numa linha dentro do bloco, então sai do resto da linha.',
  },
  'sudoku.technique.xwing': {
    en: 'Two rows pin the digit to the same two columns.',
    pt: 'Duas linhas prendem o número nas mesmas duas colunas.',
  },
  'sudoku.technique.guess': {
    en: 'Nothing follows by logic from here — this one is from the answer.',
    pt: 'Daqui não sai nada por lógica — esta veio da resposta.',
  },
  'sudoku.needs': { en: 'This grid needs: {technique}', pt: 'Esta grade exige: {technique}' },
  'sudoku.clues': { en: '{n} clues', pt: '{n} pistas' },
  'sudoku.pencil': { en: 'pencil', pt: 'lápis' },
};

export const i18n = createI18n({ dict: DICT });
export const t = (id, values) => i18n.t(id, values);
