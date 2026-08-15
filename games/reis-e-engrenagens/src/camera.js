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

import { H, W, clamp } from './config.js';

/** As far up as the view will ever go — a very high lob, and no further. */
export const CAM_TOP = -560;

export function createCamera() {
  const cam = {
    x: 0,
    y: 0,
    /**
     * How much the view is magnified. The battle runs at 1 — the field is drawn
     * at the size it was designed at — and the workshop zooms in, because a
     * 40px cell on a phone held upright is about twenty screen pixels, which is
     * half of what a thumb can hit.
     */
    z: 1,
    wantZ: 1,
    /** Where the view would like to be, before the drift catches up. */
    wantX: 0,
    wantY: 0,
  };

  /** How much *world* fits on screen, which is what everything else measures in. */
  cam.span = (viewW) => viewW / cam.z;

  cam.zoomTo = (z, snap = false) => {
    cam.wantZ = z;
    if (snap) cam.z = z;
  };

  /**
   * @param {object} target  {x, y} in world coordinates
   * @param {number} viewW   how much of the world is on screen
   * @param {number} h       the loop's fixed step
   * @param {boolean} [snap] jump instead of drifting (a new siege)
   */
  cam.follow = (target, viewW, h, snap = false) => {
    if (snap) cam.z = cam.wantZ;
    else cam.z += (cam.wantZ - cam.z) * (1 - Math.exp(-6 * h));
    const span = cam.span(viewW);
    cam.wantX = clamp(target.x - span / 2, 0, Math.max(0, W - span));

    // Vertically the rule is "the ground never leaves the bottom of the screen",
    // and with a zoom that is not the same as "y never goes above 0": magnified,
    // less than the world's height fits, so the view has to move *down* to keep
    // the ground in it. Written as `min(0, …)` the workshop zoomed in on nothing
    // but sky, which is exactly what it did.
    const visible = H / cam.z;
    const floor = H - visible;
    cam.wantY = clamp(Math.min(floor, target.y - visible * 0.3), CAM_TOP, floor);

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
  cam.toWorld = (x, y) => ({ x: x / cam.z + cam.x, y: y / cam.z + cam.y });

  /** Lay the world transform on a context. Everything after it is world space. */
  cam.apply = (ctx) => {
    ctx.scale(cam.z, cam.z);
    ctx.translate(-cam.x, -cam.y);
  };

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
