// O laço de quadro.
//
// A simulação anda em **passo fixo** e o desenho anda livre. Isso não é
// preciosismo: com dt variável, o mesmo jogo se comporta diferente a 60 e a
// 144 Hz — colisão que passa batido, pulo que sai mais alto, física que
// explode quando a aba volta do segundo plano. O passo fixo elimina isso.
//
// De onde veio: o Zoo Magnata, único dos quatro que já fazia assim (acumulador
// com passo de 1/30 e guarda contra a espiral da morte). Os outros três usavam
// dt cru clampado — o que funciona até o dia em que não funciona.
//
//   const laco = criarLaco({
//     passo: 1/60,
//     simular: (h) => mundo.tick(h),   // h é SEMPRE o mesmo valor
//     desenhar: (alfa, dt) => pintar(alfa),
//   });
//   laco.iniciar();

export function criarLaco(opcoes) {
  const {
    passo = 1 / 60,
    simular,
    desenhar,
    // teto de tempo por quadro: se a aba ficou 30s em segundo plano, não
    // adianta tentar simular 30s de uma vez — pula-se o buraco
    tetoDt = 0.25,
    // quantos passos no máximo por quadro. Sem isto, uma máquina lenta entra
    // em espiral: simula mais, atrasa mais, simula mais ainda, trava.
    maxPassos = 8,
    velocidade = 1,
    agora = () => performance.now(),
  } = opcoes;

  let rodando = false;
  let anterior = 0;
  let acumulado = 0;
  let raf = null;
  const estado = { velocidade, pausado: false, fps: 0, passosNoQuadro: 0 };

  let quadrosFps = 0;
  let tempoFps = 0;

  function quadro(t) {
    if (!rodando) return;
    raf = requestAnimationFrame(quadro);

    let dt = (t - anterior) / 1000;
    anterior = t;
    if (!(dt > 0)) dt = 0;
    if (dt > tetoDt) dt = tetoDt;

    quadrosFps++;
    tempoFps += dt;
    if (tempoFps >= 0.5) {
      estado.fps = Math.round(quadrosFps / tempoFps);
      quadrosFps = 0;
      tempoFps = 0;
    }

    if (!estado.pausado && simular) {
      acumulado += dt * estado.velocidade;
      let n = 0;
      while (acumulado >= passo && n < maxPassos) {
        simular(passo);
        acumulado -= passo;
        n++;
      }
      estado.passosNoQuadro = n;
      // não deu conta: descarta o atraso em vez de acumular dívida impagável
      if (n >= maxPassos) acumulado = 0;
    }

    // sobra do acumulador, para quem quiser interpolar o desenho
    if (desenhar) desenhar(acumulado / passo, dt, estado);
  }

  return {
    estado,
    iniciar() {
      if (rodando) return;
      rodando = true;
      anterior = agora();
      acumulado = 0;
      raf = requestAnimationFrame(quadro);
    },
    parar() {
      rodando = false;
      if (raf) cancelAnimationFrame(raf);
      raf = null;
    },
    pausar(v = true) {
      estado.pausado = v;
    },
    /** 0 congela, 1 normal, 2 acelera — o Zoo usa isso para o botão de velocidade. */
    definirVelocidade(v) {
      estado.velocidade = Math.max(0, v);
    },
    get rodando() {
      return rodando;
    },
  };
}

/**
 * A conta do laço, sem navegador — é isto que o teste exercita.
 * Devolve quantos passos seriam dados e o que sobra no acumulador.
 */
export function passosPara(acumulado, dt, passo, maxPassos = 8, tetoDt = 0.25) {
  const usado = Math.min(Math.max(dt, 0), tetoDt);
  let acc = acumulado + usado;
  let n = 0;
  while (acc >= passo && n < maxPassos) {
    acc -= passo;
    n++;
  }
  if (n >= maxPassos) acc = 0;
  return { passos: n, resto: acc };
}
