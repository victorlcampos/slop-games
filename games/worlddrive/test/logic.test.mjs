// World Drive's test, in Node, with no browser and no map server.
//
// The game beside this one is checked in a browser for the things that only
// break there — the menu, the language of the error card, a load with the line
// cut. What it never does is drive: on a runner with no GPU a frame costs a
// large fraction of a second, and holding the throttle measures the machine
// (see CLAUDE.md, section 6).
//
// The car itself, though, is arithmetic. So is the projection that turns a
// latitude into a metre, and so is the street index that answers "which road am
// I on". They import straight into Node and they are what a maintenance change
// is likely to break, so they are tested here — in milliseconds, offline.

import { scenario, check, run } from 'slopkit/testing';
import * as THREE from 'three';

import { mercX, mercY, invMercX, invMercY, lon2tx, lat2ty, makeProjection } from '../src/geo.js';
import { RoadIndex } from '../src/roads.js';
import { Car } from '../src/car.js';
import { HALF } from '../src/world.js';

// ------------------------------------------------------------- projections

scenario('a place survives the round trip through the projection', () => {
  const places = [
    { lat: -22.96888, lon: -43.18647 },   // Rio
    { lat: 37.7749, lon: -122.4194 },     // San Francisco
    { lat: 35.6812, lon: 139.7671 },      // Tokyo
    { lat: 0, lon: 0 },
  ];
  for (const p of places) {
    const backLon = invMercX(mercX(p.lon));
    const backLat = invMercY(mercY(p.lat));
    check(Math.abs(backLon - p.lon) < 1e-9, `${p.lon} came back as ${backLon}`);
    check(Math.abs(backLat - p.lat) < 1e-9, `${p.lat} came back as ${backLat}`);
  }
});

scenario('a metre in the game is a metre on the ground, at any latitude', () => {
  // Web Mercator stretches away from the equator; the projection divides that
  // back out. Getting the factor upside down puts Tokyo's streets kilometres
  // from the car, and the game would load a world with nothing in it.
  for (const [name, lat, lon] of [['Rio', -22.96888, -43.18647], ['Tokyo', 35.6812, 139.7671], ['Quito', -0.18, -78.47]]) {
    const proj = makeProjection(lat, lon);
    const [x, z] = proj.toLocal(lat, lon);
    check(Math.abs(x) < 1e-6 && Math.abs(z) < 1e-6, `${name} is not at its own origin`);

    // one degree of latitude is ~111 km of real ground, everywhere
    const [, northZ] = proj.toLocal(lat + 1, lon);
    check(Math.abs(-northZ - 111000) < 2000, `${name}: a degree north measured ${(-northZ / 1000).toFixed(1)} km`);
    check(northZ < 0, `${name}: north is not -z`);

    // and the trip back lands where it started
    const [backLat, backLon] = proj.toLatLon(240, -360);
    const [rx, rz] = proj.toLocal(backLat, backLon);
    check(Math.abs(rx - 240) < 0.01 && Math.abs(rz + 360) < 0.01,
      `${name}: (240, -360) came back as (${rx.toFixed(2)}, ${rz.toFixed(2)})`);
  }

  // the tile grid the terrain and the imagery are fetched on
  check(lon2tx(-180, 0) === 0 && Math.floor(lat2ty(85, 0)) === 0, 'zoom 0 is not a single tile');
  check(lon2tx(0, 10) > lon2tx(-90, 10), 'the tile column does not grow eastwards');
  check(lat2ty(0, 10) > lat2ty(45, 10), 'the tile row does not grow southwards');
});

// ---------------------------------------------------------- the road index

/** A cross of two named streets, plus an unnamed alley off to the side. */
function crossroads() {
  const idx = new RoadIndex();
  for (let i = -10; i < 10; i++) {
    idx.addSeg(i * 10, 0, (i + 1) * 10, 0, 'Rua Leste', true);       // east-west
    idx.addSeg(0, i * 10, 0, (i + 1) * 10, 'Avenida Norte', true);   // north-south
    idx.addSeg(200, i * 10, 200, (i + 1) * 10, null, true);          // the alley
  }
  return idx;
}

scenario('the index answers which street you are on', () => {
  const idx = crossroads();
  const east = idx.nearest(55, 2);
  check(east && east.name === 'Rua Leste', `at (55, 2) the answer was ${east && east.name}`);
  check(east.dist < 3, `it thinks that point is ${east.dist.toFixed(1)} m from the street`);

  const north = idx.nearest(1, -70);
  check(north && north.name === 'Avenida Norte', `at (1, -70) the answer was ${north && north.name}`);

  // the two streets run at right angles, and the heading follows the segment
  const turn = Math.abs(east.heading - north.heading) % Math.PI;
  check(Math.abs(turn - Math.PI / 2) < 0.01, `the two headings differ by ${turn.toFixed(2)} rad`);
});

