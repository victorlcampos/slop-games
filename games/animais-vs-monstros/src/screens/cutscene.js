// The opening short, in six scenes.
//
// The script exists to justify the mechanic: the monsters are each people's
// legends, the humans freeze with fear because they grew up hearing those
// stories, and the animals are immune because nobody ever told them anything.
// Hence a campaign country by country, with the local folklore as the enemy.

import { shape, circle, stroke, box, text, wrapText, ellipsePoints, putSprite, rng } from '../scribble.js';
import { INK, COLORS, PAPER, shade, withAlpha } from '../palette.js';
import { animalSprite } from '../draw/animals.js';
import { monsterSprite } from '../draw/monsters.js';
import { cachedMap, project, COUNTRIES } from '../draw/worldmap.js';
import { vp, HEIGHT, applyFrame, menuWidth } from '../viewport.js';
import { sfx } from '../audio.js';
import { pick } from '../i18n.js';

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
    draw(ctx, t) {
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
    draw(ctx, t) {
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
    draw(ctx, t) {
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
    draw(ctx, t) {
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
    draw(ctx, t) {
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
    draw(ctx, t) {
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

const SKIP_HINT = {
  pt: 'clique para avançar  ·  ESC pula a abertura',
  en: 'click to advance  ·  ESC skips the intro',
};

/** Builds the intro. `onDone()` fires at the end or when the player skips. */
export function createCutscene(onDone) {
  let scene = 0;
  let t = 0;
  let done = false;

  const FADE = 0.7;

  function advance() {
    if (done) return;
    if (scene >= SCENES.length - 1) {
      finish();
      return;
    }
    scene++;
    t = 0;
    sfx.click();
  }

  function finish() {
    if (done) return;
    done = true;
    onDone();
  }

  function update(dt) {
    if (done) return;
    t += dt;
    if (t >= SCENES[scene].duration) {
      if (scene >= SCENES.length - 1) finish();
      else {
        scene++;
        t = 0;
      }
    }
  }

  function draw(ctx) {
    MENU_W = menuWidth();
    const c = SCENES[scene];
    ctx.save();
    applyFrame(ctx);
    c.draw(ctx, t);
    ctx.restore();
    ctx.save();
    applyFrame(ctx);

    // fade in and fade out of each scene
    const fadeIn = Math.min(1, t / FADE);
    const fadeOut = Math.min(1, (c.duration - t) / FADE);
    const dark = 1 - Math.min(fadeIn, fadeOut);
    if (dark > 0.001) {
      ctx.fillStyle = `rgba(12, 10, 14, ${dark})`;
      ctx.fillRect(-vp.W, -HEIGHT, vp.W * 3, HEIGHT * 3);
    }

    // the caption
    if (c.line) {
      const lines = wrapText(ctx, pick(c.line), 940, 26);
      const h = 30 + lines.length * 34;
      const y = HEIGHT - h - 34;
      const alpha = Math.min(1, Math.max(0, (t - 0.35) / 0.6)) * fadeOut;
      ctx.save();
      ctx.globalAlpha = alpha;
      box(ctx, MENU_W / 2 - 500, y, 1000, h, 14, {
        color: INK, width: 3, fill: 'rgba(18, 15, 20, 0.72)', seed: 900 + scene,
      });
      lines.forEach((ln, i) => {
        text(ctx, ln, MENU_W / 2, y + 36 + i * 34, { size: 26, align: 'center', color: '#f2ead0' });
      });
      ctx.restore();
    }

    // skipping
    text(ctx, pick(SKIP_HINT), MENU_W - 24, 30, {
      size: 15, align: 'right', color: 'rgba(242, 234, 208, 0.65)',
    });

    // scene markers
    for (let i = 0; i < SCENES.length; i++) {
      circle(ctx, MENU_W / 2 - (SCENES.length - 1) * 9 + i * 18, HEIGHT - 16, 4.5, {
        color: null, fill: i === scene ? '#f2c94c' : 'rgba(242, 234, 208, 0.3)', seed: 950 + i,
      });
    }
    ctx.restore();
  }

  return {
    update,
    draw,
    click: advance,
    skip: finish,
  };
}
