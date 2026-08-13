// Where a floor comes from.
//
// There is no map file anywhere in this game: a floor is a seed and a plan
// (config.js), and this turns the two into rooms, corridors, a vault at the far
// end, the people guarding it and the things worth stealing on the way.
//
// The one promise it has to keep is that the floor can be finished — the vault
// reachable on foot from the front door, and nothing placed inside a wall. That
// is checked here on every generation, not left to a test to notice later.

import { plan, makeRng, TILE, dist } from './config.js';
import {
  createGrid, WALL, ROOM, HALL, VAULT_FLOOR, flowField, centreOf, walkableCells,
} from './grid.js';
import { guardGun, lootGuns, droppedAmmo } from './weapons.js';

const ROOM_KINDS = ['office', 'hall', 'office', 'records', 'hall', 'security'];

export function generateFloor(floor, seed) {
  const p = plan(floor);
  const rng = makeRng(seed);
  const pick = (arr) => arr[Math.floor(rng() * arr.length) % arr.length];
  const range = (a, b) => a + Math.floor(rng() * (b - a + 1));

  const grid = createGrid(p.cols, p.rows, WALL);
  const rooms = carveRooms(grid, p, rng, range);
  connect(grid, rooms, rng);

  // The front door is the first room placed; the vault is whichever room is
  // furthest from it *on foot*, which is not the same as furthest in a straight
  // line — a room across a wall is next door and half a floor away.
  const entrance = rooms[0];
  entrance.kind = 'lobby';
  const reach = flowField(grid, [{ cx: entrance.cx, cy: entrance.cy }]);
  let vaultRoom = rooms[rooms.length - 1];
  let far = -1;
  for (const r of rooms) {
    const d = reach.at(r.cx, r.cy);
    if (d > far) {
      far = d;
      vaultRoom = r;
    }
  }
  vaultRoom.kind = 'vault';
  for (let cy = vaultRoom.y; cy < vaultRoom.y + vaultRoom.h; cy++) {
    for (let cx = vaultRoom.x; cx < vaultRoom.x + vaultRoom.w; cx++) grid.set(cx, cy, VAULT_FLOOR);
  }

  const spawn = centreOf(entrance.cx, entrance.cy);
  const vault = { ...centreOf(vaultRoom.cx, vaultRoom.cy), cx: vaultRoom.cx, cy: vaultRoom.cy, cracked: 0 };

  // the same field decided the vault; from here on it is the reachability test
  // every placement below has to pass
  const reachable = (cx, cy) => reach.at(cx, cy) >= 0;
  if (!reachable(vaultRoom.cx, vaultRoom.cy)) {
    // the corridors always connect, so this is a bug rather than bad luck —
    // and a floor whose vault is walled in cannot be played to the end
    throw new Error(`floor ${floor}: the vault is not reachable from the door`);
  }

  const free = walkableCells(grid).filter((c) => reachable(c.cx, c.cy));
  const taken = new Set([`${entrance.cx},${entrance.cy}`]);
  const claim = (c) => taken.add(`${c.cx},${c.cy}`);
  const isFree = (c) => !taken.has(`${c.cx},${c.cy}`);

  const guards = placeGuards(grid, p, rooms, entrance, rng, range, reachable, claim, isFree);
  const mounts = wallMounts(grid, reachable);
  const cameras = placeCameras(p, mounts, vaultRoom, entrance, rng);
  const alarms = placeAlarms(p, mounts, cameras, entrance, rng);
  const items = placeItems(p, free, rooms, entrance, vaultRoom, rng, pick, isFree, claim);

  const props = decorate(rooms, rng);

  return {
    floor: p.floor,
    seed,
    plan: p,
    grid,
    material: materialGrid(grid, rooms),
    rooms,
    entrance,
    vaultRoom,
    spawn,
    vault,
    guards,
    cameras,
    alarms,
    items,
    props,
    width: grid.width,
    height: grid.height,
  };
}

/** What each cell is floored with. Corridors are whatever is cheapest. */
export const MATERIALS = { stone: 0, marble: 1, wood: 2, lino: 3, gold: 4 };

