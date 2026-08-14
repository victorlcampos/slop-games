// The opening short, in six scenes.
//
// The script exists to justify the mechanic: the monsters are each people's
// legends, the humans freeze with fear because they grew up hearing those
// stories, and the animals are immune because nobody ever told them anything.
// Hence a campaign country by country, with the local folklore as the enemy.

import { createCutscene as filmProjector } from 'slopkit/cutscene';
import { shape, circle, stroke, box, text, wrapText, ellipsePoints, putSprite, rng } from '../scribble.js';
import { INK, COLORS, PAPER, shade, withAlpha } from '../palette.js';
import { animalSprite } from '../draw/animals.js';
import { monsterSprite } from '../draw/monsters.js';
import { cachedMap, project, COUNTRIES } from '../draw/worldmap.js';
import { vp, HEIGHT, applyFrame, menuWidth } from '../viewport.js';
import { sfx } from '../audio.js';
import { i18n, pick } from '../i18n.js';

// Width of the board the scenes were composed on. Updated every frame by
// `draw`, because the scenes are module-level objects and can't see the scope
// of createCutscene.
let MENU_W = 1280;

/** A still human silhouette — the image of fear that paralyses. */
function human(ctx, x, yBase, height, color, s) {
  const k = height / 100;
  circle(ctx, x, yBase - 84 * k, 11 * k, { color: null, fill: color, seed: s });
  shape(
    ctx,
    [[x - 12 * k, yBase - 72 * k], [x + 12 * k, yBase - 72 * k], [x + 10 * k, yBase - 34 * k], [x - 10 * k, yBase - 34 * k]],
    { color: null, fill: color, seed: s + 1 }
  );
  stroke(ctx, [[x - 7 * k, yBase - 34 * k], [x - 8 * k, yBase]], { color, width: 7 * k, passes: 1, seed: s + 2 });
  stroke(ctx, [[x + 7 * k, yBase - 34 * k], [x + 8 * k, yBase]], { color, width: 7 * k, passes: 1, seed: s + 3 });
  stroke(ctx, [[x - 12 * k, yBase - 68 * k], [x - 20 * k, yBase - 42 * k]], { color, width: 6 * k, passes: 1, seed: s + 4 });
  stroke(ctx, [[x + 12 * k, yBase - 68 * k], [x + 20 * k, yBase - 42 * k]], { color, width: 6 * k, passes: 1, seed: s + 5 });
}

function simpleHills(ctx, w, yBase, color, s, height, n = 5) {
  const r = rng(s);
  for (let i = 0; i < n; i++) {
    const cx = (i / (n - 1)) * w + (r() - 0.5) * 100;
    shape(ctx, ellipsePoints(cx, yBase, 170 + r() * 130, height * (0.6 + r() * 0.7), 12), {
      color: shade(color, -0.3), width: 2.4, fill: color, seed: s + i * 13,
    });
  }
}

function treeSilhouette(ctx, x, yBase, height, color, s) {
  stroke(ctx, [[x, yBase], [x, yBase - height * 0.55]], { color, width: height * 0.09, passes: 1, seed: s });
  const r = rng(s + 5);
  for (let i = 0; i < 4; i++) {
    circle(ctx, x + (r() - 0.5) * height * 0.4, yBase - height * (0.62 + r() * 0.3), height * (0.2 + r() * 0.14), {
      color: null, fill: color, seed: s + i * 9,
    });
  }
}

// ------------------------------------------------------------------- scenes

