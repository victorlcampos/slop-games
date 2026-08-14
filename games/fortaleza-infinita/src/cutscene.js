// The opening short, in six scenes.
//
// The script exists to justify the game: the Fortress collects people, the
// rings have no top, the sentinels answer to the nearest alarm node, and the
// only gun that ever tells the truth quietly is the one you start with. Every
// scene is drawn by code against the game's own palette — no image, no font
// file, no sound file — and the module touches no DOM, so the same six scenes
// play in a test as readily as on a phone.
//
// The projector itself — scene clock, fades, caption, skip, markers — is
// slopkit's: this file owns only the six paintings. The kit's plain-canvas
// skin IS this game's skin (it was lifted from here), so only the scene-marker
// colour needs handing back.

import { createCutscene as filmProjector } from 'slopkit/cutscene';
import { COLOURS, KIT, H, makeRng } from './config.js';
import { i18n } from './i18n.js';
import { drawGunShape } from './render.js';

const pick = (o) => (i18n.lang === 'pt' ? o.pt : o.en);

// ------------------------------------------------------------------ figures

/** A human, small and far away: a head, a coat and two legs. */
function human(ctx, x, yBase, h, colour) {
  const k = h / 100;
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(x, yBase - 86 * k, 10 * k, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x - 11 * k, yBase - 74 * k, 22 * k, 38 * k);
  ctx.fillRect(x - 10 * k, yBase - 37 * k, 8 * k, 37 * k);
  ctx.fillRect(x + 2 * k, yBase - 37 * k, 8 * k, 37 * k);
  ctx.fillRect(x - 17 * k, yBase - 72 * k, 6 * k, 28 * k);
  ctx.fillRect(x + 11 * k, yBase - 72 * k, 6 * k, 28 * k);
}

/** The escapee with his headlamp on, which is how you tell him from the taken. */
function escapee(ctx, x, yBase, h) {
  human(ctx, x, yBase, h, KIT.player.coat);
  const k = h / 100;
  ctx.fillStyle = '#fff2c8';
  ctx.fillRect(x + 6 * k, yBase - 90 * k, 5 * k, 5 * k);
}