function materialGrid(grid, rooms) {
  const out = new Uint8Array(grid.cols * grid.rows);
  for (const r of rooms) {
    const m = MATERIALS[r.floor] ?? MATERIALS.lino;
    for (let cy = r.y; cy < r.y + r.h; cy++) {
      for (let cx = r.x; cx < r.x + r.w; cx++) out[cy * grid.cols + cx] = m;
    }
  }
  return out;
}

// ------------------------------------------------------------------- rooms

function carveRooms(grid, p, rng, range) {
  const rooms = [];
  const wanted = p.rooms;
  let attempts = 0;

  while (rooms.length < wanted && attempts < 600) {
    attempts++;
    const w = range(4, 8);
    const h = range(4, 7);
    const x = range(1, p.cols - w - 2);
    const y = range(1, p.rows - h - 2);
    // one tile of wall between rooms, always: two rooms sharing a wall read as
    // one crooked room, and the corridor that was meant to join them vanishes
    if (rooms.some((r) => x < r.x + r.w + 1 && x + w + 1 > r.x && y < r.y + r.h + 1 && y + h + 1 > r.y)) continue;
    const room = {
      x, y, w, h,
      cx: x + (w >> 1),
      cy: y + (h >> 1),
      kind: ROOM_KINDS[rooms.length % ROOM_KINDS.length],
      index: rooms.length,
    };
    for (let cy = y; cy < y + h; cy++) for (let cx = x; cx < x + w; cx++) grid.set(cx, cy, ROOM);
    rooms.push(room);
  }

  if (rooms.length < 3) {
    // a plan this cramped cannot happen with the numbers in config.js, but a
    // floor with two rooms is not a bank and would be shipped silently
    throw new Error(`floor plan too tight: only ${rooms.length} rooms fitted`);
  }
  return rooms;
}

/**
 * Joins the rooms into one building: a nearest-neighbour chain, then a couple
 * of extra links.
 *
 * The extra links are not decoration — a floor plan shaped like a tree has one
 * way in and out of every room, so being seen anywhere means being cornered.
 * The loops are what make it possible to break away and come round.
 */
function connect(grid, rooms, rng) {
  const linked = [rooms[0]];
  const rest = rooms.slice(1);
  while (rest.length) {
    let best = 0;
    let bestD = Infinity;
    let from = linked[0];
    for (let i = 0; i < rest.length; i++) {
      for (const l of linked) {
        const d = Math.abs(l.cx - rest[i].cx) + Math.abs(l.cy - rest[i].cy);
        if (d < bestD) {
          bestD = d;
          best = i;
          from = l;
        }
      }
    }
    const [room] = rest.splice(best, 1);
    corridor(grid, from, room, rng);
    linked.push(room);
  }

  const extra = 1 + Math.floor(rng() * 3);
  for (let i = 0; i < extra; i++) {
    const a = rooms[Math.floor(rng() * rooms.length)];
    const b = rooms[Math.floor(rng() * rooms.length)];
    if (a !== b) corridor(grid, a, b, rng);
  }
}

function corridor(grid, a, b, rng) {
  const carve = (cx, cy) => {
    if (cx < 1 || cy < 1 || cx >= grid.cols - 1 || cy >= grid.rows - 1) return;
    if (grid.at(cx, cy) === WALL) grid.set(cx, cy, HALL);
  };
  const horizFirst = rng() < 0.5;
  const stepX = () => {
    for (let cx = Math.min(a.cx, b.cx); cx <= Math.max(a.cx, b.cx); cx++) carve(cx, horizFirst ? a.cy : b.cy);
  };
  const stepY = () => {
    for (let cy = Math.min(a.cy, b.cy); cy <= Math.max(a.cy, b.cy); cy++) carve(horizFirst ? b.cx : a.cx, cy);
  };
  stepX();
  stepY();
}

// ------------------------------------------------------------------- staff

