// Fetching and parsing OpenStreetMap data through the Overpass API
import { fetchWithTimeout, localized } from './net.js';
import { clamp, hashStr } from './geo.js';
import { t } from './i18n.js';

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const HIGHWAYS = 'motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|road|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link|pedestrian|footway|path|cycleway|track|steps';

function buildQuery({ s, w, n, e }) {
  const bb = `(${s.toFixed(6)},${w.toFixed(6)},${n.toFixed(6)},${e.toFixed(6)})`;
  return `[out:json][timeout:25];(
way["highway"~"^(${HIGHWAYS})$"]${bb};
way["building"]${bb};
relation["building"]["type"="multipolygon"]${bb};
node["natural"="tree"]${bb};
way["leisure"~"^(park|garden)$"]${bb};
way["landuse"~"^(forest|grass|meadow|recreation_ground|village_green|cemetery)$"]${bb};
way["natural"~"^(wood|scrub)$"]${bb};
);out geom;`;
}

// onProgress(bytesReceived, note)
export async function fetchOSM(bbox, onProgress) {
  const body = 'data=' + encodeURIComponent(buildQuery(bbox));
  let lastErr = null;
  for (let round = 1; round <= 2; round++) {
    for (let i = 0; i < ENDPOINTS.length; i++) {
      const url = ENDPOINTS[i];
      // the note reaches the loading screen, so it goes through the dictionary
      const tag = t('load.mirror', { i: i + 1, n: ENDPOINTS.length }) + (round > 1 ? t('load.retry') : '');
      try {
        if (onProgress) onProgress(0, tag);
        const res = await fetchWithTimeout(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        }, 30000);
        if (!res.ok) throw new Error('Overpass HTTP ' + res.status);
        // stream so progress can be reported in bytes
        const reader = res.body && res.body.getReader ? res.body.getReader() : null;
        if (!reader) {
          const j = await res.json();
          return parseOSM(j);
        }
        const chunks = [];
        let received = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.length;
          if (onProgress) onProgress(received);
        }
        const buf = new Uint8Array(received);
        let off = 0;
        for (const c of chunks) { buf.set(c, off); off += c.length; }
        const j = JSON.parse(new TextDecoder().decode(buf));
        return parseOSM(j);
      } catch (e) {
        lastErr = e;
      }
    }
  }
  throw localized('load.overpassBusy', { detail: (lastErr && lastErr.message) || '?' });
}

const CAR_KINDS = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'service', 'road', 'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link']);

function roadWidth(hw, tags) {
  const lanes = parseFloat(tags.lanes);
  const base = {
    motorway: 11, trunk: 10, primary: 9, secondary: 8, tertiary: 7,
    unclassified: 5.5, residential: 5.5, living_street: 5, service: 3.5, road: 5.5,
    motorway_link: 5.5, trunk_link: 5.5, primary_link: 5.5, secondary_link: 5, tertiary_link: 5,
    pedestrian: 4, footway: 1.8, path: 1.6, cycleway: 2, track: 2.8, steps: 1.8,
  }[hw] || 5;
  if (isFinite(lanes) && lanes > 0 && CAR_KINDS.has(hw)) return clamp(lanes * 3.1, 3, 24);
  return base;
}

function buildingHeight(tags, id) {
  let h = parseFloat(String(tags.height || '').replace(',', '.'));
  if (!isFinite(h)) {
    const lv = parseFloat(tags['building:levels']);
    if (isFinite(lv) && lv > 0) h = lv * 3.1 + 1;
  }
  if (!isFinite(h)) h = 5.5 + (hashStr(id) % 90) / 10; // a deterministic 5.5..14.5m
  return clamp(h, 2.6, 500);
}

function closeRing(pts) {
  if (pts.length < 3) return null;
  const a = pts[0], b = pts[pts.length - 1];
  const closed = Math.abs(a.lat - b.lat) < 1e-7 && Math.abs(a.lon - b.lon) < 1e-7;
  const ring = closed ? pts.slice(0, -1) : pts.slice();
  return ring.length >= 3 ? ring : null;
}

// Builds rings from way fragments (outer members of a multipolygon)
function assembleRings(segments) {
  const segs = segments.filter(s => s && s.length >= 2).map(s => s.slice());
  const rings = [];
  const key = p => p.lat.toFixed(6) + ',' + p.lon.toFixed(6);
  let guard = segs.length * segs.length + 10;
  while (segs.length && guard-- > 0) {
    let cur = segs.pop();
    let extended = true;
    while (extended && guard-- > 0) {
      extended = false;
      if (key(cur[0]) === key(cur[cur.length - 1])) break; // fechou
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i];
        if (key(s[0]) === key(cur[cur.length - 1])) { cur = cur.concat(s.slice(1)); segs.splice(i, 1); extended = true; break; }
        if (key(s[s.length - 1]) === key(cur[cur.length - 1])) { cur = cur.concat(s.slice(0, -1).reverse()); segs.splice(i, 1); extended = true; break; }
        if (key(s[s.length - 1]) === key(cur[0])) { cur = s.slice(0, -1).concat(cur); segs.splice(i, 1); extended = true; break; }
        if (key(s[0]) === key(cur[0])) { cur = s.slice(1).reverse().concat(cur); segs.splice(i, 1); extended = true; break; }
      }
    }
    const ring = closeRing(cur);
    if (ring) rings.push(ring);
  }
  return rings;
}

export function parseOSM(data) {
  const roads = [], buildings = [], trees = [], greens = [];
  const els = (data && data.elements) || [];
  for (const el of els) {
    const tags = el.tags || {};
    if (el.type === 'node') {
      if (tags.natural === 'tree' && isFinite(el.lat)) trees.push({ lat: el.lat, lon: el.lon });
      continue;
    }
    if (el.type === 'way') {
      const geom = el.geometry;
      if (!geom || geom.length < 2) continue;
      const hw = tags.highway;
      if (hw) {
        if (tags.area === 'yes') continue;
        if ((tags.tunnel && tags.tunnel !== 'no') || tags.covered === 'yes') continue;
        const kind = CAR_KINDS.has(hw) ? 'car' : 'path';
        roads.push({
          id: el.id, pts: geom, tags, kind,
          name: tags.name || tags.ref || null,
          width: roadWidth(hw, tags),
          hw,
          oneway: tags.oneway === 'yes' || hw === 'motorway',
        });
      }
      if (tags.building) {
        const ring = closeRing(geom);
        if (ring) buildings.push({ id: el.id, rings: [ring], height: buildingHeight(tags, el.id) });
      } else if (tags.leisure || tags.landuse || tags.natural) {
        const ring = closeRing(geom);
        if (ring) greens.push({ ring });
      }
      continue;
    }
    if (el.type === 'relation' && tags.building && el.members) {
      const outers = el.members
        .filter(m => m.type === 'way' && (m.role === 'outer' || !m.role) && m.geometry)
        .map(m => m.geometry);
      const rings = assembleRings(outers);
      if (rings.length) buildings.push({ id: 'r' + el.id, rings, height: buildingHeight(tags, 'r' + el.id) });
    }
  }
  return { roads, buildings, trees, greens };
}
