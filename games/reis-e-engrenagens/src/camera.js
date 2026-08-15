// The camera, which exists because the field is wider than any screen.
//
// It does one thing and it does it slowly: it drifts towards whatever matters
// this instant — the shell while one is up, the siege engine about to fire when
// one is not. Slowly is the whole trick. A camera that snaps to the projectile
// makes the shell look stationary and the world look like it is being yanked
// around it, which is the single most common way a scrolling artillery game
// gives people motion sickness.
//
// Vertically it only ever rises, and only when the shell climbs past the top of
// the screen. Panning down would show the player the underside of the map,
// which contains nothing but the floor of the world.

import { W, clamp } from './config.js';

/** As far up as the view will ever go — a very high lob, and no further. */
export const CAM_TOP = -560;

export function createCamera() {
  const cam = {
    x: 0,
    y: 0,
    /** Where the view would like to be, before the drift catches up. */
    wantX: 0,
    wantY: 0,
  };

  /**
   * @param {object} target  {x, y} in world coordinates
   * @param {number} viewW   how much of the world is on screen
   * @param {number} h       the loop's fixed step
   * @param {boolean} [snap] jump instead of drifting (a new siege)
   */
  cam.follow = (target, viewW, h, snap = false) => {
    cam.wantX = clamp(target.x - viewW / 2, 0, Math.max(0, W - viewW));
    // only climbs: the shell going up pulls the view with it, the shell coming
    // back down finds the view already where it was
    cam.wantY = clamp(Math.min(0, target.y - 220), CAM_TOP, 0);

    if (snap) {
      cam.x = cam.wantX;
      cam.y = cam.wantY;
      return cam;
    }
    // exponential damping — frame-rate independent by construction, which is
    // why it is the one place in this game dt appears in an exponent
    const k = 1 - Math.exp(-5.5 * h);
    cam.x += (cam.wantX - cam.x) * k;
    cam.y += (cam.wantY - cam.y) * k;
    return cam;
  };

  /** Screen point (already in logical viewport units) → world point. */
  cam.toWorld = (x, y) => ({ x: x + cam.x, y: y + cam.y });

  /** True when a world rectangle is worth drawing at all. */
  cam.sees = (x0, x1, viewW) => x1 > cam.x - 80 && x0 < cam.x + viewW + 80;

  return cam;
}

/**
 * What the camera should be looking at right now.
 *
 * With several fragments in the air it watches the one that is furthest along,
 * not their average — a cluster's average is the empty middle of the spread,
 * which is the one place nothing is happening.
 */
export function focusOf(match, side) {
  if (match.shots.length) {
    let lead = match.shots[0];
    for (const s of match.shots) {
      if (Math.abs(s.vx) > 0 && (s.side === 'player' ? s.x > lead.x : s.x < lead.x)) lead = s;
    }
    return { x: lead.x, y: lead.y };
  }
  const L = match.launchers[side || match.turn];
  return { x: L.x, y: L.y - 60 };
}