function placeGuards(grid, p, rooms, entrance, rng, range, reachable, claim, isFree) {
  const guards = [];
  const homes = rooms.filter((r) => r !== entrance);
  if (!homes.length) return guards;

  for (let i = 0; i < p.guards; i++) {
    const home = homes[i % homes.length];
    const spot = spotIn(grid, home, rng, reachable, isFree) || { cx: home.cx, cy: home.cy };
    claim(spot);
    const at = centreOf(spot.cx, spot.cy);

    // A route through its own room and the two nearest ones: enough walking to
    // be somewhere else when you come back, short enough to be predictable —
    // which is what makes waiting for it a plan and not a gamble.
    const others = rooms
      .filter((r) => r !== home)
      .sort((a, b) => dist(a.cx, a.cy, home.cx, home.cy) - dist(b.cx, b.cy, home.cx, home.cy))
      .slice(0, 2 + Math.floor(rng() * 2));
    const route = [{ cx: home.cx, cy: home.cy }, ...others.map((r) => ({ cx: r.cx, cy: r.cy }))];

    guards.push({
      id: `g${i}`,
      x: at.x,
      y: at.y,
      hp: p.guardHp,
      maxHp: p.guardHp,
      facing: rng() * Math.PI * 2,
      gun: guardGun(p.tier, i),
      ammo: Infinity,
      cool: 0,
      aim: 0,
      state: 'patrol',
      alert: 0,
      route,
      leg: i % route.length,
      wait: 0,
      goal: null,
      lost: 0,
      home,
      dead: false,
      vx: 0,
      vy: 0,
      slip: 0,
      slipX: 0,
      slipY: 0,
      sawStamp: -1,
    });
  }
  return guards;
}

function spotIn(grid, room, rng, reachable, isFree) {
  for (let tries = 0; tries < 24; tries++) {
    const cx = room.x + Math.floor(rng() * room.w);
    const cy = room.y + Math.floor(rng() * room.h);
    if (grid.solid(cx, cy) || !reachable(cx, cy)) continue;
    if (!isFree({ cx, cy })) continue;
    return { cx, cy };
  }
  return null;
}

// ------------------------------------------------------------ wall fittings

/**
 * Every place something can be bolted: a walkable cell with a wall beside it.
 * The fitting sits on that wall and looks the other way, into the room.
 */
function wallMounts(grid, reachable) {
  const out = [];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let cy = 1; cy < grid.rows - 1; cy++) {
    for (let cx = 1; cx < grid.cols - 1; cx++) {
      if (grid.solid(cx, cy) || !reachable(cx, cy)) continue;
      for (const [dx, dy] of dirs) {
        if (!grid.solid(cx + dx, cy + dy)) continue;
        const c = centreOf(cx, cy);
        out.push({
          cx, cy,
          x: c.x + dx * TILE * 0.42,
          y: c.y + dy * TILE * 0.42,
          // it looks away from the wall it is screwed to
          facing: Math.atan2(-dy, -dx),
          kind: grid.at(cx, cy),
        });
      }
    }
  }
  return out;
}

function placeCameras(p, mounts, vaultRoom, entrance, rng) {
  const inRoom = (m, r) => m.cx >= r.x && m.cx < r.x + r.w && m.cy >= r.y && m.cy < r.y + r.h;
  // corridors and the vault first: a camera in a corridor closes a route, one
  // in the middle of a wide room is walked around
  const pool = mounts
    .filter((m) => !inRoom(m, entrance))
    .sort((a, b) => score(b) - score(a));
  function score(m) {
    return (m.kind === HALL ? 2 : 0) + (inRoom(m, vaultRoom) ? 1.5 : 0) + rng();
  }

  const out = [];
  for (const m of pool) {
    if (out.length >= p.cameras) break;
    if (out.some((c) => dist(c.x, c.y, m.x, m.y) < TILE * 3.4)) continue;
    out.push({
      id: `c${out.length}`,
      x: m.x,
      y: m.y,
      base: m.facing,
      facing: m.facing,
      sweep: rng() * Math.PI * 2,
      range: p.cameraRange,
      lock: 0,
      dead: false,
    });
  }
  return out;
}

function placeAlarms(p, mounts, cameras, entrance, rng) {
  const inEntrance = (m) =>
    m.cx >= entrance.x && m.cx < entrance.x + entrance.w && m.cy >= entrance.y && m.cy < entrance.y + entrance.h;
  const pool = mounts.filter((m) => !inEntrance(m)).sort(() => rng() - 0.5);
  const out = [];
  for (const m of pool) {
    if (out.length >= p.alarms) break;
    if (out.some((a) => dist(a.x, a.y, m.x, m.y) < TILE * 5)) continue;
    if (cameras.some((c) => dist(c.x, c.y, m.x, m.y) < TILE * 1.2)) continue;
    out.push({ id: `a${out.length}`, x: m.x, y: m.y, facing: m.facing, dead: false, pulled: 0 });
  }
  return out;
}

