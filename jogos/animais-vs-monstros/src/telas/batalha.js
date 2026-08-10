// A batalha: o tabuleiro, as ondas e todas as regras de combate.
//
// Tabuleiro de 5 fileiras por 9 colunas. Os monstros entram pela direita e
// andam para a esquerda; se um deles cruzar a cerca, a fase acabou.

import { forma, elipse, circulo, linha, traco, caixa, texto, medirTexto, quebrarTexto, sombra, porSprite, pontosElipse, rng } from '../rabisco.js';
import { TINTA, TINTA_FRACA, CORES, PAPEL, tom, alfa } from '../paleta.js';
import { spriteAnimal } from '../desenho/animais.js';
import { spriteMonstro } from '../desenho/monstros.js';
import { fundoDaFase } from '../desenho/cenario.js';
import { cartaNoNivel } from '../dados/animais.js';
import { MONSTRO_POR_ID } from '../dados/monstros.js';
import { vp, ALTURA } from '../viewport.js';
import { som, tocarMusica, pararMusica } from '../audio.js';

/** Toque tátil curto, onde o aparelho tiver. Silencioso onde não tiver. */
function vibrar(ms) {
  if (navigator.vibrate) navigator.vibrate(ms);
}

const FILEIRAS = 5;
const COLUNAS = 9;
const CERCA_X = 128;
const CARTAS_X0 = 196;
const CARTA_MIN = 86; // não encolhe mais que isso: no celular vira alvo pequeno demais
const CARTA_MAX = 116;

// Tudo aqui é recalculado por `aplicarLayout`, porque depende de duas coisas
// que mudam: a largura da janela (o tabuleiro se estica com ela) e quantas
// cartas o jogador tem — com o baralho cheio, uma fileira só de cartas
// estouraria a tela. Como existe uma batalha por vez, guardar no módulo basta.
let HUD_H = 104;
let CAMPO_Y = HUD_H;
let CAMPO_H = ALTURA - CAMPO_Y;
let FILA_H = CAMPO_H / FILEIRAS;
let CEL_L = (1280 - CERCA_X - 10) / COLUNAS;
let CARTA_L = 96;
let CARTA_H = 88;
let CARTAS_POR_LINHA = 9;
let TOQUE = false;

function aplicarLayout(quantasCartas) {
  TOQUE = vp.toque;
  // A casa é quase quadrada e tem teto de tamanho. Deixar as 9 colunas
  // esticarem até a borda numa tela ultrawide daria casas de 195x123 — feias e,
  // pior, com o monstro levando o dobro do tempo para atravessar cada uma. Com
  // teto, a largura que sobra vira pista aberta à direita: você vê a horda
  // chegando de longe, que é vantagem de tela grande sem mexer no equilíbrio.
  CEL_L = Math.min(118, (vp.L - CERCA_X - 10) / COLUNAS);

  const faixa = vp.L - 116 - CARTAS_X0;
  // No toque a carta não desce de 104 — o dedo não tem a precisão do mouse, e
  // errar a carta no meio de uma horda custa a fase. No mouse pode encolher
  // bem mais, e é isso que segura o baralho grande numa linha só: duas linhas
  // de carta comem um quarto da altura da tela.
  // 94 lógico ≈ 51pt num celular deitado, acima dos 44pt confortáveis
  const minimo = TOQUE ? 94 : 72;
  const cabem = Math.max(1, Math.floor(faixa / (minimo + 6)));
  const linhas = Math.min(2, Math.ceil(quantasCartas / cabem));
  CARTAS_POR_LINHA = Math.ceil(quantasCartas / linhas);
  CARTA_L = Math.max(minimo, Math.min(CARTA_MAX, faixa / CARTAS_POR_LINHA - 6));
  CARTA_H = linhas > 1 ? 74 : TOQUE ? 96 : 88;
  HUD_H = 16 + linhas * (CARTA_H + 8);
  CAMPO_Y = HUD_H;
  CAMPO_H = ALTURA - CAMPO_Y;
  FILA_H = CAMPO_H / FILEIRAS;
  return linhas;
}

const centroX = (col) => CERCA_X + col * CEL_L + CEL_L / 2;
const centroY = (fila) => CAMPO_Y + fila * FILA_H + FILA_H / 2;
const colDeX = (x) => Math.floor((x - CERCA_X) / CEL_L);
const filaDeY = (y) => Math.floor((y - CAMPO_Y) / FILA_H);

/** Onde cada carta fica no HUD, dado o índice. */
function caixaDaCarta(i) {
  const linha = Math.floor(i / CARTAS_POR_LINHA);
  const col = i % CARTAS_POR_LINHA;
  return {
    x: CARTAS_X0 + col * (CARTA_L + 6),
    y: 8 + linha * (CARTA_H + 8),
    w: CARTA_L,
    h: CARTA_H,
  };
}

/**
 * Cria uma batalha. `aoTerminar(venceu, resumo)` é chamado uma única vez.
 */
