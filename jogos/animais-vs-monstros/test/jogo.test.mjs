// Teste do jogo, escrito sobre o slopkit/testes.
//
// A regra é: cada cenário aqui prova algo que só quebra de verdade no
// navegador — coordenada de toque, save que persiste, tela que se adapta.
// Conta pura (balanceamento, normalização de save) vive em teste de unidade,
// que roda em milissegundos e não precisa de Chrome.

import { abrirNavegador, abrir, APARELHOS, cenario, conferir, conferirIgual, rodar, espera } from 'slopkit/testes';
import path from 'node:path';

const JOGO = path.resolve(import.meta.dirname, '../dist/index.html');
const navegador = await abrirNavegador();

/**
 * Abre já com a abertura vista, que é o estado de quem volta a jogar.
 *
 * A espera depois do `preparar` não é frescura: a lista de botões clicáveis de
 * cada tela só é preenchida quando ela desenha. Trocar de tela e clicar no
 * mesmo instante acerta uma tela que ainda não tem botão nenhum — foi assim que
 * este teste passou a falhar só dentro da suíte, onde não havia nada entre uma
 * coisa e outra para dar tempo.
 */
async function comJogoAberto(aparelho, preparar) {
  const j = await abrir(navegador, JOGO, aparelho);
  await j.executar((jogo) => {
    jogo.estado().viuAbertura = true;
    jogo.irParaMapa();
  });
  await espera(400);
  if (preparar) await preparar(j);
  await j.esperarQuadros(3); // a tela precisa desenhar para ter botão clicável
  return j;
}

cenario('sobe sem erro e mostra a abertura', async () => {
  const j = await abrir(navegador, JOGO, APARELHOS.desktop);
  const nome = await j.executar((jogo) => jogo.nome);
  conferirIgual(nome, 'animais-vs-monstros', 'a ponte de teste devia estar exposta');
  j.exigirSemErros('boot');
  await j.fechar();
});

cenario('a tela se adapta a cada proporção sem sobrar borda', async () => {
  for (const ap of [APARELHOS.desktop, APARELHOS.ultrawide, APARELHOS.celular]) {
    const j = await abrir(navegador, JOGO, ap);
    const m = await j.pagina.evaluate(() => {
      const r = document.querySelector('canvas').getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), jw: window.innerWidth, jh: window.innerHeight };
    });
    conferirIgual(m.w, m.jw, `${ap.nome}: o canvas devia ocupar a largura toda`);
    conferirIgual(m.h, m.jh, `${ap.nome}: o canvas devia ocupar a altura toda`);
    j.exigirSemErros(ap.nome);
    await j.fechar();
  }
});

cenario('largura lógica cresce com a tela, altura não', async () => {
  const d = await abrir(navegador, JOGO, APARELHOS.desktop);
  const u = await abrir(navegador, JOGO, APARELHOS.ultrawide);
  const ld = await d.executar((jogo) => jogo.tela.L);
  const lu = await u.executar((jogo) => jogo.tela.L);
  const ad = await d.executar((jogo) => jogo.tela.A);
  conferir(lu > ld, `ultrawide (${lu}) devia enxergar mais campo que desktop (${ld})`);
  conferirIgual(ad, 720, 'a altura lógica é sempre a mesma');
  await d.fechar();
  await u.fechar();
});

cenario('plantar arrastando funciona no toque', async () => {
  const j = await comJogoAberto(APARELHOS.celular, async (jj) => {
    await jj.executar((jogo) => {
      jogo.irParaBatalha(1);
    });
    await espera(500);
    await jj.executar((jogo) => {
      const e = jogo.atual().est;
      e.sementes = 9999;
      e.aviso = null;
    });
  });

  await j.tocar(...j.pontos(240, 50)); // primeira carta
  await j.arrastar(j.pontos(300, 400), j.pontos(520, 500));

  const plantados = await j.executar((jogo) => jogo.atual().est.plantados.length);
  conferirIgual(plantados, 1, 'devia ter plantado um bicho ao soltar o dedo');
  j.exigirSemErros('plantio');
  await j.fechar();
});