const SCENES = [
  {
    duration: 8,
    line: {
      pt: 'Durante muito tempo, o mundo foi um lugar comum. As pessoas contavam histórias para assustar as crianças, e as crianças cresciam sabendo que eram só histórias.',
      en: 'For a long time, the world was an ordinary place. People told stories to frighten children, and the children grew up knowing they were only stories.',
    },
    draw(ctx, w, t) {
      // dawn in the forest
      const g = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      g.addColorStop(0, '#f2c27a');
      g.addColorStop(0.45, '#f7dfae');
      g.addColorStop(1, '#cfd9a0');
      ctx.fillStyle = g;
      ctx.fillRect(-vp.W, -HEIGHT, vp.W * 3, HEIGHT * 3);

      const sunY = 300 - t * 40;
      circle(ctx, MENU_W * 0.72, sunY, 62, { color: '#e8a54c', width: 3, fill: '#f7e2a0', seed: 3 });

      simpleHills(ctx, vp.W, 470, '#8fa862', 11, 90, 4);
      simpleHills(ctx, vp.W, 520, '#6f8f4c', 23, 80, 5);
      ctx.fillStyle = '#7d9a54';
      ctx.fillRect(-vp.W, 500, vp.W * 3, HEIGHT - 500 + HEIGHT);

      for (let i = 0; i < 6; i++) treeSilhouette(ctx, 60 + i * 230, 540, 190, '#4f7a3a', 40 + i * 17);

      // animals grazing, at peace
      ['squirrel', 'monkey', 'turtle', 'jaguar'].forEach((id, i) => {
        const x = 190 + i * 290;
        const y = 620 + Math.sin(t * 1.5 + i) * 3;
        putSprite(ctx, animalSprite(id, 128), x, y, 0.8);
      });

      // birds in the distance
      for (let i = 0; i < 5; i++) {
        const bx = ((t * 30 + i * 120) % (MENU_W + 100)) - 50;
        const by = 150 + i * 26 + Math.sin(t * 2 + i) * 8;
        stroke(ctx, [[bx - 10, by], [bx, by - 5], [bx + 10, by]], {
          color: withAlpha(INK, 0.5), width: 2, passes: 1, seed: 90 + i,
        });
      }
    },
  },

  {
    duration: 7,
    line: {
      pt: 'Até a noite em que elas se cansaram de ser só histórias.',
      en: 'Until the night they got tired of being only stories.',
    },
    draw(ctx, w, t) {
      const g = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      g.addColorStop(0, '#1a1730');
      g.addColorStop(0.6, '#39294a');
      g.addColorStop(1, '#4a3140');
      ctx.fillStyle = g;
      ctx.fillRect(-vp.W, -HEIGHT, vp.W * 3, HEIGHT * 3);

      const r = rng(7);
      for (let i = 0; i < 70; i++) {
        circle(ctx, r() * vp.W, r() * 420, r() * 1.8 + 0.6, {
          color: null, fill: withAlpha('#f2ead0', 0.5), seed: 100 + i,
        });
      }

      // the rift in the sky: it opens over time
      const opening = Math.min(1, t / 3.5);
      const cx = MENU_W / 2;
      const points = [];
      const n = 14;
      for (let i = 0; i <= n; i++) {
        const p = i / n;
        const y = 40 + p * 320;
        const w = Math.sin(p * Math.PI) * 90 * opening;
        points.push([cx + w + Math.sin(p * 9) * 14, y]);
      }
      for (let i = n; i >= 0; i--) {
        const p = i / n;
        const y = 40 + p * 320;
        const w = Math.sin(p * Math.PI) * 90 * opening;
        points.push([cx - w + Math.sin(p * 9) * 14, y]);
      }
      shape(ctx, points, { color: '#e8703a', width: 4, fill: '#f7d451', seed: 5, alpha: 0.95 });
      shape(ctx, points.map(([x, y]) => [cx + (x - cx) * 0.5, y]), { color: null, fill: '#fff6d0', seed: 6, alpha: 0.9 });

      // light spilling onto the ground
      const glow = ctx.createRadialGradient(cx, 360, 20, cx, 460, 460);
      glow.addColorStop(0, `rgba(247, 212, 81, ${0.4 * opening})`);
      glow.addColorStop(1, 'rgba(247, 212, 81, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(-vp.W, 120, vp.W * 3, HEIGHT - 120 + HEIGHT);

      ctx.fillStyle = '#241f2e';
      ctx.fillRect(-vp.W, 560, vp.W * 3, HEIGHT - 560 + HEIGHT);
      for (let i = 0; i < 6; i++) treeSilhouette(ctx, 40 + i * 250, 590, 170, '#151222', 60 + i * 11);

      // the legends rising out of the earth
      const rising = Math.max(0, (t - 2.5) / 4);
      ['corposeco', 'saci', 'curupira', 'mula', 'lobisomem'].forEach((id, i) => {
        const up = Math.min(1, rising * (1 + i * 0.2));
        if (up <= 0) return;
        const x = 150 + i * 250;
        const y = 700 - up * 110;
        ctx.save();
        ctx.globalAlpha = Math.min(1, up * 1.6);
        putSprite(ctx, monsterSprite(id, 128), x, y, 0.9);
        ctx.restore();
      });
    },
  },

  {
    duration: 9,
    line: {
      pt: 'Não foi uma guerra. Foi mais rápido que isso. Quem cresceu ouvindo o nome daquilo travava na hora de correr — e ficava ali, de olhos abertos, sem conseguir mexer um dedo.',
      en: "It wasn't a war. It was faster than that. Anyone who grew up hearing the name froze at the moment of running — and stood there, eyes open, unable to move a finger.",
    },
    draw(ctx, w, t) {
      const g = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      g.addColorStop(0, '#5b4a52');
      g.addColorStop(1, '#8a7566');
      ctx.fillStyle = g;
      ctx.fillRect(-vp.W, -HEIGHT, vp.W * 3, HEIGHT * 3);

      // city
      let x = -20;
      let i = 0;
      while (x < vp.W) {
        const bw = 80 + ((i * 37) % 70);
        const bh = 180 + ((i * 53) % 190);
        shape(ctx, [[x, 520], [x, 520 - bh], [x + bw, 520 - bh], [x + bw, 520]], {
          color: INK, width: 2.6, fill: ['#6f6a66', '#7d7671', '#615c58'][i % 3], seed: 200 + i,
        });
        x += bw + 8;
        i++;
      }
      ctx.fillStyle = '#575350';
      ctx.fillRect(-vp.W, 500, vp.W * 3, HEIGHT - 500 + HEIGHT);

      // paralysed humans, genuinely motionless — no swaying here
      [180, 330, 520, 760, 940, 1120].forEach((px, j) => {
        human(ctx, px, 640 + (j % 3) * 18, 120, '#3f3a38', 300 + j * 7);
        // wide-open eyes: two pale dots
        const k = 1.2;
        circle(ctx, px - 4 * k, 640 + (j % 3) * 18 - 86 * 1.2, 2.2, { color: null, fill: '#f2ead0', seed: 320 + j });
        circle(ctx, px + 4 * k, 640 + (j % 3) * 18 - 86 * 1.2, 2.2, { color: null, fill: '#f2ead0', seed: 321 + j });
      });

      // monsters walking among them
      const walk = t * 26;
      ['iara', 'bichopapao', 'mapinguari'].forEach((id, j) => {
        const mx = ((walk + j * 430) % (MENU_W + 260)) - 130;
        putSprite(ctx, monsterSprite(id, 128), mx, 600 + j * 30, 1.05);
      });

      // the world losing its colour
      ctx.fillStyle = `rgba(30, 26, 34, ${Math.min(0.45, t * 0.06)})`;
      ctx.fillRect(-vp.W, -HEIGHT, vp.W * 3, HEIGHT * 3);
    },
  },

  {
    duration: 8,
    line: {
      pt: 'Em três dias, cada país estava tomado pelos seus próprios monstros. Cada povo, preso exatamente por aquilo que ele mesmo inventou.',
      en: 'In three days, every country was held by its own monsters. Every people trapped by exactly what they themselves invented.',
    },
    draw(ctx, w, t) {
      ctx.fillStyle = '#1e2230';
      ctx.fillRect(-vp.W, -HEIGHT, vp.W * 3, HEIGHT * 3);

      const mw = 1080;
      const mh = 540;
      const mx = (MENU_W - mw) / 2;
      const my = 90;
      ctx.drawImage(cachedMap(mw, mh, { taken: false, seaColor: '#33465c' }), mx, my);

      // the stains taking the world, one by one
      COUNTRIES.forEach((c, i) => {
        const when = 0.6 + i * 0.85;
        if (t < when) return;
        const age = Math.min(1, (t - when) / 1.2);
        const [px, py] = project(c.lon, c.lat, mx, my, mw, mh);
        const radius = 26 + age * 70;
        const g = ctx.createRadialGradient(px, py, 4, px, py, radius);
        g.addColorStop(0, `rgba(120, 40, 70, ${0.75 * age})`);
        g.addColorStop(1, 'rgba(120, 40, 70, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();
        circle(ctx, px, py, 7, { color: '#f2c94c', width: 2, fill: '#c1503f', seed: 500 + i, alpha: age });
      });

      // an overall veil at the end of the scene
      const veil = Math.max(0, (t - 5.5) / 2.5);
      ctx.fillStyle = `rgba(90, 24, 52, ${veil * 0.45})`;
      ctx.fillRect(-vp.W, -HEIGHT, vp.W * 3, HEIGHT * 3);
    },
  },

  {
    duration: 10,
    line: {
      pt: 'Mas ninguém nunca contou essas histórias para os bichos. Um tatu não sabe o que é uma Cuca. Uma abelha nunca ouviu falar de lobisomem. E não dá para paralisar de medo quem nunca aprendeu a ter.',
      en: "But nobody ever told those stories to the animals. An armadillo doesn't know what a Cuca is. A bee has never heard of a werewolf. And you cannot freeze with fear someone who never learned to have any.",
    },
    draw(ctx, w, t) {
      ctx.fillStyle = '#10131a';
      ctx.fillRect(-vp.W, -HEIGHT, vp.W * 3, HEIGHT * 3);

      // dark forest
      for (let layer = 0; layer < 3; layer++) {
        const color = ['#151a20', '#1a2028', '#202832'][layer];
        for (let i = 0; i < 8 - layer; i++) {
          treeSilhouette(ctx, 20 + i * (MENU_W / (7 - layer)) + layer * 50, 560 + layer * 40, 260 - layer * 40, color, 600 + layer * 20 + i);
        }
      }

      // at first only the eyes, in the dark
      const pairs = [
        [190, 470], [340, 520], [520, 460], [700, 510], [880, 470], [1060, 520], [430, 580], [790, 590],
      ];
      const glow = Math.min(1, t / 2.2);
      const reveal = Math.max(0, (t - 4) / 3);
      pairs.forEach(([px, py], i) => {
        const blink = Math.sin(t * 3 + i * 2) > -0.85 ? 1 : 0.1;
        ctx.save();
        ctx.globalAlpha = glow * blink * (1 - reveal);
        circle(ctx, px - 9, py, 5, { color: null, fill: '#f2c94c', seed: 700 + i });
        circle(ctx, px + 9, py, 5, { color: null, fill: '#f2c94c', seed: 710 + i });
        ctx.restore();
      });

      // and then they step out of the forest
      if (reveal > 0) {
        ['lion', 'elephant', 'eagle', 'polarbear', 'kangaroo', 'alligator', 'owl', 'bee'].forEach((id, i) => {
          const [px, py] = pairs[i];
          ctx.save();
          ctx.globalAlpha = Math.min(1, reveal * 1.4);
          putSprite(ctx, animalSprite(id, 128), px, py + 40 - reveal * 8, 0.85);
          ctx.restore();
        });
        const light = ctx.createRadialGradient(MENU_W / 2, 480, 40, MENU_W / 2, 480, 620);
        light.addColorStop(0, `rgba(242, 201, 76, ${0.14 * reveal})`);
        light.addColorStop(1, 'rgba(242, 201, 76, 0)');
        ctx.fillStyle = light;
        ctx.fillRect(-vp.W, -HEIGHT, vp.W * 3, HEIGHT * 3);
      }
    },
  },

  {
    duration: 9,
    line: {
      pt: 'Eles vieram de toda parte. E escolheram começar por aqui.',
      en: 'They came from everywhere. And they chose to start here.',
    },
    title: true,
    draw(ctx, w, t) {
      const g = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      g.addColorStop(0, '#2d3a52');
      g.addColorStop(0.5, '#c98f5a');
      g.addColorStop(1, '#e8c58a');
      ctx.fillStyle = g;
      ctx.fillRect(-vp.W, -HEIGHT, vp.W * 3, HEIGHT * 3);

      circle(ctx, MENU_W * 0.5, 430, 90, { color: '#e8a54c', width: 3, fill: '#f7e2a0', seed: 800, alpha: 0.9 });
      simpleHills(ctx, vp.W, 520, '#8a6a4a', 810, 70, 4);
      ctx.fillStyle = '#7a5c40';
      ctx.fillRect(-vp.W, 500, vp.W * 3, HEIGHT - 500 + HEIGHT);

      // the squad, backs turned, looking at the horizon
      ['elephant', 'lion', 'jaguar', 'polarbear', 'kangaroo', 'eagle', 'monkey', 'turtle', 'owl'].forEach((id, i) => {
        const x = 110 + i * 132;
        const y = 600 + (i % 2) * 26;
        const enter = Math.min(1, Math.max(0, (t - 0.3 - i * 0.16) / 0.7));
        if (enter <= 0) return;
        ctx.save();
        ctx.globalAlpha = enter;
        // backs turned = mirrored, looking into the frame
        putSprite(ctx, animalSprite(id, 128), x, y + (1 - enter) * 40, 0.78, true);
        ctx.restore();
      });

      // the title
      const tt = Math.max(0, Math.min(1, (t - 3.5) / 1.4));
      if (tt > 0) {
        ctx.save();
        ctx.globalAlpha = tt;
        text(ctx, pick(TITLE.animals), MENU_W / 2, 190 - (1 - tt) * 20, {
          size: 84, align: 'center', color: '#f7e9c8', outline: INK, outlineWidth: 10,
        });
        text(ctx, pick(TITLE.vs), MENU_W / 2, 240, {
          size: 34, align: 'center', color: '#f2c94c', outline: INK, outlineWidth: 6,
        });
        text(ctx, pick(TITLE.monsters), MENU_W / 2, 320, {
          size: 84, align: 'center', color: '#e8a08a', outline: INK, outlineWidth: 10,
        });
        ctx.restore();
      }
      const st = Math.max(0, Math.min(1, (t - 5.5) / 1.2));
      if (st > 0) {
        text(ctx, pick(TITLE.tagline), MENU_W / 2, 380, {
          size: 27, align: 'center', color: PAPER, outline: INK, outlineWidth: 5, alpha: st,
        });
      }
    },
  },
];

const TITLE = {
  animals: { pt: 'ANIMAIS', en: 'ANIMALS' },
  vs: { pt: 'vs', en: 'vs' },
  monsters: { pt: 'MONSTROS', en: 'MONSTERS' },
  tagline: {
    pt: '🇧🇷  A resistência começa no Brasil',
    en: '🇧🇷  The resistance starts in Brazil',
  },
};

// ------------------------------------------- the Brazil → Japan interlude
//
// Plays once, when the Cuca falls and the Brazil campaign closes: why the
// squad leaves a freed country, and what is waiting on the other side.

const JAPAN_TITLE = {
  country: { pt: 'JAPÃO', en: 'JAPAN' },
  campaign: { pt: 'CAMPANHA 2', en: 'CAMPAIGN 2' },
  tagline: {
    pt: '🇯🇵  Nenhuma lenda assusta quem nunca a escutou',
    en: '🇯🇵  No legend can scare someone who never heard it',
  },
};

/** A person mid-celebration: arms up — the opposite of the frozen pose. */
function wakingHuman(ctx, x, yBase, height, color, s, wave = 0) {
  const k = height / 100;
  circle(ctx, x, yBase - 84 * k, 11 * k, { color: null, fill: color, seed: s });
  shape(
    ctx,
    [[x - 12 * k, yBase - 72 * k], [x + 12 * k, yBase - 72 * k], [x + 10 * k, yBase - 34 * k], [x - 10 * k, yBase - 34 * k]],
    { color: null, fill: color, seed: s + 1 }
  );
  stroke(ctx, [[x - 7 * k, yBase - 34 * k], [x - 8 * k, yBase]], { color, width: 7 * k, passes: 1, seed: s + 2 });
  stroke(ctx, [[x + 7 * k, yBase - 34 * k], [x + 8 * k, yBase]], { color, width: 7 * k, passes: 1, seed: s + 3 });
  // arms thrown up, swaying with the cheer
  stroke(ctx, [[x - 12 * k, yBase - 66 * k], [x - 22 * k, yBase - 88 * k - wave * 4]], { color, width: 6 * k, passes: 1, seed: s + 4 });
  stroke(ctx, [[x + 12 * k, yBase - 66 * k], [x + 22 * k, yBase - 90 * k + wave * 4]], { color, width: 6 * k, passes: 1, seed: s + 5 });
}

const JAPAN_SCENES = [
  {
    duration: 8,
    line: {
      pt: 'A Cuca caiu — e o medo caiu junto. Cidade por cidade, as pessoas descongelaram, olharam em volta e viram quem tinha segurado a linha: os bichos.',
      en: 'The Cuca fell — and the fear fell with her. City by city, people thawed, looked around and saw who had held the line: the animals.',
    },
    draw(ctx, w, t) {
      // morning over Rio: the country breathing again
      const g = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      g.addColorStop(0, '#8fc4e8');
      g.addColorStop(0.55, '#cfe4d8');
      g.addColorStop(1, '#a8c47a');
      ctx.fillStyle = g;
      ctx.fillRect(-vp.W, -HEIGHT, vp.W * 3, HEIGHT * 3);

      circle(ctx, MENU_W * 0.8, 130, 52, { color: '#e8a54c', width: 3, fill: '#f7e2a0', seed: 3 });
      simpleHills(ctx, vp.W, 470, '#6f9b52', 11, 110, 4);
      // Corcovado with its small figure on top, arms open
      shape(ctx, [[MENU_W * 0.16, 470], [MENU_W * 0.21, 320], [MENU_W * 0.26, 470]], {
        color: '#4f7a3a', width: 2.6, fill: '#5d8a44', seed: 21,
      });
      stroke(ctx, [[MENU_W * 0.21, 320], [MENU_W * 0.21, 296]], { color: '#e8e4d4', width: 6, passes: 1, seed: 22 });
      stroke(ctx, [[MENU_W * 0.21 - 16, 306], [MENU_W * 0.21 + 16, 306]], { color: '#e8e4d4', width: 5, passes: 1, seed: 23 });

      ctx.fillStyle = '#9bb35c';
      ctx.fillRect(-vp.W, 500, vp.W * 3, HEIGHT - 500 + HEIGHT);

      // people awake, arms up, swaying — and the animals among them
      [180, 350, 610, 800, 1010, 1150].forEach((px, j) => {
        wakingHuman(ctx, px, 640 + (j % 3) * 16, 115, '#5b4a45', 300 + j * 7, Math.sin(t * 3 + j));
      });
      ['jaguar', 'monkey', 'turtle', 'owl'].forEach((id, i) => {
        putSprite(ctx, animalSprite(id, 128), 270 + i * 240, 660 + Math.sin(t * 1.6 + i) * 3, 0.8);
      });

      // confetti drifting down over everything
      const r = rng(50);
      for (let i = 0; i < 40; i++) {
        const cx = r() * MENU_W;
        const speed = 30 + r() * 40;
        const cy = ((r() * 700 + t * speed) % (HEIGHT + 40)) - 20;
        ctx.fillStyle = ['#e0913a', '#5d9e5e', '#f2c94c', '#c1636f'][i % 4];
        ctx.fillRect(cx, cy, 5, 7);
      }
    },
  },

  {
    duration: 9,
    line: {
      pt: 'Na primeira noite livre, um rádio velho atravessou a estática: "Aqui é o Japão. Se alguém estiver ouvindo… as nossas histórias também acordaram. E aqui, todo mundo cresceu ouvindo."',
      en: 'On the first free night, an old radio cut through the static: "This is Japan. If anyone is listening… our stories woke up too. And here, everyone grew up listening."',
    },
    draw(ctx, w, t) {
      // a dark room, one table, one radio — the whole scene leans in
      ctx.fillStyle = '#161219';
      ctx.fillRect(-vp.W, -HEIGHT, vp.W * 3, HEIGHT * 3);

      // moonlight through a window
      shape(ctx, [[MENU_W * 0.74, 60], [MENU_W * 0.9, 60], [MENU_W * 0.9, 240], [MENU_W * 0.74, 240]], {
        color: '#3d3a4a', width: 3, fill: '#2a2c44', seed: 5,
      });
      circle(ctx, MENU_W * 0.83, 130, 26, { color: null, fill: '#e8e0c4', seed: 6 });
      line(ctx, MENU_W * 0.82, 60, MENU_W * 0.82, 240, { color: '#3d3a4a', width: 3, seed: 7 });
      line(ctx, MENU_W * 0.74, 150, MENU_W * 0.9, 150, { color: '#3d3a4a', width: 3, seed: 8 });

      // the table and the radio
      shape(ctx, [[MENU_W * 0.3, 520], [MENU_W * 0.7, 520], [MENU_W * 0.68, 700], [MENU_W * 0.32, 700]], {
        color: '#2b2118', width: 3, fill: '#4a3828', seed: 10,
      });
      const rx = MENU_W * 0.5;
      shape(ctx, [[rx - 110, 520], [rx + 110, 520], [rx + 100, 380], [rx - 100, 380]], {
        color: '#1c1410', width: 3.4, fill: '#6b4a2f', seed: 11,
      });
      shape(ctx, [[rx - 80, 410], [rx - 10, 410], [rx - 10, 490], [rx - 80, 490]], {
        color: '#1c1410', width: 2.4, fill: '#c9a165', seed: 12,
      });
      for (let i = 0; i < 5; i++) {
        line(ctx, rx - 76 + i * 15, 414, rx - 76 + i * 15, 486, { color: '#8a6a3d', width: 2, passes: 1, seed: 13 + i });
      }
      circle(ctx, rx + 50, 450, 26, { color: '#1c1410', width: 2.6, fill: '#e8dcc4', seed: 20 });
      const needle = Math.sin(t * 2.4) * 0.5;
      line(ctx, rx + 50, 450, rx + 50 + Math.cos(-1.2 + needle) * 20, 450 + Math.sin(-1.2 + needle) * 20, {
        color: '#c1503f', width: 2.4, seed: 21,
      });
      line(ctx, rx + 96, 380, rx + 130, 300, { color: '#8a8478', width: 3, seed: 22 });
      circle(ctx, rx + 131, 298, 4, { color: null, fill: '#8a8478', seed: 23 });

      // the voice, drawn: rings leaving the radio
      for (let i = 0; i < 4; i++) {
        const age = (t * 0.9 + i * 0.28) % 1.1;
        circle(ctx, rx, 440, 30 + age * 260, {
          color: '#9fd4e6', width: 2.4, alpha: Math.max(0, 0.55 - age * 0.5), seed: 30 + i,
        });
      }

      // the squad listening in silhouette, lit by the dial
      ['owl', 'jaguar', 'elephant', 'monkey'].forEach((id, i) => {
        const px = MENU_W * (0.14 + i * 0.055);
        ctx.save();
        ctx.globalAlpha = 0.85;
        putSprite(ctx, animalSprite(id, 128), px, 640 - i * 8, 0.72, true, 0.9);
        ctx.restore();
      });
      const glow = ctx.createRadialGradient(rx, 460, 20, rx, 460, 380);
      glow.addColorStop(0, 'rgba(242, 201, 76, 0.16)');
      glow.addColorStop(1, 'rgba(242, 201, 76, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(-vp.W, -HEIGHT, vp.W * 3, HEIGHT * 3);
    },
  },

  {
    duration: 9,
    line: {
      pt: 'Bicho não entende de fronteira, mas entende de socorro. No porto de Santos, o esquadrão embarcou no primeiro navio que ainda lembrava o caminho.',
      en: 'Animals do not understand borders, but they understand a call for help. At the port of Santos, the squad boarded the first ship that still remembered the way.',
    },
    draw(ctx, w, t) {
      ctx.fillStyle = '#1e2230';
      ctx.fillRect(-vp.W, -HEIGHT, vp.W * 3, HEIGHT * 3);

      const mw = 1080;
      const mh = 540;
      const mx = (MENU_W - mw) / 2;
      const my = 90;
      ctx.drawImage(cachedMap(mw, mh, { taken: false, seaColor: '#33465c' }), mx, my);

      // Brazil breathes green now; Japan pulses red, asking
      const [bx, by] = project(-51, -12, mx, my, mw, mh);
      circle(ctx, bx, by, 12, { color: '#2b4a2c', width: 2.4, fill: '#5d9e5e', seed: 40 });
      const [jx, jy] = project(138, 36, mx, my, mw, mh);
      const pulse = 1 + Math.sin(t * 4) * 0.25;
      circle(ctx, jx, jy, 12 * pulse, { color: '#f2c94c', width: 2.4, fill: '#c1503f', seed: 41 });
      circle(ctx, jx, jy, 24 * pulse, { color: '#c1503f', width: 2, alpha: 0.5, seed: 42 });

      // the route east, around the Cape and across the Indian Ocean
      const route = [[-51, -12], [-20, -30], [22, -38], [75, -12], [105, 8], [128, 24], [138, 36]]
        .map(([lon, lat]) => project(lon, lat, mx, my, mw, mh));
      const progress = Math.min(1, t / 7);
      const total = route.length - 1;
      for (let i = 0; i < total; i++) {
        for (let k = 0; k < 5; k++) {
          const f = (i + k / 5) / total;
          if (f > progress) break;
          const px = route[i][0] + (route[i + 1][0] - route[i][0]) * (k / 5);
          const py = route[i][1] + (route[i + 1][1] - route[i][1]) * (k / 5);
          circle(ctx, px, py, 3, { color: null, fill: '#f2ead0', seed: 60 + i * 5 + k, alpha: 0.8 });
        }
      }
      // the ship at the head of the dotted line
      const seg = Math.min(total - 0.001, progress * total);
      const si = Math.floor(seg);
      const sf = seg - si;
      const sx = route[si][0] + (route[si + 1][0] - route[si][0]) * sf;
      const sy = route[si][1] + (route[si + 1][1] - route[si][1]) * sf + Math.sin(t * 3) * 2;
      shape(ctx, [[sx - 16, sy], [sx + 16, sy], [sx + 10, sy + 9], [sx - 10, sy + 9]], {
        color: '#1c1410', width: 2, fill: '#6b4a2f', seed: 70,
      });
      line(ctx, sx, sy, sx, sy - 14, { color: '#1c1410', width: 2.4, seed: 71 });
      shape(ctx, [[sx, sy - 14], [sx + 12, sy - 10], [sx, sy - 5]], { color: null, fill: '#e8dcc4', seed: 72 });
      for (let i = 0; i < 3; i++) {
        circle(ctx, sx - 12 - i * 8, sy - 12 - i * 5, 2.5 + i, {
          color: null, fill: `rgba(220, 226, 232, ${0.6 - i * 0.15})`, seed: 80 + i,
        });
      }
    },
  },

  {
    duration: 9,
    line: {
      pt: 'Do outro lado do mundo, as lendas têm outro nome: yōkai. Mil anos de histórias contadas em voz baixa — e cada uma delas, agora, dona de uma rua.',
      en: 'On the other side of the world, the legends have another name: yōkai. A thousand years of stories told in a low voice — and every one of them now owns a street.',
    },
    draw(ctx, w, t) {
      const g = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      g.addColorStop(0, '#141224');
      g.addColorStop(0.6, '#2c2440');
      g.addColorStop(1, '#3d2c44');
      ctx.fillStyle = g;
      ctx.fillRect(-vp.W, -HEIGHT, vp.W * 3, HEIGHT * 3);

      const r = rng(7);
      for (let i = 0; i < 60; i++) {
        circle(ctx, r() * vp.W, r() * 400, r() * 1.6 + 0.5, {
          color: null, fill: withAlpha('#f2ead0', 0.5), seed: 100 + i,
        });
      }
      circle(ctx, MENU_W * 0.14, 120, 34, { color: '#d9cfa8', width: 2.2, fill: '#f2ead0', seed: 4 });

      // the great torii, and the mountain behind it
      shape(ctx, [[MENU_W * 0.55, 560], [MENU_W * 0.7, 380], [MENU_W * 0.88, 560]], {
        color: '#241d38', width: 2.6, fill: '#302846', seed: 8,
      });
      const tx = MENU_W * 0.32;
      const th = 300;
      const ty = 580;
      for (const side of [-1, 1]) {
        stroke(ctx, [[tx + side * th * 0.32, ty], [tx + side * th * 0.36, ty - th]], { color: '#a8402f', width: 16, seed: 10 + side });
      }
      shape(ctx, [[tx - th * 0.52, ty - th], [tx + th * 0.52, ty - th], [tx + th * 0.56, ty - th - 26], [tx - th * 0.56, ty - th - 26]], {
        color: '#7a2f22', width: 3, fill: '#c1503f', seed: 13,
      });
      line(ctx, tx - th * 0.4, ty - th * 0.72, tx + th * 0.4, ty - th * 0.72, { color: '#a8402f', width: 10, seed: 14 });

      // paper lanterns down the street, lighting as the scene ages
      for (let i = 0; i < 5; i++) {
        const lx = 140 + i * (MENU_W / 5.2);
        const lit = t > 0.8 + i * 0.5;
        line(ctx, lx, 470, lx, 500, { color: '#3d3a4a', width: 2.4, seed: 200 + i });
        shape(ctx, ellipsePoints(lx, 522, 16, 22, 12), {
          color: '#2b2438', width: 2.2, fill: lit ? '#f2c94c' : '#4a4054', seed: 210 + i,
        });
        if (lit) {
          const halo = ctx.createRadialGradient(lx, 522, 4, lx, 522, 60);
          halo.addColorStop(0, 'rgba(242, 201, 76, 0.3)');
          halo.addColorStop(1, 'rgba(242, 201, 76, 0)');
          ctx.fillStyle = halo;
          ctx.fillRect(lx - 60, 462, 120, 120);
        }
      }

      ctx.fillStyle = '#1c1826';
      ctx.fillRect(-vp.W, 580, vp.W * 3, HEIGHT - 580 + HEIGHT);

      // and the yōkai step into the lantern light
      const rising = Math.max(0, (t - 2.2) / 4);
      ['karakasa', 'kappa', 'kitsune', 'yukionna', 'oni'].forEach((id, i) => {
        const up = Math.min(1, rising * (1 + i * 0.2));
        if (up <= 0) return;
        const x = 170 + i * 240;
        const y = 700 - up * 90;
        ctx.save();
        ctx.globalAlpha = Math.min(1, up * 1.6);
        putSprite(ctx, monsterSprite(id, 128), x, y, 0.92);
        ctx.restore();
      });
    },
  },

  {
    duration: 10,
    line: {
      pt: 'No cais, debaixo das cerejeiras, a resistência local esperava: um tanuki, um macaco de águas termais, um grou e uma carpa teimosa. Nenhum deles tinha medo de história nenhuma.',
      en: 'At the dock, under the cherry trees, the local resistance was waiting: a tanuki, a hot-spring monkey, a crane and a stubborn koi. None of them was afraid of any story at all.',
    },
    draw(ctx, w, t) {
      // dawn in the port, cherry trees over the water
      const g = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      g.addColorStop(0, '#f2d4dc');
      g.addColorStop(0.5, '#e8c5b8');
      g.addColorStop(1, '#c9b48c');
      ctx.fillStyle = g;
      ctx.fillRect(-vp.W, -HEIGHT, vp.W * 3, HEIGHT * 3);

      circle(ctx, MENU_W * 0.5, 300, 70, { color: '#e8a54c', width: 3, fill: '#f7e2a0', seed: 800, alpha: 0.9 });
      // the sea, and the ship that made it, resting
      ctx.fillStyle = '#7fa8bc';
      ctx.fillRect(-vp.W, 430, vp.W * 3, 130);
      const bx = MENU_W * 0.78;
      shape(ctx, [[bx - 70, 470], [bx + 70, 470], [bx + 52, 508], [bx - 52, 508]], {
        color: '#2b2118', width: 2.6, fill: '#6b4a2f', seed: 810,
      });
      line(ctx, bx, 470, bx, 410, { color: '#2b2118', width: 3, seed: 811 });
      shape(ctx, [[bx, 412], [bx + 34, 424], [bx, 438]], { color: null, fill: '#e8dcc4', seed: 812 });

      // the dock planks
      shape(ctx, [[-20, 560], [MENU_W + 20, 560], [MENU_W + 20, HEIGHT + 20], [-20, HEIGHT + 20]], {
        color: '#4a3218', width: 2.6, fill: '#8a6a45', seed: 820,
      });
      for (let i = 0; i < 9; i++) {
        line(ctx, i * (MENU_W / 8), 560, i * (MENU_W / 8) - 20, HEIGHT, { color: '#6b4a2f', width: 2, passes: 1, seed: 830 + i });
      }

      // cherry trees leaning in from both edges
      for (const [cx, flip] of [[70, 1], [MENU_W - 70, -1]]) {
        stroke(ctx, [[cx, 600], [cx + flip * 30, 440], [cx + flip * 80, 330]], { color: '#5c4633', width: 12, seed: 840 + cx });
        const rr = rng(850 + cx);
        for (let j = 0; j < 5; j++) {
          circle(ctx, cx + flip * (60 + rr() * 120), 320 + rr() * 90, 40 + rr() * 26, {
            color: '#d9a0b4', width: 2.2, fill: j % 2 ? '#f2c4d0' : '#e8b0c4', seed: 860 + cx + j * 7,
          });
        }
      }
      // petals on the breeze
      const rp = rng(880);
      for (let i = 0; i < 24; i++) {
        const px = ((rp() * MENU_W + t * (20 + rp() * 30)) % (MENU_W + 60)) - 30;
        const py = 200 + rp() * 420 + Math.sin(t * 2 + i) * 8;
        shape(ctx, [[px, py], [px + 5, py + 2], [px + 3, py + 6]], { color: null, fill: '#f2c4d0', seed: 890 + i, alpha: 0.8 });
      }

      // the Brazil squad walks in from the left; the Japan four wait right
      ['jaguar', 'elephant', 'owl', 'polarbear', 'kangaroo'].forEach((id, i) => {
        const enter = Math.min(1, Math.max(0, (t - 0.3 - i * 0.22) / 0.8));
        if (enter <= 0) return;
        ctx.save();
        ctx.globalAlpha = enter;
        putSprite(ctx, animalSprite(id, 128), -60 + enter * (170 + i * 105), 640 + (i % 2) * 20, 0.76, true);
        ctx.restore();
      });
      ['tanuki', 'snowmonkey', 'crane', 'koi'].forEach((id, i) => {
        const bob = Math.sin(t * 1.8 + i) * 3;
        putSprite(ctx, animalSprite(id, 128), MENU_W - 150 - i * 115, 645 + (i % 2) * 14 + bob, 0.78);
      });

      // the title card
      const tt = Math.max(0, Math.min(1, (t - 4) / 1.4));
      if (tt > 0) {
        ctx.save();
        ctx.globalAlpha = tt;
        text(ctx, pick(JAPAN_TITLE.campaign), MENU_W / 2, 150 - (1 - tt) * 20, {
          size: 30, align: 'center', color: '#f2c94c', outline: INK, outlineWidth: 6,
        });
        text(ctx, pick(JAPAN_TITLE.country), MENU_W / 2, 236, {
          size: 92, align: 'center', color: '#f7e9c8', outline: INK, outlineWidth: 10,
        });
        ctx.restore();
      }
      const st = Math.max(0, Math.min(1, (t - 5.6) / 1.2));
      if (st > 0) {
        text(ctx, pick(JAPAN_TITLE.tagline), MENU_W / 2, 300, {
          size: 26, align: 'center', color: PAPER, outline: INK, outlineWidth: 5, alpha: st,
        });
      }
    },
  },
];

const SKIP_HINT = {
  pt: 'clique para avançar  ·  ESC pula a abertura',
  en: 'click to advance  ·  ESC skips the intro',
};

/**
 * Builds a film. `onDone()` fires at the end or when the player skips.
 * The default reel is the game's opening; pass `JAPAN_SCENES` for the
 * Brazil → Japan crossing.
 *
 * The projector is slopkit's; this wrapper dresses it in the game's scribble
 * skin — the caption in a sketched box, the markers as wobbly dots — and keeps
 * the whole film inside the centred menu frame.
 */
export function createCutscene(onDone, scenes = SCENES) {
  const reel = filmProjector(scenes, {
    height: HEIGHT,
    i18n,
    onDone,
    onAdvance: () => sfx.click(),
    veil: '#0c0a0e',
    skipHint: SKIP_HINT,
    frame(ctx, paint) {
      ctx.save();
      applyFrame(ctx);
      paint();
      ctx.restore();
    },
    caption(ctx, w, txt, alpha) {
      const lines = wrapText(ctx, txt, 940, 26);
      const h = 30 + lines.length * 34;
      const y = HEIGHT - h - 34;
      ctx.save();
      ctx.globalAlpha = alpha;
      box(ctx, w / 2 - 500, y, 1000, h, 14, {
        color: INK, width: 3, fill: 'rgba(18, 15, 20, 0.72)', seed: 900 + txt.length,
      });
      lines.forEach((ln, i) => {
        text(ctx, ln, w / 2, y + 36 + i * 34, { size: 26, align: 'center', color: '#f2ead0' });
      });
      ctx.restore();
    },
    hint(ctx, w, txt) {
      text(ctx, txt, w - 24, 30, { size: 15, align: 'right', color: 'rgba(242, 234, 208, 0.65)' });
    },
    marker(ctx, x, y, active) {
      circle(ctx, x, y, 4.5, {
        color: null, fill: active ? '#f2c94c' : 'rgba(242, 234, 208, 0.3)', seed: 950 + x,
      });
    },
  });

  return {
    update: reel.update,
    // the film reads the elastic width every frame; the scenes themselves keep
    // reading the module-level MENU_W, refreshed here before they paint
    draw(ctx) {
      MENU_W = menuWidth();
      reel.draw(ctx, MENU_W);
    },
    click: reel.click,
    skip: reel.skip,
  };
}

export { JAPAN_SCENES };
