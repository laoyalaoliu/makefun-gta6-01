// Port Solano itself: a deterministic coastal city built from the seed.
// A grid of avenues (vertical) and streets (horizontal), blocks of pastel
// buildings with neon signs between them, parking lots and palm plazas,
// a sandy beach, a pier and the sea along the south edge. Also the collision
// helpers every mover uses to stay out of the buildings.

import {
  BEACH_Y, CITY_MARGIN, PALETTE, ROAD_COLS, ROAD_HALF, ROAD_PITCH, ROAD_ROWS,
  WATER_Y, WORLD_HEIGHT, WORLD_WIDTH,
} from './config.js';
import { clamp } from './random.js';

const BUILDING_COLORS = ['#f2b8a0', '#f7d08a', '#a8d8c8', '#f49ac1', '#9fc7e8', '#e8e3a8', '#d9b8e8', '#ffb27a', '#bfe3b4', '#f2f0eb'];
const ROOF_COLORS = ['#c96f4a', '#a85751', '#7d8fa3', '#b98a5e', '#6f9a8d', '#8a6fa8'];
const SIGN_WORDS = ['HOTEL', 'CAFE', 'BAR', 'GYM', 'SHOP', 'DINER', 'CLUB', 'PIZZA', 'SUSHI', 'BOOKS', 'SPA', 'TACOS', 'HOTEL', 'LOUNGE'];
const SIGN_COLORS = ['#ff5da2', '#22d3ee', '#facc15', '#a3e635', '#fb7185', '#38bdf8', '#f97316'];
const DISTRICTS = ['Solano Pier', 'Downtown', 'The Marlin Strip', 'Harbor East', 'Vista Heights', 'Palm Quarter'];

/** Road centre lines: avenues run north-south, streets run east-west. */
export function avenueX(index) { return CITY_MARGIN + index * ROAD_PITCH; }
export function streetY(index) { return CITY_MARGIN + index * ROAD_PITCH; }

export function generateCity(rng) {
  const avenues = [];
  const streets = [];
  for (let i = 0; i < ROAD_COLS; i += 1) avenues.push(avenueX(i));
  for (let j = 0; j < ROAD_ROWS; j += 1) streets.push(streetY(j));
  const intersections = [];
  for (const x of avenues) for (const y of streets) intersections.push({ x, y });

  const buildings = [];
  const lots = [];
  const palms = [];
  const lamps = [];
  const props = [];

  // Blocks sit in the cells between roads (and in the margin ring outside).
  const cellsX = [];
  let prevRight = -60;
  for (const x of avenues) {
    cellsX.push({ left: prevRight, right: x - ROAD_HALF });
    prevRight = x + ROAD_HALF;
  }
  cellsX.push({ left: prevRight, right: WORLD_WIDTH + 60 });
  const cellsY = [];
  let prevBottom = -60;
  for (const y of streets) {
    cellsY.push({ top: prevBottom, bottom: y - ROAD_HALF });
    prevBottom = y + ROAD_HALF;
  }
  cellsY.push({ top: prevBottom, bottom: BEACH_Y - 30 });

  for (const cellX of cellsX) {
    for (const cellY of cellsY) {
      const w = cellX.right - cellX.left;
      const h = cellY.bottom - cellY.top;
      if (w < 90 || h < 90) continue;
      const roll = rng.next();
      if (roll < 0.14) {
        // Parking lot: asphalt pad with a few palms at the corners.
        lots.push({ x: cellX.left + 8, y: cellY.top + 8, w: w - 16, h: h - 16 });
        palms.push({ x: cellX.left + 22, y: cellY.top + 22, s: rng.range(0.8, 1.2) });
        palms.push({ x: cellX.right - 22, y: cellY.bottom - 22, s: rng.range(0.8, 1.2) });
        continue;
      }
      if (roll < 0.24) {
        // Palm plaza: open ground, palms and benches, no collision.
        lots.push({ x: cellX.left + 8, y: cellY.top + 8, w: w - 16, h: h - 16, plaza: true });
        for (let k = 0; k < 5; k += 1) {
          palms.push({ x: rng.range(cellX.left + 24, cellX.right - 24), y: rng.range(cellY.top + 24, cellY.bottom - 24), s: rng.range(0.8, 1.3) });
        }
        continue;
      }
      // One to four buildings per block with a sidewalk margin.
      const cols = w > 300 ? 2 : 1;
      const rows = h > 300 ? 2 : 1;
      const innerW = (w - 36) / cols;
      const innerH = (h - 36) / rows;
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          if (rng.chance(0.12)) continue;
          const bw = innerW * rng.range(0.72, 0.94);
          const bh = innerH * rng.range(0.72, 0.94);
          const bx = cellX.left + 18 + cx * innerW + (innerW - bw) / 2;
          const by = cellY.top + 18 + cy * innerH + (innerH - bh) / 2;
          const signed = rng.chance(0.55);
          buildings.push({
            x: bx, y: by, w: bw, h: bh,
            color: rng.pick(BUILDING_COLORS),
            roof: rng.pick(ROOF_COLORS),
            sign: signed ? rng.pick(SIGN_WORDS) : null,
            signColor: rng.pick(SIGN_COLORS),
            floors: rng.int(2, 7),
          });
        }
      }
      if (rng.chance(0.5)) palms.push({ x: cellX.left + 16, y: cellY.bottom - 16, s: rng.range(0.8, 1.1) });
    }
  }

  // Beach palms and lamps along the shore and the avenues.
  for (let x = 60; x < WORLD_WIDTH - 40; x += rng.range(90, 170)) {
    palms.push({ x, y: BEACH_Y + rng.range(14, 60), s: rng.range(0.9, 1.4) });
  }
  for (const x of avenues) {
    for (let y = 120; y < BEACH_Y; y += 210) lamps.push({ x: x - ROAD_HALF - 7, y });
  }
  // Dock crates near the south-east harbour.
  for (let i = 0; i < 10; i += 1) {
    props.push({ x: rng.range(WORLD_WIDTH - 420, WORLD_WIDTH - 80), y: rng.range(BEACH_Y - 130, BEACH_Y - 50), w: rng.range(22, 38), h: rng.range(18, 30), color: rng.pick(['#c96f4a', '#5e8ca8', '#7fae6d', '#b98a5e']) });
  }

  return {
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
    avenues,
    streets,
    intersections,
    buildings,
    lots,
    palms,
    lamps,
    props,
    beachY: BEACH_Y,
    waterY: WATER_Y,
    districts: DISTRICTS,
    palette: PALETTE,
  };
}