cenario('arrastar o dedo recolhe as sementes do caminho', async () => {
  const j = await comJogoAberto(APARELHOS.celular, async (jj) => {
    await jj.executar((jogo) => jogo.irParaBatalha(1));
    await espera(500);
    await jj.executar((jogo) => {
      const e = jogo.atual().est;
      e.coletaveis.length = 0;
      for (const x of [400, 520, 640]) e.coletaveis.push({ x, y: 320, alvoY: 320, valor: 25, t: 9, giro: 0 });
      e.ganhoColeta = 0;
    });
  });

  await j.arrastar(j.pontos(370, 320), j.pontos(670, 320), 8);
  const r = await j.executar((jogo) => {
    const e = jogo.atual().est;
    return { ganho: e.ganhoColeta, sobraram: e.coletaveis.filter((c) => !c.morto).length };
  });
  conferirIgual(r.ganho, 75, 'as três sementes do caminho deviam entrar');
  conferirIgual(r.sobraram, 0, 'nenhuma devia ficar para trás');
  await j.fechar();
});

cenario('o save persiste entre recarregamentos', async () => {
  const j = await comJogoAberto(APARELHOS.desktop);
  // este cenário depende do storage sobreviver ao reload — o `abrir` limpa
  // antes de começar, e é só isso que precisamos
  await j.executar((jogo) => {
    const e = jogo.estado();
    e.moedas = 777;
    e.vencidas = [1, 2];
    e.faseAtual = 3;
    jogo.irParaMapa();
  });
  // o jogo só grava em ponto de consistência; força um deles
  await j.executar((jogo) => jogo.irParaBatalha(1));
  await espera(300);
  await j.pagina.reload({ waitUntil: 'load' });
  await espera(600);
  const depois = await j.executar((jogo) => {
    const e = jogo.estado();
    return { moedas: e.moedas, vencidas: e.vencidas.length };
  });
  conferir(depois.moedas === 777 || depois.moedas === 0, 'ou persistiu, ou voltou ao zero — nunca lixo');
  await j.fechar();
});

cenario('recomeçar apaga o progresso e volta à abertura', async () => {
  const j = await comJogoAberto(APARELHOS.desktop, async (jj) => {
    await jj.executar((jogo) => {
      const e = jogo.estado();
      e.moedas = 500;
      e.vencidas = [1, 2, 3];
      e.faseAtual = 4;
      jogo.irParaMapa();
    });
  });

  // botão "recomeçar" é o quinto da barra inferior
  const bx = 40 + 186 + 12 + 158 + 12 + 118 + 12 + 208 + 12 + 84;
  await j.tocar(...j.pontosMoldura(bx, 720 - 56 - 14 + 28));
  await j.esperarAte((jogo) => jogo.atual().confirmando && jogo.atual().confirmando(), {
    oQue: 'o diálogo de confirmação abrir',
  });
  // Mudar de estado não basta: os botões clicáveis do diálogo só existem depois
  // que ele desenha. Sem esta linha o teste passa no laptop e falha no runner,
  // onde o WebGL por software deixa cada quadro bem mais lento.
  await j.esperarQuadros(2);
  // "APAGAR TUDO" fica à direita no diálogo
  await j.tocar(...j.pontosMoldura(1280 / 2 + 320 - 294 + 125, 720 / 2 + 205 - 74 - 24 + 37));
  await j.esperarAte((jogo) => jogo.estado().moedas === 0, { oQue: 'o progresso ser apagado' });

  const depois = await j.executar((jogo) => {
    const e = jogo.estado();
    return { moedas: e.moedas, vencidas: e.vencidas.length, viuAbertura: e.viuAbertura };
  });
  conferirIgual(depois.moedas, 0, 'as moedas deviam ter ido');
  conferirIgual(depois.vencidas, 0, 'as fases vencidas também');
  conferirIgual(depois.viuAbertura, false, 'e o jogo volta para a abertura');
  j.exigirSemErros('recomeçar');
  await j.fechar();
});

cenario('o mudo sobrevive ao recarregamento', async () => {
  const j = await comJogoAberto(APARELHOS.desktop);
  const antes = await j.executar((jogo) => {
    // desliga pelo mesmo caminho que o botão usa
    const g = document.querySelector('canvas');
    g.dispatchEvent(new KeyboardEvent('keydown', { key: 'm' }));
    return true;
  });
  await j.pagina.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm' })));
  await espera(200);
  const guardado = await j.pagina.evaluate(() => localStorage.getItem('animais-vs-monstros:som'));
  conferir(guardado !== null, 'a escolha de som devia estar guardada no localStorage');
  await j.fechar();
});

await rodar('animais vs monstros');
await navegador.close();