scenario('out of range it says nothing instead of guessing', () => {
  const idx = crossroads();
  check(idx.nearest(600, 600, 50) === null, 'it found a street 800 m away inside a 50 m radius');
  check(idx.nearest(600, 600, 2000) !== null, 'with the radius open it found nothing at all');

  // `namedOnly` is what keeps "you are on undefined" off the HUD
  const alley = idx.nearest(200, 5, 30);
  check(alley && !alley.name, 'the unnamed alley was not the nearest thing to itself');
  check(idx.nearest(200, 5, 30, true, true) === null,
    'asking for a NAMED street returned the unnamed alley');
  const named = idx.nearest(200, 5, 400, true, true);
  check(named && named.name, 'widening the search for a named street found none');
});

// ------------------------------------------------------------------ the car

/** A flat, empty world: the car is the thing under test, not the terrain. */
const openRoad = {
  half: 40000,
  heightAt: () => 0,
  normalAt: () => new THREE.Vector3(0, 1, 0),
  slopeAt: () => [0, 0],
  collision: { collide: () => [] },
};

const drive = (car, seconds, input, world = openRoad) => {
  for (let t = 0; t < seconds; t += 1 / 60) car.update(1 / 60, input, world);
};

const kmh = (car) => car.vF * 3.6;

scenario('the throttle moves the car, and it settles at a top speed', () => {
  const car = new Car();
  car.place(0, 0, 0, openRoad);
  check(car.vF === 0, 'it was already moving when it was placed');

  drive(car, 3, { throttle: 1, steer: 0 });
  check(kmh(car) > 40, `three seconds of throttle reached ${kmh(car).toFixed(0)} km/h`);

  drive(car, 60, { throttle: 1, steer: 0 });
  // the clamp in the car is 46 m/s (~165 km/h); drag settles it around 110,
  // which is the number that changes if somebody touches the engine or the drag
  const top = kmh(car);
  check(top > 100, `flat out it only does ${top.toFixed(0)} km/h`);
  check(top < 165, `flat out it does ${top.toFixed(0)} km/h — past the car's own clamp`);
  check(car.z < 0, 'heading 0 is north, and it drove the other way');
});

scenario('the brake stops it, and it does not roll away on its own', () => {
  const car = new Car();
  car.place(0, 0, 0, openRoad);
  drive(car, 8, { throttle: 1, steer: 0 });
  const cruising = kmh(car);

  // held past the stop, the brake becomes reverse — that is the same key
  drive(car, 2, { throttle: -1, steer: 0 });
  check(kmh(car) < cruising * 0.1, `braking from ${cruising.toFixed(0)} left it at ${kmh(car).toFixed(0)} km/h`);
  check(car.vF < 0, 'holding the brake past the stop never engaged reverse');

  drive(car, 15, { throttle: 0, steer: 0 });
  check(car.vF === 0, `with no input it keeps rolling at ${kmh(car).toFixed(2)} km/h`);
});

scenario('the wheel only turns the car while it is moving', () => {
  const still = new Car();
  still.place(0, 0, 0, openRoad);
  drive(still, 2, { throttle: 0, steer: 1 });
  check(Math.abs(still.heading) < 1e-6, `standing still it spun ${still.heading.toFixed(3)} rad`);

  const moving = new Car();
  moving.place(0, 0, 0, openRoad);
  drive(moving, 3, { throttle: 1, steer: 0 });
  const straight = moving.heading;
  drive(moving, 2, { throttle: 1, steer: 1 });
  check(Math.abs(moving.heading - straight) > 0.3,
    `two seconds of full lock turned it ${(moving.heading - straight).toFixed(2)} rad`);
});

scenario('the world has an edge, and the car cannot leave it', () => {
  // the real one: the loaded square is HALF metres from the middle to a side
  const walled = { ...openRoad, half: HALF };
  const car = new Car();
  car.place(0, HALF - 60, Math.PI, walled);      // pointed at the south edge
  drive(car, 40, { throttle: 1, steer: 0 }, walled);
  check(Math.abs(car.z) <= HALF, `it ended up ${car.z.toFixed(0)} m out, past the edge at ${HALF}`);
  check(Math.abs(car.x) <= HALF, `it ended up ${car.x.toFixed(0)} m out sideways`);
});

await run('world drive — logic');