/** True when the point is on asphalt (a road or a parking lot). */
export function isOnRoad(city, x, y) {
  if (y >= city.beachY) return false;
  for (const ax of city.avenues) if (Math.abs(x - ax) <= ROAD_HALF) return true;
  for (const sy of city.streets) if (Math.abs(y - sy) <= ROAD_HALF) return true;
  return false;
}

/** A point on the sidewalk ring around the intersection at (ix, iy), corner 0..3. */
export function sidewalkPoint(city, ix, iy, corner) {
  const off = ROAD_HALF + 16;
  const dx = corner % 2 === 0 ? -off : off;
  const dy = corner < 2 ? -off : off;
  return { x: clamp(ix + dx, 30, city.width - 30), y: clamp(iy + dy, 30, city.beachY - 20) };
}

/**
 * Push a circle out of every building and prop it overlaps. Returns the
 * corrected position and the strongest impact speed into a wall (0 if none),
 * so callers can turn hard wall hits into damage, sparks and crime.
 */
export function collideCircleWithBuildings(city, x, y, radius, vx, vy) {
  let impact = 0;
  const solids = city.buildings;
  for (let i = 0; i < solids.length; i += 1) {
    const b = solids[i];
    const nearestX = clamp(x, b.x, b.x + b.w);
    const nearestY = clamp(y, b.y, b.y + b.h);
    const dx = x - nearestX;
    const dy = y - nearestY;
    const d2 = dx * dx + dy * dy;
    if (d2 >= radius * radius) continue;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      const push = radius - d;
      x += (dx / d) * push;
      y += (dy / d) * push;
      const into = -(vx * (dx / d) + vy * (dy / d));
      if (into > impact) impact = into;
    } else {
      // Centre inside the rect: push out along the smallest exit.
      const left = x - b.x;
      const right = b.x + b.w - x;
      const top = y - b.y;
      const bottom = b.y + b.h - y;
      const min = Math.min(left, right, top, bottom);
      if (min === left) { x = b.x - radius; impact = Math.max(impact, -vx); }
      else if (min === right) { x = b.x + b.w + radius; impact = Math.max(impact, vx); }
      else if (min === top) { y = b.y - radius; impact = Math.max(impact, -vy); }
      else { y = b.y + b.h + radius; impact = Math.max(impact, vy); }
    }
  }
  // The sea is a wall for everyone but swimmers (there are none).
  if (y > city.waterY + 26) { y = city.waterY + 26; impact = Math.max(impact, Math.abs(vy)); }
  x = clamp(x, 14, city.width - 14);
  y = clamp(y, 14, city.height - 14);
  return { x, y, impact };
}

/** Random point on a sidewalk somewhere in the city, for pedestrian walks. */
export function randomSidewalkPoint(city, rng) {
  const ix = rng.pick(city.avenues);
  const iy = rng.pick(city.streets);
  return sidewalkPoint(city, ix, iy, rng.int(0, 3));
}