export function criarBatalha(fase, baralho, aoTerminar, niveis = {}) {
  // cada carta entra em campo com os números do nível em que foi treinada
  const cartas = baralho.map((id) => cartaNoNivel(id, niveis[id] || 1)).filter(Boolean);
  const aguas = new Set(fase.agua || []);

  // precisa vir antes de tudo: o tamanho do campo sai daqui, e o cenário é
  // pintado com essas medidas
  aplicarLayout(cartas.length);

  const est = {
    fase,
    tempo: 0,
    sementes: fase.sementesIniciais,
    plantados: [],
    monstros: [],
    projeteis: [],
    coletaveis: [],
    particulas: [],
    flutuantes: [],
    recargas: Object.fromEntries(cartas.map((c) => [c.id, 0])),
    selecionada: null,
    ondaAtual: -1,
    proximaOnda: 4,
    naFila: [],
    terminou: false,
    venceu: false,
    pausado: false,
    // de onde veio cada semente — o fim de fase mostra isso ao jogador
    ganhoMortes: 0,
    ganhoColeta: 0,
    aviso: fase.novidade ? { texto: fase.novidade.aviso, t: 7 } : null,
    abalo: 0,
    mortos: 0,
    revelado: false,
    fimEm: 0,
    pa: false, // "pá": remove o animal plantado
  };

  let fundo = fundoDaFase(fase.cenario, vp.L, CAMPO_H);
  let idSeq = 1;

  /**
   * A janela mudou de tamanho. Recoloca as criaturas nas casas novas — sem
   * isso, quem já estava plantado ficaria fora da grade depois do resize.
   */
  function redimensionar() {
    aplicarLayout(cartas.length);
    fundo = fundoDaFase(fase.cenario, vp.L, CAMPO_H);
    for (const p of est.plantados) {
      p.x = centroX(p.col) + (p.avanco || 0);
      p.y = centroY(p.fila);
    }
    for (const m of est.monstros) m.y = centroY(m.fila);
    for (const c of est.coletaveis) c.alvoY = Math.min(c.alvoY, ALTURA - 20);
  }

  // ------------------------------------------------------------------ apoio

  function ehAgua(fila) {
    return aguas.has(fila);
  }

  function ocupada(fila, col) {
    return est.plantados.some((p) => p.fila === fila && p.col === col && p.vida > 0);
  }

  function flutuar(x, y, txt, cor = CORES.semente) {
    est.flutuantes.push({ x, y, txt, cor, t: 1.1 });
  }

  function faisca(x, y, cor, quantidade = 8, forca = 90) {
    for (let i = 0; i < quantidade; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = forca * (0.4 + Math.random() * 0.8);
      est.particulas.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40,
        t: 0.4 + Math.random() * 0.4, tMax: 0.8, cor, r: 2 + Math.random() * 3,
      });
    }
  }

  // ------------------------------------------------------------- construção

  function plantar(carta, fila, col) {
    const agua = ehAgua(fila);
    if (agua && !carta.aquatico) {
      flutuar(centroX(col), centroY(fila), 'só bicho de água aqui', CORES.perigo);
      som.erro();
      return false;
    }
    est.plantados.push({
      id: idSeq++,
      def: carta,
      fila,
      col,
      x: centroX(col),
      y: centroY(fila),
      vida: carta.vida,
      vidaMax: carta.vida,
      cd: carta.papel === 'gerador' ? carta.intervalo * 0.6 : (carta.intervalo || 1) * 0.5,
      nascido: est.tempo,
      tremor: 0,
      avanco: 0,
    });
    est.sementes -= carta.custo;
    est.recargas[carta.id] = carta.recarga;
    som.plantar();
    faisca(centroX(col), centroY(fila) + 30, '#8a6a44', 6, 60);
    return true;
  }

  function removerPlantado(p) {
    p.vida = 0;
    faisca(p.x, p.y, '#9c8a6a', 10, 80);
  }

  // ------------------------------------------------------------------ ondas

  function soltarOnda(indice) {
    const onda = fase.ondas[indice];
    if (!onda) return;
    som.onda();
    const fila = [];
    for (const [tipo, quantos] of onda.monstros) {
      for (let i = 0; i < quantos; i++) fila.push(tipo);
    }
    // espalha a onda no tempo e nas fileiras, senão todos entram colados
    fila.sort(() => Math.random() - 0.5);
    fila.forEach((tipo, i) => {
      est.naFila.push({
        tipo,
        quando: est.tempo + i * (0.55 + Math.random() * 0.5),
        fila: Math.floor(Math.random() * FILEIRAS),
      });
    });
  }

  function nascerMonstro(tipo, filaSugerida) {
    const def = MONSTRO_POR_ID[tipo];
    if (!def) return;
    let fila = filaSugerida;
    // quem não voa nem nada não entra por fileira alagada
    if (ehAgua(fila) && !def.voa) {
      const secas = [...Array(FILEIRAS).keys()].filter((f) => !ehAgua(f));
      fila = secas[Math.floor(Math.random() * secas.length)] ?? fila;
    }
    est.monstros.push({
      id: idSeq++,
      def,
      fila,
      x: vp.L + 40 + Math.random() * 60,
      y: centroY(fila),
      vida: def.vida,
      vidaMax: def.vida,
      cd: 0,
      pulou: false,
      pulando: 0,
      congelado: 0,
      atordoado: 0,
      dots: [],
      bravo: false,
      faseChefe: 0,
      cdInvoca: 6,
      tremor: 0,
      passo: Math.random() * 10,
    });
    if (def.chefe) {
      som.chefe();
      est.abalo = 1.2;
      est.aviso = { texto: `${def.nome} — ${def.lenda}`, t: 6 };
    } else if (def.chefinho) {
      som.chefe();
      est.abalo = 0.6;
    }
  }

  function vivoVisivel(m) {
    // o oculto só aparece com revelador em campo, ou quando está mordendo
    return !m.def.oculto || est.revelado || m.mordendo;
  }

  // ------------------------------------------------------------------ dano

  function darDano(m, dano, deAereo = false, ignoraArmadura = false) {
    if (m.def.voa && !deAereo) return false;
    let real = dano;
    if (m.def.armadura && !ignoraArmadura) real = Math.max(dano * 0.25, dano - m.def.armadura);
    m.vida -= real;
    m.tremor = 0.12;
    if (m.vida <= 0) matar(m);
    return true;
  }

  function matar(m) {
    if (m.morto) return;
    m.morto = true;
    est.mortos++;

    // O monstro devolve semente ao cair, e essa vai direto para o saldo — no
    // meio da briga ninguém tem mão livre para clicar em cada gota. É a renda
    // que não depende de ter plantado gerador: quem segura a linha se paga.
    const premio = m.def.valor || 10;
    est.sementes += premio;
    est.ganhoMortes += premio;
    flutuar(m.x, m.y - 34, `+${premio}`, CORES.semente);

    faisca(m.x, m.y, m.def.chefe ? '#e0913a' : '#8a7a64', m.def.chefe ? 40 : 12, m.def.chefe ? 220 : 110);
    som.morte();
    if (premio >= 50) som.moeda();
    if (m.def.chefe) {
      est.abalo = 1.6;
      est.aviso = { texto: 'A Cuca caiu. O Brasil respira.', t: 5 };
    }
  }

  function ferirPlantado(p, dano) {
    p.vida -= dano;
    p.tremor = 0.14;
    if (p.vida <= 0) {
      faisca(p.x, p.y, '#9c8a6a', 12, 90);
      som.mordida();
    }
  }

  // ----------------------------------------------------------- atualizações

  function passoPlantados(dt) {
    est.revelado = est.plantados.some((p) => p.vida > 0 && p.def.revela);

    for (const p of est.plantados) {
      if (p.vida <= 0) continue;
      const d = p.def;
      p.tremor = Math.max(0, p.tremor - dt);
      p.cd -= dt;

      // a onça anda devagar para a frente até achar encrenca
      if (d.avanca) {
        const alvoNaFrente = est.monstros.some((m) => !m.morto && m.fila === p.fila && m.x > p.x && m.x < p.x + CEL_L * 1.2);
        if (!alvoNaFrente && p.avanco < CEL_L * 0.8) {
          p.avanco += 8 * dt;
          p.x = centroX(p.col) + p.avanco;
        }
      }

      if (p.cd > 0) continue;

      switch (d.papel) {
        case 'gerador': {
          p.cd = d.intervalo / (fase.fatorSementes || 1);
          // cai ao lado do bicho, não em cima dele, para dar onde clicar
          est.coletaveis.push({
            x: p.x + (Math.random() < 0.5 ? -1 : 1) * (30 + Math.random() * 22),
            y: p.y - 24,
            alvoY: p.y + 34,
            valor: d.produz,
            t: 9,
            giro: Math.random() * 6,
          });
          break;
        }

        case 'atirador': {
          const alvos = est.monstros.filter(
            (m) => !m.morto && m.fila === p.fila && m.x > p.x - 10 && vivoVisivel(m) && (!m.def.voa || d.aereo)
          );
          if (!alvos.length) {
            p.cd = 0.1;
            break;
          }
          p.cd = d.intervalo;
          p.atirouEm = est.tempo;
          est.projeteis.push({
            x: p.x + 26,
            y: p.y - 8,
            fila: p.fila,
            vel: 420,
            dano: d.dano,
            tipo: d.projetil || 'coco',
            perfura: !!d.perfura,
            aereo: !!d.aereo,
            veneno: d.veneno || null,
            atingidos: new Set(),
            giro: 0,
          });
          som.tiro();
          break;
        }

        case 'corpo': {
          const alvo = est.monstros.find(
            (m) => !m.morto && m.fila === p.fila && Math.abs(m.x - p.x) < CEL_L * 0.85 && vivoVisivel(m) && !m.def.voa
          );
          if (!alvo) {
            p.cd = 0.1;
            break;
          }
          p.cd = d.intervalo;
          p.atacouEm = est.tempo;
          darDano(alvo, d.dano);
          if (d.empurra) alvo.x += d.empurra;
          faisca(alvo.x - 20, alvo.y, CORES.perigo, 6, 80);
          som.acerto();
          break;
        }

        case 'area': {
          const perto = est.monstros.filter(
            (m) => !m.morto && Math.hypot(m.x - p.x, m.y - p.y) < d.raio * CEL_L && vivoVisivel(m)
          );
          if (!perto.length) {
            p.cd = 0.2;
            break;
          }
          p.cd = d.intervalo;
          p.pulsouEm = est.tempo;
          for (const m of perto) {
            darDano(m, d.dano, true);
            if (d.lentidao) m.congelado = Math.max(m.congelado, d.lentidao.duracao);
            if (d.atordoa) m.atordoado = Math.max(m.atordoado, d.atordoa);
          }
          if (d.lentidao) som.gelo();
          if (d.atordoa) som.rugido();
          est.abalo = Math.max(est.abalo, 0.3);
          break;
        }

        case 'bomba': {
          const perto = est.monstros.filter(
            (m) => !m.morto && Math.hypot(m.x - p.x, m.y - p.y) < d.raio * CEL_L * 0.6 && vivoVisivel(m)
          );
          if (!perto.length) {
            p.cd = 0.1;
            break;
          }
          for (const m of perto) darDano(m, d.dano, true, true);
          faisca(p.x, p.y, '#8a9b5c', 26, 190);
          som.explosao();
          est.abalo = Math.max(est.abalo, 0.7);
          removerPlantado(p);
          break;
        }

        default:
          p.cd = 1;
      }
    }

    est.plantados = est.plantados.filter((p) => p.vida > 0);
  }

  function passoMonstros(dt) {
    for (const m of est.monstros) {
      if (m.morto) continue;
      const d = m.def;
      m.tremor = Math.max(0, m.tremor - dt);
      m.congelado = Math.max(0, m.congelado - dt);
      m.atordoado = Math.max(0, m.atordoado - dt);
      m.cd -= dt;
      m.passo += dt;

      // veneno e queimadura
      for (const dot of m.dots) {
        dot.t -= dt;
        dot.acumulado += dot.dano * dt;
        if (dot.acumulado >= 1) {
          const inteiro = Math.floor(dot.acumulado);
          dot.acumulado -= inteiro;
          m.vida -= inteiro;
          if (m.vida <= 0) matar(m);
        }
      }
      m.dots = m.dots.filter((x) => x.t > 0);
      if (m.morto) continue;

      // chefe: fases e invocação
      if (d.fases) {
        const frac = m.vida / m.vidaMax;
        while (m.faseChefe < d.fases.length && frac <= d.fases[m.faseChefe].vida) {
          est.aviso = { texto: d.fases[m.faseChefe].fala, t: 4 };
          est.abalo = 1;
          som.chefe();
          m.faseChefe++;
        }
      }
      if (d.invoca) {
        m.cdInvoca -= dt;
        if (m.cdInvoca <= 0) {
          m.cdInvoca = d.invoca.intervalo;
          for (let i = 0; i < d.invoca.quantidade; i++) {
            const tipo = d.invoca.tipos[Math.floor(Math.random() * d.invoca.tipos.length)];
            nascerMonstro(tipo, Math.floor(Math.random() * FILEIRAS));
          }
          est.aviso = { texto: 'A Cuca chamou reforço!', t: 2.5 };
        }
      }

      // fica mais rápido quando apanha
      const gatilho = d.enfurece || d.disparada;
      if (gatilho && !m.bravo && m.vida / m.vidaMax <= gatilho.gatilho) {
        m.bravo = true;
        som.rugido();
        faisca(m.x, m.y, CORES.fogo, 10, 100);
      }

      if (m.atordoado > 0) continue;

      // quem está na frente dele nesta fileira?
      const alvo = est.plantados.find(
        (p) => p.vida > 0 && p.fila === m.fila && m.x - p.x < (d.distancia ? CEL_L * d.distancia : CEL_L * 0.62) && m.x > p.x
      );

      // o Saci pula a primeira defesa que encontra
      if (alvo && d.pula && !m.pulou) {
        m.pulou = true;
        m.pulando = 0.6;
        som.clique();
      }

      if (m.pulando > 0) {
        m.pulando -= dt;
        m.x -= 150 * dt;
        continue;
      }

      // voador ignora quem está no chão
      if (alvo && !d.voa) {
        m.mordendo = true;
        if (m.cd <= 0) {
          m.cd = d.intervalo;
          ferirPlantado(alvo, d.dano);
          som.mordida();
          if (alvo.def.espinhos) darDano(m, alvo.def.espinhos, true, true);
          if (d.queima) m.marcouFogo = true;
          faisca(alvo.x + 18, alvo.y, CORES.perigo, 5, 70);
        }
        // o de longe queima/cospe sem chegar perto
        if (d.distancia && d.queima) {
          alvo.pegandoFogo = 0.4;
        }
        continue;
      }

      m.mordendo = false;
      let vel = d.velocidade;
      if (m.bravo) vel *= (d.enfurece || d.disparada).fator;
      if (m.congelado > 0) vel *= 0.45;
      m.x -= vel * dt;

      if (m.x < CERCA_X - 10) {
        terminar(false);
        return;
      }
    }

    est.monstros = est.monstros.filter((m) => !m.morto || false);
    // guarda os mortos por um instante só para a partícula aparecer
    est.monstros = est.monstros.filter((m) => !m.morto);
  }

  function passoProjeteis(dt) {
    for (const pr of est.projeteis) {
      pr.x += pr.vel * dt;
      pr.giro += dt * 8;
      const alvos = est.monstros.filter(
        (m) => !m.morto && m.fila === pr.fila && !pr.atingidos.has(m.id) &&
          Math.abs(m.x - pr.x) < 34 && vivoVisivel(m) && (!m.def.voa || pr.aereo)
      );
      for (const m of alvos) {
        pr.atingidos.add(m.id);
        darDano(m, pr.dano, pr.aereo);
        if (pr.veneno) m.dots.push({ dano: pr.veneno.dano, t: pr.veneno.duracao, acumulado: 0, cor: '#8a9b5c' });
        faisca(pr.x, pr.y, '#c9a86a', 5, 70);
        som.acerto();
        if (!pr.perfura) {
          pr.morto = true;
          break;
        }
      }
      if (pr.x > vp.L + 30) pr.morto = true;
    }
    est.projeteis = est.projeteis.filter((p) => !p.morto);
  }

  function passoColetaveis(dt) {
    for (const c of est.coletaveis) {
      c.t -= dt;
      c.giro += dt * 2;
      if (c.y < c.alvoY) c.y = Math.min(c.alvoY, c.y + 70 * dt);
      if (c.t <= 0) c.morto = true;
    }
    est.coletaveis = est.coletaveis.filter((c) => !c.morto);
  }

  function passoParticulas(dt) {
    for (const p of est.particulas) {
      p.t -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 260 * dt;
      if (p.t <= 0) p.morto = true;
    }
    est.particulas = est.particulas.filter((p) => !p.morto);

    for (const f of est.flutuantes) {
      f.t -= dt;
      f.y -= 26 * dt;
      if (f.t <= 0) f.morto = true;
    }
    est.flutuantes = est.flutuantes.filter((f) => !f.morto);
  }

  function passoOndas(dt) {
    // solta os monstros já agendados
    const prontos = est.naFila.filter((n) => n.quando <= est.tempo);
    for (const n of prontos) nascerMonstro(n.tipo, n.fila);
    est.naFila = est.naFila.filter((n) => n.quando > est.tempo);

    if (est.ondaAtual < fase.ondas.length - 1) {
      est.proximaOnda -= dt;
      if (est.proximaOnda <= 0) {
        est.ondaAtual++;
        soltarOnda(est.ondaAtual);
        const prox = fase.ondas[est.ondaAtual + 1];
        est.proximaOnda = prox ? prox.espera : 0;
      }
    } else if (!est.naFila.length && !est.monstros.length && !est.terminou) {
      terminar(true);
    }
  }

  function terminar(venceu) {
    if (est.terminou) return;
    est.terminou = true;
    est.venceu = venceu;
    est.fimEm = est.tempo;
    pararMusica();
    if (venceu) som.vitoria();
    else som.derrota();
    setTimeout(
      () =>
        aoTerminar(venceu, {
          mortos: est.mortos,
          tempo: est.tempo,
          sobra: Math.floor(est.sementes),
          ganhoMortes: est.ganhoMortes,
          ganhoColeta: est.ganhoColeta,
          // quantas ondas o jogador segurou: a derrota paga por isso
          ondaAtual: est.ondaAtual,
          ondas: fase.ondas.length,
        }),
      1600
    );
  }

  // ------------------------------------------------------------------ ciclo

  function atualizar(dt) {
    if (est.pausado || est.terminou) {
      passoParticulas(dt);
      est.abalo = Math.max(0, est.abalo - dt * 2);
      return;
    }
    est.tempo += dt;
    est.abalo = Math.max(0, est.abalo - dt * 2);
    if (est.aviso) {
      est.aviso.t -= dt;
      if (est.aviso.t <= 0) est.aviso = null;
    }
    for (const id in est.recargas) est.recargas[id] = Math.max(0, est.recargas[id] - dt);

    passoPlantados(dt);
    passoMonstros(dt);
    passoProjeteis(dt);
    passoColetaveis(dt);
    passoParticulas(dt);
    passoOndas(dt);
  }

  // --------------------------------------------------------------- entrada

  /** Recolhe qualquer semente sob o dedo/cursor. Devolve quantas pegou. */
  function colherEm(x, y, raio = 46) {
    let pegou = 0;
    for (const c of est.coletaveis) {
      if (c.morto) continue;
      if (Math.hypot(c.x - x, c.y - y) < raio) {
        est.sementes += c.valor;
        est.ganhoColeta += c.valor;
        c.morto = true;
        flutuar(c.x, c.y - 10, `+${c.valor}`);
        pegou++;
      }
    }
    if (pegou) som.colher();
    return pegou;
  }

  function pressionar(x, y) {
    if (est.terminou) return;
    est.arrastando = true;
    est.mouse = { x, y };

    if (colherEm(x, y)) return;

    if (y < HUD_H) {
      toqueNoHud(x, y);
      return;
    }
    // fora do HUD, o toque só arma a mira — plantar acontece ao soltar, para
    // dar tempo de arrastar até a casa certa com o dedo ainda na tela
  }

  function toqueNoHud(x, y) {
    for (let i = 0; i < cartas.length; i++) {
      const b = caixaDaCarta(i);
      // área de toque com folga de 4px em volta do desenho da carta
      if (x >= b.x - 4 && x <= b.x + b.w + 4 && y >= b.y - 4 && y <= b.y + b.h + 4) {
        const c = cartas[i];
        est.pa = false;
        est.selecionada = est.selecionada === c ? null : c;
        som.carta();
        vibrar(8);
        return;
      }
    }
    if (x > vp.L - 106 && y > 6 && y < HUD_H - 6) {
      est.pa = !est.pa;
      est.selecionada = null;
      som.clique();
      vibrar(8);
    }
  }

  function soltar(x, y) {
    est.arrastando = false;
    if (est.terminou) return;
    if (y < HUD_H) return;

    const fila = filaDeY(y);
    const col = colDeX(x);
    if (fila < 0 || fila >= FILEIRAS || col < 0 || col >= COLUNAS) return;

    if (est.pa) {
      const alvo = est.plantados.find((p) => p.fila === fila && p.col === col && p.vida > 0);
      if (alvo) {
        // devolve metade: errar o posicionamento não pode custar a fase inteira
        const volta = Math.floor(alvo.def.custo * 0.5);
        est.sementes += volta;
        flutuar(alvo.x, alvo.y - 20, `+${volta}`, CORES.bom);
        removerPlantado(alvo);
        som.clique();
        vibrar(12);
      }
      est.pa = false;
      return;
    }

    if (!est.selecionada) return;
    const carta = est.selecionada;
    if (est.recargas[carta.id] > 0) {
      som.erro();
      return;
    }
    if (est.sementes < carta.custo) {
      flutuar(centroX(col), centroY(fila), 'sem sementes', CORES.perigo);
      som.erro();
      return;
    }
    if (ocupada(fila, col)) {
      som.erro();
      return;
    }
    if (plantar(carta, fila, col)) {
      est.selecionada = null;
      vibrar(14);
    }
  }

  function mover(x, y) {
    est.mouse = { x, y };
    // arrastar o dedo por cima das sementes recolhe todas no caminho: catar
    // uma a uma com toque preciso é o que mais cansa neste jogo no celular
    if (est.arrastando && !est.terminou) colherEm(x, y);
  }

  // --------------------------------------------------------------- desenho

  function desenharCampo(ctx) {
    ctx.drawImage(fundo, 0, CAMPO_Y);

    // Xadrez do gramado. É o elemento mais reconhecível do gênero e resolve
    // duas coisas ao mesmo tempo: dá cara de tabuleiro e deixa o jogador
    // contar as casas de longe, sem precisar de linha de grade nenhuma.
    for (let f = 0; f < FILEIRAS; f++) {
      const y = CAMPO_Y + f * FILA_H;
      if (ehAgua(f)) {
        for (let c = 0; c < COLUNAS; c++) {
          const x = CERCA_X + c * CEL_L;
          ctx.fillStyle = (f + c) % 2 ? 'rgba(74, 138, 168, 0.62)' : 'rgba(56, 116, 148, 0.68)';
          ctx.fillRect(x, y, CEL_L + 1, FILA_H + 1);
        }
        for (let i = 0; i < 9; i++) {
          traco(ctx, [[CERCA_X + i * CEL_L, y + 20 + (i % 3) * 26], [CERCA_X + i * CEL_L + 60, y + 26 + (i % 3) * 26]], {
            cor: alfa('#dff0f6', 0.55), largura: 2, passadas: 1, semente: 400 + f * 10 + i,
          });
        }
      } else {
        for (let c = 0; c < COLUNAS; c++) {
          const x = CERCA_X + c * CEL_L;
          ctx.fillStyle = (f + c) % 2 ? 'rgba(150, 208, 88, 0.5)' : 'rgba(108, 172, 60, 0.5)';
          ctx.fillRect(x, y, CEL_L + 1, FILA_H + 1);
        }
      }
    }

    // Onde o tabuleiro acaba e começa a pista de aproximação. Sem essa marca,
    // numa tela larga o jogador não sabe até onde pode plantar.
    const fimDoCampo = CERCA_X + COLUNAS * CEL_L;
    if (fimDoCampo < vp.L - 4) {
      const g = ctx.createLinearGradient(fimDoCampo, 0, Math.min(vp.L, fimDoCampo + 90), 0);
      g.addColorStop(0, 'rgba(30, 40, 20, 0.22)');
      g.addColorStop(1, 'rgba(30, 40, 20, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(fimDoCampo, CAMPO_Y, vp.L - fimDoCampo, CAMPO_H);
      linha(ctx, fimDoCampo, CAMPO_Y, fimDoCampo, ALTURA, {
        cor: 'rgba(43,38,34,0.3)', largura: 2, passadas: 1, semente: 611,
      });
    }

    // tufos de grama nas junções, para o xadrez não virar tabuleiro de damas
    for (let f = 0; f <= FILEIRAS; f++) {
      const y = CAMPO_Y + f * FILA_H;
      if (f < FILEIRAS && ehAgua(f)) continue;
      if (f > 0 && ehAgua(f - 1)) continue;
      for (let c = 0; c < COLUNAS; c += 1) {
        const x = CERCA_X + c * CEL_L + CEL_L / 2;
        traco(ctx, [[x - 9, y], [x - 4, y - 7], [x, y]], { cor: 'rgba(58, 104, 34, 0.5)', largura: 2, passadas: 1, semente: 700 + f * 13 + c });
        traco(ctx, [[x + 2, y], [x + 7, y - 9], [x + 11, y]], { cor: 'rgba(58, 104, 34, 0.42)', largura: 2, passadas: 1, semente: 760 + f * 13 + c });
      }
    }

    // O quintal onde os humanos estão: chão de terra batida e uma cerca de
    // tábuas fechada. É a linha que não pode ser cruzada, então precisa parecer
    // uma barreira de verdade — antes eram estacas soltas boiando na grama.
    const gt = ctx.createLinearGradient(0, CAMPO_Y, CERCA_X, CAMPO_Y);
    gt.addColorStop(0, '#8a6a45');
    gt.addColorStop(1, '#a3835a');
    ctx.fillStyle = gt;
    ctx.fillRect(0, CAMPO_Y, CERCA_X, CAMPO_H);
    // pedrinhas do chão de terra
    const rp = rng(940);
    ctx.save();
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < 26; i++) {
      circulo(ctx, rp() * (CERCA_X - 20) + 6, CAMPO_Y + rp() * CAMPO_H, 1.5 + rp() * 2.5, {
        cor: null, preenche: '#6b5232', semente: 950 + i,
      });
    }
    ctx.restore();

    // tábuas verticais coladas, formando parede
    for (let x = CERCA_X - 30; x < CERCA_X; x += 11) {
      forma(ctx, [[x, CAMPO_Y], [x + 10, CAMPO_Y], [x + 10, ALTURA], [x, ALTURA]], {
        cor: '#5c4022', largura: 1.6, preenche: x % 22 === 0 ? '#8a6234' : '#7a5528', semente: 500 + x,
      });
    }
    // travessas horizontais
    for (const fy of [0.16, 0.52, 0.88]) {
      const y = CAMPO_Y + CAMPO_H * fy;
      forma(ctx, [[CERCA_X - 34, y], [CERCA_X + 2, y], [CERCA_X + 2, y + 13], [CERCA_X - 34, y + 13]], {
        cor: '#4a3218', largura: 2, preenche: '#9c7038', semente: 560 + fy * 100,
      });
    }
    linha(ctx, CERCA_X, CAMPO_Y, CERCA_X, ALTURA, { cor: '#3f2a14', largura: 3, semente: 519 });

    // placa pregada na cerca
    const py = CAMPO_Y + CAMPO_H / 2;
    const pl = CERCA_X - 42;
    const pcx = 6 + pl / 2;
    caixa(ctx, 6, py - 44, pl, 88, 8, { cor: '#4a3218', largura: 2.6, preenche: '#c9a165', semente: 570 });
    texto(ctx, 'HUMANOS', pcx, py - 12, { tamanho: 13, alinha: 'center', cor: '#4a3218' });
    texto(ctx, 'AQUI', pcx, py + 10, { tamanho: 13, alinha: 'center', cor: '#4a3218' });
    texto(ctx, '↓', pcx, py + 34, { tamanho: 19, alinha: 'center', cor: '#7a5528' });
  }

  function desenharPlantados(ctx) {
    for (const p of est.plantados) {
      const d = p.def;
      const tremorX = p.tremor > 0 ? (Math.random() - 0.5) * 6 : 0;
      const pulou = d.papel === 'atirador' && est.tempo - (p.atirouEm || -9) < 0.16;
      const bateu = d.papel === 'corpo' && est.tempo - (p.atacouEm || -9) < 0.18;
      const escala = 0.92 * (pulou ? 1.08 : 1) * (bateu ? 1.12 : 1);
      const balanço = Math.sin(est.tempo * 2.4 + p.x) * 2;

      sombra(ctx, p.x, p.y + 46, 40, 12, 0.36);
      porSprite(ctx, spriteAnimal(d.id, 128), p.x + tremorX + (bateu ? 8 : 0), p.y + balanço, escala, false);

      // pulso do bicho de área
      if (d.papel === 'area' && est.tempo - (p.pulsouEm || -9) < 0.5) {
        const t = (est.tempo - p.pulsouEm) / 0.5;
        circulo(ctx, p.x, p.y, d.raio * CEL_L * t, {
          cor: d.lentidao ? '#9fd4e6' : CORES.destaque, largura: 3, alfa: 1 - t, semente: 9,
        });
      }

      // vida, só quando machucado
      if (p.vida < p.vidaMax) {
        const frac = p.vida / p.vidaMax;
        const bw = 54;
        ctx.fillStyle = 'rgba(43,38,34,0.35)';
        ctx.fillRect(p.x - bw / 2, p.y - 52, bw, 7);
        ctx.fillStyle = frac > 0.5 ? CORES.bom : frac > 0.25 ? CORES.destaque : CORES.perigo;
        ctx.fillRect(p.x - bw / 2, p.y - 52, bw * frac, 7);
      }
    }
  }

  function desenharMonstros(ctx) {
    for (const m of est.monstros) {
      const d = m.def;
      if (!vivoVisivel(m)) {
        // invisível: só um vulto que denuncia a posição de leve
        ctx.save();
        ctx.globalAlpha = 0.16;
        porSprite(ctx, spriteMonstro(d.id, 128), m.x, m.y, (d.escala || 1) * 0.85);
        ctx.restore();
        continue;
      }
      const tremorX = m.tremor > 0 ? (Math.random() - 0.5) * 7 : 0;
      const balanço = Math.sin(m.passo * 6) * 3;
      const pulo = m.pulando > 0 ? -Math.sin((0.6 - m.pulando) / 0.6 * Math.PI) * 60 : 0;
      const escala = (d.escala || 1) * 0.94;

      sombra(ctx, m.x, m.y + 46, 38 * (d.escala || 1), 12 * (d.escala || 1), 0.36);
      ctx.save();
      if (m.congelado > 0) {
        ctx.filter = 'saturate(0.4)';
      }
      porSprite(ctx, spriteMonstro(d.id, 128), m.x + tremorX, m.y + balanço + pulo, escala, false, m.atordoado > 0 ? 0.75 : 1);
      ctx.restore();

      if (m.congelado > 0) {
        circulo(ctx, m.x, m.y, 40 * (d.escala || 1), { cor: '#9fd4e6', largura: 2.4, alfa: 0.5, semente: 11 });
      }
      if (m.atordoado > 0) {
        for (let i = 0; i < 3; i++) {
          const a = est.tempo * 5 + (i / 3) * Math.PI * 2;
          texto(ctx, '★', m.x + Math.cos(a) * 26, m.y - 56 + Math.sin(a) * 8, { tamanho: 17, cor: CORES.destaque, alinha: 'center' });
        }
      }
      if (m.dots.length) {
        circulo(ctx, m.x + 22, m.y - 38, 6, { cor: null, preenche: alfa('#8a9b5c', 0.75), semente: 13 });
      }

      // barra de vida
      const frac = Math.max(0, m.vida / m.vidaMax);
      const bw = d.chefe ? 150 : d.chefinho ? 96 : 56;
      const by = m.y - 52 * (d.escala || 1) - 6;
      ctx.fillStyle = 'rgba(43,38,34,0.4)';
      ctx.fillRect(m.x - bw / 2, by, bw, d.chefe ? 12 : 7);
      ctx.fillStyle = d.chefe ? '#a8407a' : frac > 0.5 ? CORES.perigo : CORES.destaque;
      ctx.fillRect(m.x - bw / 2, by, bw * frac, d.chefe ? 12 : 7);
      if (d.chefe || d.chefinho) {
        texto(ctx, d.nome, m.x, by - 8, { tamanho: 15, alinha: 'center', cor: PAPEL, contorno: TINTA, larguraContorno: 4 });
      }
    }
  }

  function desenharProjeteis(ctx) {
    for (const pr of est.projeteis) {
      ctx.save();
      ctx.translate(pr.x, pr.y);
      ctx.rotate(pr.giro);
      switch (pr.tipo) {
        case 'coco':
          circulo(ctx, 0, 0, 9, { cor: TINTA, largura: 2, preenche: '#6b4a2f', semente: 21 });
          circulo(ctx, -3, -2, 2, { cor: null, preenche: '#3d2a1a', semente: 22 });
          break;
        case 'ferrao':
          forma(ctx, [[-8, 0], [6, -4], [6, 4]], { cor: TINTA, largura: 1.6, preenche: '#e5b93c', semente: 23 });
          break;
        case 'pena':
          forma(ctx, [[-9, 0], [0, -5], [9, 0], [0, 5]], { cor: TINTA, largura: 1.6, preenche: '#e4d3ae', semente: 24 });
          break;
        case 'cuspe':
          elipse(ctx, 0, 0, 12, 6, { cor: '#5f7a44', largura: 2, preenche: '#9ab36e', semente: 25 });
          break;
        case 'garra':
          forma(ctx, [[-10, -6], [8, 0], [-10, 6], [-4, 0]], { cor: TINTA, largura: 2, preenche: '#e8b23c', semente: 26 });
          break;
        case 'eco':
        default:
          circulo(ctx, 0, 0, 7, { cor: '#7d6688', largura: 2, preenche: alfa('#b9a4c4', 0.8), semente: 27 });
      }
      ctx.restore();
    }
  }

  function desenharColetaveis(ctx) {
    for (const c of est.coletaveis) {
      const piscando = c.t < 2.5 && Math.floor(c.t * 6) % 2 === 0;
      ctx.save();
      ctx.globalAlpha = piscando ? 0.45 : 1;
      ctx.translate(c.x, c.y);
      ctx.rotate(Math.sin(c.giro) * 0.25);
      elipse(ctx, 0, 0, 15, 18, { cor: '#8a6a2a', largura: 2.4, preenche: CORES.semente, semente: 31 });
      forma(ctx, [[-6, -12], [6, -12], [3, -20], [-3, -20]], { cor: '#6b5220', largura: 2, preenche: '#a87f34', semente: 32 });
      traco(ctx, [[-6, 2], [0, 6], [6, 2]], { cor: '#8a6a2a', largura: 1.8, semente: 33 });
      ctx.restore();
    }
  }

  function desenharParticulas(ctx) {
    for (const p of est.particulas) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.t / p.tMax);
      ctx.fillStyle = p.cor;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    for (const f of est.flutuantes) {
      texto(ctx, f.txt, f.x, f.y, {
        tamanho: 21, alinha: 'center', cor: f.cor, contorno: PAPEL, larguraContorno: 4, alfa: Math.min(1, f.t),
      });
    }
  }

  function desenharClima(ctx) {
    if (fase.noite) {
      ctx.fillStyle = 'rgba(24, 26, 54, 0.34)';
      ctx.fillRect(0, CAMPO_Y, vp.L, CAMPO_H);
    }
    if (fase.nevoa && !est.revelado) {
      // a névoa engole o meio do campo; uma Coruja limpa tudo
      const g = ctx.createLinearGradient(CERCA_X + CEL_L * 2.4, 0, vp.L, 0);
      g.addColorStop(0, 'rgba(228, 232, 226, 0)');
      g.addColorStop(0.35, 'rgba(228, 232, 226, 0.82)');
      g.addColorStop(1, 'rgba(214, 220, 214, 0.92)');
      ctx.fillStyle = g;
      ctx.fillRect(CERCA_X, CAMPO_Y, vp.L - CERCA_X, CAMPO_H);
      for (let i = 0; i < 7; i++) {
        const x = CERCA_X + 420 + ((est.tempo * 12 + i * 190) % (vp.L - CERCA_X - 300));
        circulo(ctx, x, CAMPO_Y + 70 + i * 84, 60, { cor: null, preenche: 'rgba(255,255,255,0.28)', semente: 600 + i });
      }
    }
  }

  function desenharMira(ctx) {
    if (!est.mouse || (!est.selecionada && !est.pa)) return;
    const { x, y } = est.mouse;
    if (y < HUD_H) return;
    const fila = filaDeY(y);
    const col = colDeX(x);
    if (fila < 0 || fila >= FILEIRAS || col < 0 || col >= COLUNAS) return;

    const cx = centroX(col);
    const cy = centroY(fila);
    const livre = !ocupada(fila, col);
    const podeAgua = !ehAgua(fila) || (est.selecionada && est.selecionada.aquatico);
    const ok = est.pa ? !livre : livre && podeAgua && est.sementes >= est.selecionada.custo;

    // realce da casa inteira: no toque o dedo tampa o centro, então o que
    // orienta é a moldura grossa em volta e o fantasma deslocado para cima
    ctx.save();
    ctx.fillStyle = ok ? 'rgba(120, 200, 90, 0.3)' : 'rgba(200, 90, 70, 0.3)';
    ctx.fillRect(cx - CEL_L / 2, cy - FILA_H / 2, CEL_L, FILA_H);
    ctx.restore();
    caixa(ctx, cx - CEL_L / 2 + 4, cy - FILA_H / 2 + 4, CEL_L - 8, FILA_H - 8, 10, {
      cor: ok ? CORES.bom : CORES.perigo, largura: 5, semente: 77, alfa: 0.95,
    });
    if (est.selecionada && ok) {
      ctx.save();
      ctx.globalAlpha = 0.75;
      porSprite(ctx, spriteAnimal(est.selecionada.id, 128), cx, cy - (est.arrastando ? FILA_H * 0.55 : 0), 0.85);
      ctx.restore();
    }
    if (est.pa) {
      texto(ctx, '⛏', cx, cy - (est.arrastando ? 50 : -10), {
        tamanho: 44, alinha: 'center', cor: CORES.perigo, contorno: PAPEL, larguraContorno: 5,
      });
    }
  }

  function desenharHud(ctx) {
    // barra de madeira: o campo agora é verde vivo e um HUD claro brigava com
    // ele. Madeira escura empurra o tabuleiro para a frente.
    const g = ctx.createLinearGradient(0, 0, 0, HUD_H);
    g.addColorStop(0, '#8a6234');
    g.addColorStop(0.5, '#6f4d28');
    g.addColorStop(1, '#5a3e20');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vp.L, HUD_H);
    // veios
    ctx.save();
    ctx.globalAlpha = 0.16;
    for (let i = 0; i < 14; i++) {
      traco(ctx, [[0, 8 + i * 7], [vp.L * 0.4, 10 + i * 7], [vp.L, 6 + i * 7]], {
        cor: '#3f2a14', largura: 1.6, passadas: 1, semente: 800 + i,
      });
    }
    ctx.restore();
    linha(ctx, 0, HUD_H - 1, vp.L, HUD_H - 1, { cor: '#3f2a14', largura: 4, semente: 88 });

    // sementes
    elipse(ctx, 42, 40, 17, 20, { cor: '#8a6a2a', largura: 2.4, preenche: CORES.semente, semente: 91 });
    forma(ctx, [[36, 26], [48, 26], [45, 17], [39, 17]], { cor: '#6b5220', largura: 2, preenche: '#a87f34', semente: 92 });
    texto(ctx, String(Math.floor(est.sementes)), 70, 46, {
      tamanho: 30, cor: '#ffe9a8', contorno: '#3f2a14', larguraContorno: 4,
    });
    texto(ctx, 'sementes', 70, 64, { tamanho: 12, cor: '#d9bd8a' });

    // cartas
    cartas.forEach((c, i) => {
      const b = caixaDaCarta(i);
      const recarga = est.recargas[c.id];
      const barato = est.sementes >= c.custo;
      const ativa = est.selecionada === c;
      const pronta = recarga <= 0 && barato;

      // a carta escolhida cresce e sobe: no toque não existe cursor para
      // mostrar o que está na mão, então o próprio cartão precisa dizer
      const dx = ativa ? -3 : 0;
      caixa(ctx, b.x + dx, b.y + dx, b.w - dx * 2, b.h - dx * 2, 10, {
        cor: ativa ? CORES.destaqueEscuro : TINTA,
        largura: ativa ? 5 : 2.4,
        preenche: pronta ? '#fbf5e6' : '#ddd3c0',
        semente: 100 + i,
      });
      ctx.save();
      ctx.globalAlpha = pronta ? 1 : 0.45;
      porSprite(ctx, spriteAnimal(c.id, 128), b.x + b.w / 2, b.y + b.h * 0.44, (b.h / 88) * 0.5);
      ctx.restore();
      texto(ctx, c.nome, b.x + b.w / 2, b.y + 15, { tamanho: 12, alinha: 'center', cor: TINTA });
      // selo do treino: quem investiu moedas precisa ver onde elas foram
      if (c.rotuloNivel) {
        caixa(ctx, b.x + b.w - 26, b.y + 4, 22, 16, 4, {
          cor: CORES.destaqueEscuro, largura: 1.8, preenche: '#f7d98a', semente: 150 + i,
        });
        texto(ctx, c.rotuloNivel, b.x + b.w - 15, b.y + 16, {
          tamanho: 11, alinha: 'center', cor: CORES.destaqueEscuro,
        });
      }
      texto(ctx, String(c.custo), b.x + b.w / 2, b.y + b.h - 5, {
        tamanho: 18, alinha: 'center', cor: barato ? CORES.destaqueEscuro : CORES.perigo,
      });

      if (recarga > 0) {
        const frac = recarga / c.recarga;
        ctx.save();
        ctx.fillStyle = 'rgba(43, 38, 34, 0.45)';
        ctx.fillRect(b.x + 2, b.y + 2, b.w - 4, (b.h - 4) * frac);
        ctx.restore();
      }
    });

    // progresso das ondas, embaixo do contador de sementes
    const ondas = fase.ondas.length;
    texto(ctx, `FASE ${fase.n}`, 20, HUD_H - 12, { tamanho: 12, cor: '#d9bd8a' });
    const larguraOnda = Math.min(22, (150 - 12) / ondas - 4);
    for (let i = 0; i < ondas; i++) {
      const cheio = i <= est.ondaAtual;
      const ultima = i === ondas - 1;
      caixa(ctx, 74 + i * (larguraOnda + 4), HUD_H - 22, larguraOnda, 12, 4, {
        cor: '#3f2a14', largura: 1.6,
        preenche: cheio ? (ultima ? '#a8407a' : CORES.perigo) : 'rgba(63, 42, 20, 0.4)',
        semente: 200 + i,
      });
    }

    // pá — alvo grande, encostado no canto, onde o polegar alcança
    const pw = 84;
    caixa(ctx, vp.L - pw - 14, 10, pw, HUD_H - 22, 10, {
      cor: est.pa ? CORES.perigo : '#3f2a14', largura: est.pa ? 4.5 : 2.4, preenche: est.pa ? '#f2c0b4' : '#fbf5e6', semente: 300,
    });
    texto(ctx, '⛏', vp.L - pw / 2 - 14, HUD_H / 2 + 4, { tamanho: 34, alinha: 'center', cor: TINTA });
    texto(ctx, 'tirar', vp.L - pw / 2 - 14, HUD_H - 16, { tamanho: 11, alinha: 'center', cor: TINTA_FRACA });
  }

  function desenharAviso(ctx) {
    if (!est.aviso) return;
    const alfaAviso = Math.min(1, est.aviso.t);
    const linhas = quebrarTexto(ctx, est.aviso.texto, 760, 21);
    const h = 30 + linhas.length * 28;
    const y = CAMPO_Y + 30;
    ctx.save();
    ctx.globalAlpha = alfaAviso;
    caixa(ctx, vp.L / 2 - 410, y, 820, h, 14, { cor: TINTA, largura: 3, preenche: 'rgba(251, 245, 230, 0.95)', semente: 400 });
    linhas.forEach((ln, i) => {
      texto(ctx, ln, vp.L / 2, y + 34 + i * 28, { tamanho: 21, alinha: 'center', cor: TINTA });
    });
    ctx.restore();
  }

  function desenharFim(ctx) {
    if (!est.terminou) return;
    const t = Math.min(1, (est.tempo - est.fimEm) * 2);
    ctx.fillStyle = `rgba(20, 17, 14, ${0.7 * t})`;
    ctx.fillRect(0, 0, vp.L, ALTURA);
    texto(ctx, est.venceu ? 'FASE VENCIDA' : 'ELES PASSARAM', vp.L / 2, ALTURA / 2 - 10, {
      tamanho: 64, alinha: 'center', cor: est.venceu ? '#8fd48f' : '#e08a7a', contorno: TINTA, larguraContorno: 8, alfa: t,
    });
    texto(ctx, est.venceu ? `${est.mortos} monstros derrubados` : 'a cerca não segurou', vp.L / 2, ALTURA / 2 + 40, {
      tamanho: 24, alinha: 'center', cor: PAPEL, alfa: t,
    });
    if (est.venceu) {
      texto(ctx, `${est.ganhoMortes} sementes vieram deles · ${est.ganhoColeta} do chão`, vp.L / 2, ALTURA / 2 + 76, {
        tamanho: 18, alinha: 'center', cor: CORES.semente, alfa: t,
      });
    }
  }

  function desenhar(ctx) {
    ctx.save();
    if (est.abalo > 0) {
      ctx.translate((Math.random() - 0.5) * est.abalo * 14, (Math.random() - 0.5) * est.abalo * 14);
    }
    desenharCampo(ctx);
    desenharPlantados(ctx);
    desenharMonstros(ctx);
    desenharProjeteis(ctx);
    // as sementes vêm depois dos bichos: atrás deles, ninguém as via para clicar
    desenharColetaveis(ctx);
    desenharClima(ctx);
    desenharParticulas(ctx);
    desenharMira(ctx);
    ctx.restore();
    desenharHud(ctx);
    desenharAviso(ctx);
    desenharFim(ctx);
  }

  function cancelar() {
    est.arrastando = false;
  }

  tocarMusica(fase.chefe ? 0.8 : 0.3);

  return { atualizar, desenhar, pressionar, soltar, mover, cancelar, redimensionar, est };
}