// -------------------------------------------------------------------- loot

function placeItems(p, free, rooms, entrance, vaultRoom, rng, pick, isFree, claim) {
  const items = [];
  const away = free.filter(
    (c) => isFree(c) && !(c.cx >= entrance.x && c.cx < entrance.x + entrance.w && c.cy >= entrance.y && c.cy < entrance.y + entrance.h)
  );
  const take = () => {
    for (let i = 0; i < 30; i++) {
      const c = away[Math.floor(rng() * away.length)];
      if (c && isFree(c)) {
        claim(c);
        return centreOf(c.cx, c.cy);
      }
    }
    return null;
  };

  const guns = lootGuns(p.tier);
  for (let i = 0; i < p.guns; i++) {
    const at = take();
    if (!at) break;
    const id = pick(guns);
    items.push({ kind: 'gun', gun: id, ammo: droppedAmmo(id, rng, 0.9), x: at.x, y: at.y, taken: false });
  }
  for (let i = 0; i < p.medkits; i++) {
    const at = take();
    if (!at) break;
    items.push({ kind: 'medkit', heal: 34, x: at.x, y: at.y, taken: false });
  }
  for (let i = 0; i < p.loot; i++) {
    const at = take();
    if (!at) break;
    const gx = Math.floor(at.x / TILE);
    const gy = Math.floor(at.y / TILE);
    const inVault =
      gx >= vaultRoom.x && gx < vaultRoom.x + vaultRoom.w && gy >= vaultRoom.y && gy < vaultRoom.y + vaultRoom.h;
    items.push({
      kind: 'loot',
      value: Math.round((260 + rng() * 420) * (1 + p.floor * 0.22) * (inVault ? 1.8 : 1)),
      x: at.x,
      y: at.y,
      taken: false,
    });
  }
  return items;
}

/** What each kind of room is furnished with, and what its floor is made of. */
const FURNISHING = {
  lobby: { floor: 'marble', props: ['counter', 'plant', 'bench', 'rug'] },
  office: { floor: 'wood', props: ['desk', 'chair', 'cabinet', 'plant'] },
  hall: { floor: 'marble', props: ['bench', 'plant', 'rug'] },
  records: { floor: 'lino', props: ['cabinet', 'cabinet', 'desk', 'crate'] },
  security: { floor: 'lino', props: ['desk', 'monitor', 'cabinet', 'chair'] },
  vault: { floor: 'gold', props: ['crate', 'crate', 'plate'] },
};

/**
 * The furniture. None of it blocks anything — a bank that is
 * furniture-and-physics is a different game, and a guard who has to path round
 * a chair is a bug factory. What it has to do is say what the room *is*: a
 * counter and a plant read as a lobby, four cabinets read as records, and a
 * room with neither reads as a grey rectangle.
 */
function decorate(rooms, rng) {
  const props = [];
  for (const r of rooms) {
    const kit = FURNISHING[r.kind] || FURNISHING.office;
    r.floor = kit.floor;
    const n = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      const kind = kit.props[Math.floor(rng() * kit.props.length) % kit.props.length];
      // pushed towards the walls, which is where furniture lives and where it
      // does not sit in the middle of the only route through the room
      const edge = rng() < 0.7;
      const along = rng();
      const side = Math.floor(rng() * 4);
      const cx = edge && side < 2 ? (side === 0 ? 0.7 : r.w - 0.7) : 0.7 + along * Math.max(0.1, r.w - 1.4);
      const cy = edge && side >= 2 ? (side === 2 ? 0.7 : r.h - 0.7) : 0.7 + rng() * Math.max(0.1, r.h - 1.4);
      props.push({
        kind,
        x: (r.x + cx) * TILE,
        y: (r.y + cy) * TILE,
        a: side < 2 ? Math.PI / 2 : 0,
        tone: rng(),
        size: 0.85 + rng() * 0.4,
      });
    }
  }
  return props;
}
