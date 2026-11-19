// Pedestrians: Port Solano citizens strolling the sidewalks in swimwear and
// shirts. They amble between sidewalk points, sprint away from danger
// (a fast car bearing down, a thrown punch, a crash nearby) and fall when
// hit — which is where the serious wanted heat comes from.

import { randomSidewalkPoint } from './city.js';
import { clamp, distance } from './random.js';

const SHIRT_COLORS = ['#ff6b6b', '#ffd93d', '#6bcbff', '#95e06b', '#f9f9f9', '#ff9ff3', '#54a0ff', '#feca57', '#ff9f43', '#c8d6e5'];
const SKIN_COLORS = ['#f2c09a', '#d99e6a', '#a06a3f', '#7a4a28', '#ffe0bd'];

export function createPedestrian(city, rng, x, y) {
  return {
    x, y,
    vx: 0, vy: 0,
    angle: rng.range(0, Math.PI * 2),
    speed: rng.range(38, 62),
    target: randomSidewalkPoint(city, rng),
    state: 'stroll', // 'stroll' | 'flee' | 'down'
    stateTime: 0,
    panicX: 0, panicY: 0,
    shirt: rng.pick(SHIRT_COLORS),
    skin: rng.pick(SKIN_COLORS),
    walkPhase: rng.range(0, 6),
    respawnAt: 0,
  };
}

export function createCrowd(city, rng, count) {
  const crowd = [];
  for (let i = 0; i < count; i += 1) {
    const point = randomSidewalkPoint(city, rng);
    crowd.push(createPedestrian(city, rng, point.x, point.y));
  }
  return crowd;
}

/** Danger check: fast nearby cars and fresh violence make a citizen run. */
function senseDanger(game, ped) {
  let danger = null;
  let bestDist = 90;
  for (const car of game.cars) {
    const speed = Math.sqrt(car.vx * car.vx + car.vy * car.vy);
    if (speed < 55) continue;
    const d = distance(ped.x, ped.y, car.x, car.y);
    if (d < bestDist) { bestDist = d; danger = car; }
  }
  if (game.player.punchTime > 0.12) {
    const d = distance(ped.x, ped.y, game.player.x, game.player.y);
    if (d < 80) danger = game.player;
  }
  return danger;
}

export function updatePedestrian(game, ped, dt, rng) {
  ped.stateTime += dt;
  if (ped.state === 'down') {
    ped.vx = 0;
    ped.vy = 0;
    return;
  }
  const danger = senseDanger(game, ped);
  if (danger && ped.state !== 'flee') {
    ped.state = 'flee';
    ped.stateTime = 0;
    ped.panicX = danger.x;
    ped.panicY = danger.y;
  }
  let tx;
  let ty;
  let speed;
  if (ped.state === 'flee') {
    const away = Math.atan2(ped.y - ped.panicY, ped.x - ped.panicX);
    tx = ped.x + Math.cos(away) * 120;
    ty = ped.y + Math.sin(away) * 120;
    speed = 165;
    if (ped.stateTime > 1.6 && !danger) {
      ped.state = 'stroll';
      ped.target = randomSidewalkPoint(game.city, rng);
    }
  } else {
    tx = ped.target.x;
    ty = ped.target.y;
    speed = ped.speed;
    if (distance(ped.x, ped.y, tx, ty) < 14) ped.target = randomSidewalkPoint(game.city, rng);
  }
  const wanted = Math.atan2(ty - ped.y, tx - ped.x);
  ped.angle = wanted;
  ped.vx = Math.cos(wanted) * speed;
  ped.vy = Math.sin(wanted) * speed;
  ped.x += ped.vx * dt;
  ped.y += ped.vy * dt;
  ped.walkPhase += dt * (speed / 9);
  ped.x = clamp(ped.x, 16, game.city.width - 16);
  ped.y = clamp(ped.y, 16, game.city.height - 16);
}

/** Knock a pedestrian down (car hit or punch). Returns true if newly downed. */
export function knockDownPedestrian(ped, gameTime) {
  if (ped.state === 'down') return false;
  ped.state = 'down';
  ped.stateTime = 0;
  ped.respawnAt = gameTime + 14;
  return true;
}

/** Downed citizens eventually get up somewhere quieter (or are taken away). */
export function recyclePedestrian(game, ped, rng) {
  const point = randomSidewalkPoint(game.city, rng);
  ped.x = point.x;
  ped.y = point.y;
  ped.state = 'stroll';
  ped.stateTime = 0;
  ped.target = randomSidewalkPoint(game.city, rng);
}
