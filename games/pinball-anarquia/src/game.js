// The machine itself: one ball, one table, and every rule of the game —
// scoring, missions, tilt, ball save, the lot. No canvas anywhere in this
// file; the tests play it exactly the way main.js does, through update().

import { PHYS, PLUNGER, RULES, FLIPPER, TABLE, MISSIONS, RANKS } from './config.js';
import { createTable, flipperTip, flipperStep, flipperSurfaceVel } from './table.js';
import {
  collideSegment,
  collideCircle,
  collideArchInside,
  closestOnSegment,
  inSensor,
  integrate,
} from './physics.js';

export function createGame({ onEvent } = {}) {
  const table = createTable();
  const emit = (type, data) => { if (onEvent) onEvent(type, data); };

  const state = {
    phase: 'plunger', // plunger | play | captured | over
    score: 0,
    balls: RULES.balls,
    ballInPlay: 1,
    mult: 1,
    rank: 0,
    level: 1,
    mission: 0,
    progress: 0,
    missionsDone: 0,
    bumperHits: 0,
    tilt: false,
    tiltHeat: 0,
    charge: 0,
    ballSave: 0,
    inPlayfield: false,
    skillArmed: false,
    extraGiven: false,
    holeTimer: 0,
    holeCool: 0,
    loopFrom: null, // which end of the orbit the ball came in at
    loopTimer: 0,
    spins: 0,
    bankTimer: 0,
    message: null, // { key, values }
    msgTimer: 0,
  };

  const ball = { x: PLUNGER.x, y: PLUNGER.y, vx: 0, vy: 0, r: PHYS.ballR };
  let plungerHeld = false;

  function say(key, values) {
    state.message = { key, values };
    state.msgTimer = 3;
  }

  function addScore(base) {
    if (state.tilt) return; // a tilted machine pays nothing — that is the punishment
    state.score += base * state.mult;
    if (!state.extraGiven && state.score >= RULES.extraBallAt) {
      state.extraGiven = true;
      state.balls += 1;
      say('msg.extraBall');
      emit('extra');
    }
  }

  /** How many hits the current mission still wants at this level. */
  function missionGoal() {
    return MISSIONS[state.mission].count * state.level;
  }

  function missionWatch(event) {
    if (state.phase === 'over' || state.tilt) return;
    if (MISSIONS[state.mission].watch !== event) return;
    state.progress += 1;
    if (state.progress >= missionGoal()) {
      addScore(RULES.score.mission * state.level);
      state.rank = Math.min(state.rank + 1, RANKS.length - 1);
      state.missionsDone += 1;
      state.progress = 0;
      state.mission += 1;
      if (state.mission >= MISSIONS.length) {
        state.mission = 0;
        state.level += 1;
      }
      say('msg.mission');
      emit('mission');
    }
  }

  function toPlunger() {
    state.phase = 'plunger';
    state.charge = 0;
    state.inPlayfield = false;
    state.skillArmed = false;
    state.ballSave = 0;
    ball.x = PLUNGER.x;
    ball.y = PLUNGER.y;
    ball.vx = 0;
    ball.vy = 0;
  }

  function drain() {
    if (state.ballSave > 0) {
      toPlunger();
      say('msg.ballSaved');
      emit('save');
      return;
    }
    state.tilt = false;
    state.tiltHeat = 0;
    state.mult = 1;
    state.loopFrom = null;
    state.loopTimer = 0;
    state.balls -= 1;
    emit('drain');
    if (state.balls <= 0) {
      state.phase = 'over';
      emit('over');
    } else {
      state.ballInPlay += 1;
      toPlunger();
      say('msg.launch');
    }
  }

  function nudge(dx, dy) {
    if (state.tilt || state.phase !== 'play') return;
    ball.vx += dx;
    ball.vy += dy;
    state.tiltHeat += 1;
    emit('nudge');
    // the epsilon forgives the sliver of heat that cools between three shoves
    // landed as fast as fingers can land them
    if (state.tiltHeat >= RULES.tiltHeatMax - 0.1) {
      state.tilt = true;
      say('msg.tilt');
      emit('tilt');
    }
  }

  /**
   * Run `hit` the first frame the ball enters a sensor, and not again until it
   * has left. Without the latch a ball rolling slowly across a rollover scores
   * it sixty times a second, which is not generosity, it is a bug that reads
   * as one.
   */
  function sensor(s, hit) {
    if (inSensor(ball, s)) {
      if (!s.hot) {
        s.hot = true;
        hit();
      }
    } else {
      s.hot = false;
    }
  }

  function physicsStep(dt) {
    integrate(ball, dt, PHYS.gravity, PHYS.airDrag, PHYS.maxSpeed);
    collideArchInside(ball, table.arch, PHYS.wallBounce);

    for (const w of table.walls) collideSegment(ball, w, PHYS.wallBounce);
    for (const p of table.posts) collideCircle(ball, p.x, p.y, p.r, PHYS.postBounce);

    for (const t of table.targets) {
      if (!t.up) continue;
      if (collideSegment(ball, t) > 0) {
        t.up = false;
        t.flash = 1;
        addScore(RULES.score.target);
        emit('target');
        if (table.targets.every((x) => !x.up)) {
          addScore(RULES.score.bank);
          state.bankTimer = 1.2;
          if (!table.kickback.lit) {
            table.kickback.lit = true;
            say('msg.kickbackLit');
          }
          emit('bank');
          missionWatch('bank');
        }
      }
    }

    for (const s of table.slings) {
      for (const w of s.body) collideSegment(ball, w, PHYS.wallBounce);
      const hit = collideSegment(ball, s.face);
      if (hit > PHYS.slingMinHit && state.phase === 'play') {
        const tx = -s.n.y;
        const ty = s.n.x;
        const vt = ball.vx * tx + ball.vy * ty;
        ball.vx = s.n.x * PHYS.slingKick + tx * vt * 0.4;
        ball.vy = s.n.y * PHYS.slingKick + ty * vt * 0.4;
        s.flash = 1;
        addScore(RULES.score.sling);
        emit('sling');
        missionWatch('sling');
      }
    }

    for (const b of table.bumpers) {
      if (collideCircle(ball, b.x, b.y, b.r, PHYS.postBounce) > 0) {
        const d = Math.hypot(ball.x - b.x, ball.y - b.y) || 1;
        const nx = (ball.x - b.x) / d;
        const ny = (ball.y - b.y) / d;
        ball.vx = nx * PHYS.bumperKick + ball.vx * 0.25;
        ball.vy = ny * PHYS.bumperKick + ball.vy * 0.25;
        b.flash = 1;
        state.bumperHits += 1;
        addScore(RULES.score.bumper);
        emit('bumper');
        missionWatch('bumper');
      }
    }

    for (const f of table.flippers) {
      const tip = flipperTip(f);
      const q = closestOnSegment(ball.x, ball.y, f.px, f.py, tip.x, tip.y);
      if (Math.hypot(ball.x - q.x, ball.y - q.y) < ball.r + f.r + 0.5) {
        const sv = flipperSurfaceVel(f, q.x, q.y);
        const hit = collideSegment(ball, {
          x1: f.px, y1: f.py, x2: tip.x, y2: tip.y,
          rad: f.r, e: FLIPPER.bounce, sx: sv.sx, sy: sv.sy,
        });
        if (hit > 220) emit('flipperHit');
      }
    }

    // ---- sensors
    for (const r of table.rollovers) {
      if (inSensor(ball, r)) {
        if (!r.hot) {
          r.hot = true;
          if (!r.lit) {
            r.lit = true;
            r.flash = 1;
            addScore(RULES.score.rollover);
            emit('rollover');
            if (table.rollovers.every((x) => x.lit)) {
              addScore(RULES.score.lanesDone);
              state.mult = Math.min(state.mult + 1, RULES.maxMult);
              for (const x of table.rollovers) x.lit = false;
              say('msg.mult', { n: state.mult });
              emit('lanes');
              missionWatch('lanes');
            }
          }
        }
      } else r.hot = false;
    }

    if (state.skillArmed && ball.vy < 0 && inSensor(ball, table.skillShot)) {
      state.skillArmed = false;
      addScore(RULES.score.skillShot);
      say('msg.skillShot');
      emit('skill');
    }

    if (state.phase === 'play' && state.holeCool <= 0 && inSensor(ball, table.hole)) {
      state.phase = 'captured';
      state.holeTimer = 0.9;
      ball.x = table.hole.x;
      ball.y = table.hole.y;
      ball.vx = 0;
      ball.vy = 0;
      table.hole.flash = 1;
      addScore(RULES.score.hole);
      say('msg.hole');
      emit('hole');
      missionWatch('hole');
    }

    if (table.kickback.lit && ball.vy > 0 && inSensor(ball, table.kickback)) {
      ball.vy = -980;
      ball.vx += 40;
      table.kickback.lit = false;
      table.kickback.flash = 1;
      say('msg.kickback');
      emit('kickback');
    }

    // ---- the sensors. None of them touch the ball; they only notice it.
    sensor(table.spinner, () => {
      // a spinner is rated by how fast the ball went through it, and a real one
      // keeps ticking for a second after
      const spins = 5 + Math.min(14, Math.round(Math.hypot(ball.vx, ball.vy) / 90));
      state.spins += spins;
      table.spinner.spin = spins;
      table.spinner.flash = 1;
      addScore(RULES.score.spinner * spins);
      emit('spinner');
      missionWatch('spinner');
    });

    for (const r of table.inlanes) {
      sensor(r, () => {
        r.flash = 1;
        addScore(RULES.score.inlane);
        emit('inlane');
        if (!r.lit) {
          r.lit = true;
          if (table.inlanes.every((x) => x.lit)) {
            addScore(RULES.score.inlanesDone);
            for (const x of table.inlanes) x.lit = false;
            if (!table.kickback.lit) {
              table.kickback.lit = true;
              say('msg.kickbackLit');
            }
            emit('inlanes');
          }
        }
      });
    }

    for (const r of table.outlanes) {
      sensor(r, () => {
        r.flash = 1;
        addScore(RULES.score.outlane);
        emit('outlane');
      });
    }

    for (const z of table.loops) {
      sensor(z, () => {
        z.flash = 1;
        if (state.loopFrom && state.loopFrom !== z.id && state.loopTimer > 0) {
          state.loopFrom = null;
          state.loopTimer = 0;
          addScore(RULES.score.orbit);
          say('msg.orbit');
          emit('orbit');
          missionWatch('orbit');
        } else {
          state.loopFrom = z.id;
          state.loopTimer = RULES.loopWindow;
        }
      });
    }

    if (!state.inPlayfield && ball.x < TABLE.laneWall - 4) {
      state.inPlayfield = true;
      state.skillArmed = false;
      state.ballSave = RULES.ballSave;
    }
  }

  function update(h, input = {}) {
    if (state.msgTimer > 0) state.msgTimer = Math.max(0, state.msgTimer - h);
    if (state.holeCool > 0) state.holeCool = Math.max(0, state.holeCool - h);
    if (state.loopTimer > 0) {
      state.loopTimer -= h;
      if (state.loopTimer <= 0) state.loopFrom = null;
    }
    if (table.spinner.spin > 0) table.spinner.spin = Math.max(0, table.spinner.spin - 9 * h);
    table.spinner.angle += table.spinner.spin * h * 2.4;
    if (state.tiltHeat > 0 && !state.tilt) state.tiltHeat = Math.max(0, state.tiltHeat - RULES.tiltCool * h);
    if (state.bankTimer > 0) {
      state.bankTimer -= h;
      if (state.bankTimer <= 0) for (const t of table.targets) t.up = true;
    }
    for (const list of [
      table.bumpers, table.slings, table.targets, table.rollovers,
      table.inlanes, table.outlanes, table.loops,
      [table.hole, table.kickback, table.spinner],
    ])
      for (const el of list) el.flash = Math.max(0, el.flash - 3 * h);

    const flip = !state.tilt && (state.phase === 'play' || state.phase === 'plunger');
    table.flippers[0].target = flip && input.left ? FLIPPER.up : FLIPPER.rest;
    table.flippers[1].target = flip && input.right ? FLIPPER.up : FLIPPER.rest;
    for (const f of table.flippers) flipperStep(f, h);

    if (state.phase === 'over') return;

    if (state.phase === 'plunger') {
      if (input.plunger) {
        plungerHeld = true;
        state.charge = Math.min(1, state.charge + h / PLUNGER.chargeTime);
      } else if (plungerHeld) {
        plungerHeld = false;
        ball.vy = -(PLUNGER.min + state.charge * (PLUNGER.max - PLUNGER.min));
        state.charge = 0;
        state.phase = 'play';
        state.skillArmed = true;
        emit('launch');
      }
      return;
    }

    if (state.phase === 'captured') {
      state.holeTimer -= h;
      if (state.holeTimer <= 0) {
        state.phase = 'play';
        state.holeCool = 1; // or the hole would swallow the ball it just spat out
        ball.vx = table.hole.eject.vx;
        ball.vy = table.hole.eject.vy;
        emit('eject');
      }
      return;
    }

    // play
    if (input.nudgeL) nudge(RULES.nudge, -30);
    if (input.nudgeR) nudge(-RULES.nudge, -30);
    if (input.nudgeUp) nudge(0, -RULES.nudge);
    if (state.inPlayfield && state.ballSave > 0) state.ballSave = Math.max(0, state.ballSave - h);

    const dt = h / PHYS.substeps;
    for (let i = 0; i < PHYS.substeps; i++) {
      physicsStep(dt);
      if (ball.y > TABLE.drainY) { drain(); return; }
      if (state.phase !== 'play') return; // captured mid-step
    }

    // a weak plunge falls back onto the plunger instead of playing dead in the lane
    if (!state.inPlayfield && ball.x > TABLE.laneWall && ball.y > 668 && Math.abs(ball.vy) < 30) {
      toPlunger();
    }
  }

  return { state, ball, table, update, missionGoal };
}

export { MISSIONS, RANKS };