/** A sentinel, front on: narrow shoulders, long arms, and the head that stares. */
function sentinel(ctx, x, yBase, h, kit, opts = {}) {
  const k = h / 100;
  ctx.fillStyle = kit.legs;
  ctx.fillRect(x - 9 * k, yBase - 40 * k, 6 * k, 40 * k);
  ctx.fillRect(x + 3 * k, yBase - 40 * k, 6 * k, 40 * k);
  ctx.fillStyle = kit.coat;
  ctx.beginPath();
  ctx.moveTo(x - 14 * k, yBase - 78 * k);
  ctx.lineTo(x + 14 * k, yBase - 78 * k);
  ctx.lineTo(x + 8 * k, yBase - 36 * k);
  ctx.lineTo(x - 8 * k, yBase - 36 * k);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = kit.skin;
  ctx.lineWidth = 4.5 * k;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + side * 13 * k, yBase - 74 * k);
    ctx.lineTo(x + side * 17 * k, yBase - 34 * k);
    ctx.stroke();
  }
  ctx.fillStyle = kit.head;
  ctx.beginPath();
  ctx.ellipse(x, yBase - 96 * k, 11 * k, 14 * k, 0, 0, Math.PI * 2);
  ctx.fill();
  if (!opts.eyesShut) {
    ctx.fillStyle = COLOURS.ink;
    ctx.beginPath();
    ctx.ellipse(x - 5 * k, yBase - 95 * k, 3.4 * k, 5.4 * k, 0.3, 0, Math.PI * 2);
    ctx.ellipse(x + 5 * k, yBase - 95 * k, 3.4 * k, 5.4 * k, -0.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A sentinel on the floor, which is where scene four needs one. */
function fallenSentinel(ctx, x, y, w) {
  const k = w / 100;
  ctx.fillStyle = 'rgba(63,174,116,0.3)';
  ctx.beginPath();
  ctx.ellipse(x, y + 6 * k, 52 * k, 16 * k, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = KIT.body.coat;
  ctx.beginPath();
  ctx.ellipse(x - 6 * k, y, 28 * k, 11 * k, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = KIT.body.legs;
  ctx.fillRect(x - 46 * k, y - 7 * k, 20 * k, 5 * k);
  ctx.fillRect(x - 46 * k, y + 2 * k, 20 * k, 5 * k);
  ctx.fillStyle = KIT.body.head;
  ctx.beginPath();
  ctx.ellipse(x + 28 * k, y, 12 * k, 9 * k, 0, 0, Math.PI * 2);
  ctx.fill();
}

function stars(ctx, W, seed, n, top = 420) {
  const r = makeRng(seed);
  ctx.fillStyle = 'rgba(232,244,255,0.7)';
  for (let i = 0; i < n; i++) {
    const s = r() * 1.5 + 0.4;
    ctx.fillRect(r() * W, r() * top, s, s);
  }
}

// ------------------------------------------------------------------- scenes

export const SCENES = [
  {
    duration: 8,
    line: {
      pt: 'Ninguém viu a Fortaleza chegar. Viram as luzes descendo — e as pessoas subindo.',
      en: 'Nobody saw the Fortress arrive. They saw the lights coming down — and the people going up.',
    },
    draw(ctx, W, t) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#04060e');
      g.addColorStop(1, '#0b1220');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      stars(ctx, W, 11, 90);

      // the town, still warm
      const r = makeRng(31);
      let x = -10;
      while (x < W) {
        const bw = 60 + r() * 80;
        const bh = 90 + r() * 130;
        ctx.fillStyle = '#0d1118';
        ctx.fillRect(x, 620 - bh, bw, bh + 110);
        ctx.fillStyle = 'rgba(255,217,160,0.5)';
        for (let i = 0; i < 3; i++) {
          if (r() < 0.5) ctx.fillRect(x + 8 + r() * (bw - 20), 640 - bh + r() * (bh - 40), 5, 7);
        }
        x += bw + 14;
      }
      ctx.fillStyle = '#0a0e14';
      ctx.fillRect(0, 620, W, H - 620);

      // the hull slides over the town, wider than the sky
      const slide = Math.min(1, t / 4.5);
      const cy = -560 + slide * 260;
      ctx.fillStyle = '#0a0e16';
      ctx.beginPath();
      ctx.ellipse(W / 2, cy, W * 0.85, 470, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(92,232,207,0.25)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(W / 2, cy, W * 0.85, 470, 0, Math.PI * 0.08, Math.PI * 0.92);
      ctx.stroke();
      ctx.fillStyle = 'rgba(92,232,207,0.75)';
      for (let i = -5; i <= 5; i++) {
        ctx.fillRect(W / 2 + i * (W * 0.07), cy + 452 - Math.abs(i) * 14, 5, 5);
      }

      // the beams, and what they are for
      const lit = Math.max(0, Math.min(1, (t - 2) / 1.4));
      if (lit > 0) {
        for (const [bx, phase] of [[W / 2 - 280, 0], [W / 2 + 40, 0.5], [W / 2 + 320, 1.1]]) {
          const pulse = 0.1 + Math.abs(Math.sin(t * 1.4 + phase)) * 0.08;
          const grad = ctx.createLinearGradient(0, 40, 0, 640);
          grad.addColorStop(0, `rgba(185,245,255,${(pulse + 0.1) * lit})`);
          grad.addColorStop(1, `rgba(185,245,255,${pulse * 0.4 * lit})`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(bx - 26, 40);
          ctx.lineTo(bx + 26, 40);
          ctx.lineTo(bx + 74, 640);
          ctx.lineTo(bx - 74, 640);
          ctx.closePath();
          ctx.fill();
          // people going up, feet first off the ground
          for (let i = 0; i < 2; i++) {
            const up = ((t * 0.16 + phase * 0.4 + i * 0.5) % 1);
            const y = 640 - up * 520;
            ctx.globalAlpha = lit * (1 - up * 0.6);
            human(ctx, bx + (i ? 22 : -18), y, 64, '#141c26');
            ctx.globalAlpha = 1;
          }
        }
      }
      // the ones still on the street, looking up
      for (let i = 0; i < 5; i++) {
        human(ctx, W / 2 - 460 + i * 230 + (i % 2) * 40, 668, 62, '#10161f');
      }
    },
  },

  {
    duration: 8,
    line: {
      pt: 'A Fortaleza é feita de anéis. Cada anel é maior que o de baixo — e ninguém nunca viu o último.',
      en: 'The Fortress is built of rings. Each ring is wider than the one beneath it — and nobody has ever seen the last.',
    },
    draw(ctx, W, t) {
      ctx.fillStyle = '#030509';
      ctx.fillRect(0, 0, W, H);
      stars(ctx, W, 47, 120, H);

      // the stack, climbing out of the frame: the camera drifts up and never
      // finds the top, which is the whole scene
      const rise = t * 26;
      let w = 150;
      let y = 700 + rise;
      let i = 0;
      while (y > -80) {
        const rh = 34 + w * 0.02;
        ctx.fillStyle = i % 2 ? '#10151d' : '#0d1219';
        ctx.beginPath();
        ctx.ellipse(W / 2, y, w, rh, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(92,232,207,0.14)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(W / 2, y - rh * 0.32, w * 0.96, rh * 0.7, 0, Math.PI, Math.PI * 2);
        ctx.stroke();
        // a few lit slits per ring — somebody lives in every one of them
        const r = makeRng(900 + i);
        ctx.fillStyle = 'rgba(92,232,207,0.5)';
        for (let s = 0; s < 8; s++) {
          if (r() < 0.6) ctx.fillRect(W / 2 - w + r() * w * 2, y - 4 + r() * 6, 6, 2);
        }
        y -= 62 + rh * 0.5;
        w *= 1.27;
        i++;
      }

      // and it keeps going: the top rings dissolve into the dark
      const veil = ctx.createLinearGradient(0, 0, 0, 300);
      veil.addColorStop(0, 'rgba(3,5,9,0.95)');
      veil.addColorStop(1, 'rgba(3,5,9,0)');
      ctx.fillStyle = veil;
      ctx.fillRect(0, 0, W, 300);
    },
  },

  {
    duration: 9,
    line: {
      pt: 'Lá dentro, os sentinelas não dormem. Enxergam o que está na frente deles — e o que um vê, o anel inteiro fica sabendo.',
      en: 'Inside, the sentinels do not sleep. They see what is in front of them — and what one sees, the whole ring knows.',
    },
    draw(ctx, W, t) {
      // a corridor of the game's own hull
      ctx.fillStyle = '#0b0f15';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = COLOURS.wallFace;
      ctx.fillRect(0, 150, W, 330);
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.fillRect(0, 150, W, 8);
      ctx.fillStyle = '#39434d';
      ctx.fillRect(0, 480, W, H - 480);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let x = 0; x < W; x += 90) ctx.fillRect(x, 480, 1, H - 480);
      ctx.fillRect(0, 480, W, 3);

      // the cells, and the people the beams brought here
      const r = makeRng(77);
      for (let c = 0; c < 4; c++) {
        const cx = W / 2 - 480 + c * 320;
        ctx.fillStyle = '#0a0e14';
        ctx.fillRect(cx - 70, 210, 140, 270);
        ctx.globalAlpha = 0.55;
        human(ctx, cx - 20 + r() * 30, 470, 92, '#1b2530');
        if (r() < 0.7) human(ctx, cx + 26, 472, 84, '#161e28');
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(92,232,207,0.55)';
        for (let b = 0; b < 5; b++) ctx.fillRect(cx - 62 + b * 30, 210, 4, 270);
        ctx.fillStyle = 'rgba(92,232,207,0.2)';
        ctx.fillRect(cx - 70, 206, 140, 4);
      }

      // the patrol, and the cone that is the whole rulebook
      const span = Math.max(360, W - 560);
      const k = (t * 0.11) % 2;
      const forward = k < 1;
      const px = 280 + (forward ? k : 2 - k) * span;
      const dir = forward ? 1 : -1;
      const cone = ctx.createLinearGradient(px, 0, px + dir * 420, 0);
      cone.addColorStop(0, 'rgba(150,240,220,0.22)');
      cone.addColorStop(1, 'rgba(150,240,220,0)');
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.moveTo(px + dir * 14, 560);
      ctx.lineTo(px + dir * 430, 470);
      ctx.lineTo(px + dir * 430, 660);
      ctx.closePath();
      ctx.fill();
      sentinel(ctx, px, 640, 118, KIT.guardCalm);
    },
  },

  {
    duration: 8.5,
    line: {
      pt: 'Uma noite, o selo da sua cela piscou e apagou. No corredor, um sentinela caído — e na garra dele, uma arma que não faz barulho.',
      en: 'One night the seal on your cell blinked and went out. In the corridor, a fallen sentinel — and in its claw, a gun that makes no sound.',
    },
    draw(ctx, W, t) {
      ctx.fillStyle = '#080b11';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#1c242e';
      ctx.fillRect(0, 130, W, 350);
      ctx.fillStyle = '#333d47';
      ctx.fillRect(0, 480, W, H - 480);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(0, 480, W, 3);

      // his cell, stage left
      const cx = W / 2 - 330;
      ctx.fillStyle = '#07090e';
      ctx.fillRect(cx - 80, 190, 160, 290);
      // the seal over the door: it blinks, and then it is nothing
      const dying = t < 3 ? (Math.sin(t * 21) > -0.2 ? 1 : 0.15) : Math.max(0, 1 - (t - 3) * 2);
      ctx.fillStyle = `rgba(92,232,207,${0.15 + dying * 0.65})`;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
        const px = cx + Math.cos(a) * 16;
        const py = 168 + Math.sin(a) * 19;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      // the bars slide once the seal dies
      const open = Math.max(0, Math.min(1, (t - 3.4) / 1.4));
      ctx.fillStyle = `rgba(92,232,207,${0.55 - open * 0.45})`;
      for (let b = 0; b < 5; b++) {
        ctx.fillRect(cx - 70 + b * 33, 190 - open * 250 * (b % 2 ? 1 : 0.7), 4, 290);
      }

      // the sentinel that will not be getting up, and what it was holding
      fallenSentinel(ctx, W / 2 + 120, 600, 130);
      ctx.save();
      ctx.translate(W / 2 + 235, 622);
      ctx.rotate(-0.3);
      ctx.scale(2.1, 2.1);
      drawGunShape(ctx, 'whisper');
      ctx.restore();
      const halo = 0.1 + Math.abs(Math.sin(t * 2.2)) * 0.1;
      ctx.fillStyle = `rgba(111,240,220,${halo})`;
      ctx.beginPath();
      ctx.arc(W / 2 + 255, 618, 52, 0, Math.PI * 2);
      ctx.fill();

      // and him, out of the cell and thinking about it
      const walk = Math.max(0, Math.min(1, (t - 4.6) / 2.4));
      if (walk > 0) {
        const ex = cx + walk * (W / 2 - 40 - cx);
        escapee(ctx, ex, 636, 104);
        // his torch, already pointing at the answer
        const beam = ctx.createLinearGradient(ex, 0, ex + 320, 0);
        beam.addColorStop(0, 'rgba(255,205,150,0.16)');
        beam.addColorStop(1, 'rgba(255,205,150,0)');
        ctx.fillStyle = beam;
        ctx.beginPath();
        ctx.moveTo(ex + 10, 548);
        ctx.lineTo(ex + 330, 590);
        ctx.lineTo(ex + 330, 668);
        ctx.lineTo(ex + 10, 620);
        ctx.closePath();
        ctx.fill();
      }
    },
  },

  {
    duration: 8,
    line: {
      pt: 'Cada anel tem um selo, e cada selo abre o caminho para cima. Rompê-lo é a coisa mais barulhenta que existe.',
      en: 'Every ring has a seal, and every seal opens the way up. Breaking one is the loudest thing there is.',
    },
    draw(ctx, W, t) {
      ctx.fillStyle = '#0a0e14';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#161c26';
      ctx.fillRect(0, 90, W, 470);
      ctx.fillStyle = '#39434d';
      ctx.fillRect(0, 560, W, H - 560);

      // the seal, wall-sized
      const cx = W / 2;
      const cy = 330;
      const R = 195;
      ctx.fillStyle = COLOURS.vaultLit;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#081e21';
      ctx.beginPath();
      ctx.arc(cx, cy, R - 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = COLOURS.energy;
      ctx.lineWidth = 9;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + t * 0.55;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * 40, cy + Math.sin(a) * 40);
        ctx.lineTo(cx + Math.cos(a) * (R - 42), cy + Math.sin(a) * (R - 42));
        ctx.stroke();
      }
      const wake = Math.min(1, t / 5);
      ctx.fillStyle = `rgba(92,232,207,${0.2 + wake * 0.6})`;
      ctx.beginPath();
      ctx.arc(cx, cy, 30, 0, Math.PI * 2);
      ctx.fill();

      // the noise, drawn: rings of it, leaving
      for (let i = 0; i < 3; i++) {
        const k = ((t * 0.62) + i / 3) % 1;
        ctx.strokeStyle = `rgba(232,238,248,${(1 - k) * 0.3})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, R + 14 + k * 340, 0, Math.PI * 2);
        ctx.stroke();
      }

      // and what the noise does: the nodes come on, one by one
      const nodes = [[cx - 480, 240], [cx + 470, 210], [cx - 430, 470], [cx + 500, 450]];
      nodes.forEach(([nx, ny], i) => {
        const on = t > 2.2 + i * 0.8;
        ctx.fillStyle = on ? COLOURS.alarm : '#2c333e';
        ctx.beginPath();
        for (let s = 0; s < 6; s++) {
          const a = (s / 6) * Math.PI * 2 - Math.PI / 2;
          const px = nx + Math.cos(a) * 13;
          const py = ny + Math.sin(a) * 16;
          if (s === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        if (on) {
          ctx.fillStyle = `rgba(255,90,77,${0.12 + Math.abs(Math.sin(t * 5 + i)) * 0.14})`;
          ctx.beginPath();
          ctx.arc(nx, ny, 46, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      escapee(ctx, cx - 6, 668, 96);
    },
  },

  {
    duration: 9,
    line: {
      pt: 'Ele vai subir até acabar. Ninguém disse a ele que não acaba.',
      en: 'He will climb until it ends. Nobody has told him it does not.',
    },
    title: true,
    draw(ctx, W, t) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#04060c');
      g.addColorStop(0.62, '#0b1420');
      g.addColorStop(1, '#12202b');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // the next gate, already waiting far ahead
      const glow = ctx.createRadialGradient(W / 2, 470, 20, W / 2, 470, 380);
      glow.addColorStop(0, 'rgba(92,232,207,0.3)');
      glow.addColorStop(1, 'rgba(92,232,207,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 90, W, H - 90);
      ctx.fillStyle = '#0c1a1e';
      ctx.beginPath();
      ctx.arc(W / 2, 470, 120, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(92,232,207,0.5)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(W / 2, 470, 120, Math.PI, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#0d141c';
      ctx.fillRect(0, 470, W, H - 470);

      // him, small, walking into it
      const ex = W / 2 - 30 + Math.min(1, t / 7) * 26;
      const beam = ctx.createLinearGradient(ex, 0, ex + 300, 0);
      beam.addColorStop(0, 'rgba(255,205,150,0.14)');
      beam.addColorStop(1, 'rgba(255,205,150,0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(ex + 8, 520);
      ctx.lineTo(ex + 300, 500);
      ctx.lineTo(ex + 300, 590);
      ctx.lineTo(ex + 8, 575);
      ctx.closePath();
      ctx.fill();
      escapee(ctx, ex, 600, 86);

      // the title
      const tt = Math.max(0, Math.min(1, (t - 3.2) / 1.4));
      if (tt > 0) {
        ctx.save();
        ctx.globalAlpha = tt;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.font = '900 92px system-ui, sans-serif';
        ctx.lineWidth = 12;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = COLOURS.ink;
        const y1 = 200 - (1 - tt) * 20;
        ctx.strokeText(pick(TITLE.a), W / 2, y1);
        ctx.fillStyle = '#eafff8';
        ctx.fillText(pick(TITLE.a), W / 2, y1);
        ctx.strokeText(pick(TITLE.b), W / 2, y1 + 96);
        ctx.fillStyle = COLOURS.energy;
        ctx.fillText(pick(TITLE.b), W / 2, y1 + 96);
        ctx.restore();
      }
      const st = Math.max(0, Math.min(1, (t - 5) / 1.2));
      if (st > 0) {
        ctx.save();
        ctx.globalAlpha = st;
        ctx.textAlign = 'center';
        ctx.font = '600 27px system-ui, sans-serif';
        ctx.fillStyle = '#cfe0ea';
        ctx.fillText(pick(TITLE.tagline), W / 2, 356);
        ctx.restore();
      }
    },
  },
];

const TITLE = {
  a: { pt: 'FORTALEZA', en: 'INFINITE' },
  b: { pt: 'INFINITA', en: 'FORTRESS' },
  tagline: {
    pt: 'A saída é para cima. Ninguém sabe se existe.',
    en: 'The way out is up. Nobody knows if it is there.',
  },
};

export const SKIP_HINT = {
  pt: 'clique para avançar · ESC pula a abertura',
  en: 'click to advance · ESC skips the intro',
};

/**
 * Builds the intro. `onDone()` fires at the end or when the player skips;
 * `onAdvance()` on every hand-turned page, so the caller can click a sound.
 *
 * The machine is slopkit's; the marker keeps this game's energy green, and
 * everything else already draws in the kit's plain-canvas skin.
 */
export function createCutscene(onDone, onAdvance) {
  return filmProjector(SCENES, {
    height: H,
    i18n,
    onDone,
    onAdvance,
    skipHint: SKIP_HINT,
    marker(ctx, x, y, active) {
      ctx.save();
      ctx.fillStyle = active ? COLOURS.energy : 'rgba(232,238,248,0.25)';
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
  });
}
