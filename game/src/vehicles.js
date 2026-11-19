// Vehicles: car types, arcade driving physics with drift-ish grip, the
// traffic AI that follows the road grid, and the police pursuit AI.
// A car's motion is a velocity vector plus a heading; grip bleeds off the
// sideways part of the velocity, which is what makes handbrake-less drifts
// and powerslides feel right.

import { ROAD_HALF } from './config.js';
import { angleDelta, clamp } from './random.js';

export const CAR_TYPES = [
  { id: 'coupe', name: 'Solano Coupe', length: 46, width: 22, maxSpeed: 335, reverseSpeed: 110, accel: 265, brake: 430, grip: 7.5, steerRate: 2.6, colors: ['#e8452c', '#f2f0eb', '#2c6fe8', '#f5c518'] },
  { id: 'sedan', name: 'Marlin Sedan', length: 50, width: 23, maxSpeed: 285, reverseSpeed: 100, accel: 225, brake: 400, grip: 8.5, steerRate: 2.3, colors: ['#8a93a3', '#33404f', '#c8ccd4', '#5e7a5a'] },
  { id: 'pickup', name: 'Dune Pickup', length: 54, width: 25, maxSpeed: 255, reverseSpeed: 95, accel: 205, brake: 380, grip: 8, steerRate: 2.1, colors: ['#d97b2f', '#7a4a2b', '#4f7a8a', '#e8e3d8'] },
  { id: 'cab', name: 'Harbor Cab', length: 48, width: 23, maxSpeed: 270, reverseSpeed: 100, accel: 235, brake: 410, grip: 8.5, steerRate: 2.3, colors: ['#ffd21f'] },
  { id: 'sport', name: 'Vela Spider', length: 45, width: 22, maxSpeed: 395, reverseSpeed: 120, accel: 320, brake: 460, grip: 6.8, steerRate: 2.9, colors: ['#ff5da2', '#22d3ee', '#a3e635', '#f97316'] },
  { id: 'van', name: 'Cargo Van', length: 56, width: 26, maxSpeed: 235, reverseSpeed: 90, accel: 185, brake: 360, grip: 9, steerRate: 2.0, colors: ['#e8e3d8', '#9fb6c3', '#c3b299'] },
];

export const POLICE_TYPE = { id: 'police', name: 'PSPD Interceptor', length: 50, width: 23, maxSpeed: 360, reverseSpeed: 110, accel: 300, brake: 450, grip: 8.2, steerRate: 2.6, colors: ['#20304a'] };

let nextCarId = 1;

export function createCar(type, x, y, angle, kind, color) {
  return {
    id: nextCarId++,
    type,
    kind, // 'traffic' | 'parked' | 'police'
    x, y, angle,
    vx: 0, vy: 0,
    color: color || type.colors[0],
    radius: type.length * 0.46,
    damage: 0,
    driver: null, // 'player' | 'ai' | 'police' | null
    // Traffic AI state:
    dirX: Math.round(Math.cos(angle)),
    dirY: Math.round(Math.sin(angle)),
    lastIntersection: null,
    cruiseSpeed: type.maxSpeed * 0.42,
    stuckTime: 0,
    honkCooldown: 0,
    crimeCooldown: 0,
  };
}

export function carSpeed(car) {
  return Math.sqrt(car.vx * car.vx + car.vy * car.vy);
}

export function carForwardSpeed(car) {
  return car.vx * Math.cos(car.angle) + car.vy * Math.sin(car.angle);
}

/**
 * Advance one car's physics for a step. Control: throttle -1..1 (negative is
 * brake/reverse), steer -1..1, handbrake bool. Returns the lateral slip
 * ratio 0..1 so callers can smoke the tires and screech.
 */
export function updateCarPhysics(car, control, dt) {
  const type = car.type;
  const fwdX = Math.cos(car.angle);
  const fwdY = Math.sin(car.angle);
  let forward = car.vx * fwdX + car.vy * fwdY;
  let lateralX = car.vx - forward * fwdX;
  let lateralY = car.vy - forward * fwdY;

  // Steering turns harder with a bit of speed, and flips in reverse.
  const steerAuthority = clamp(Math.abs(forward) / 60, 0, 1) * (forward < -1 ? -1 : 1);
  car.angle += control.steer * type.steerRate * steerAuthority * dt * (control.handbrake ? 1.35 : 1);

  if (control.throttle > 0) {
    forward += type.accel * control.throttle * dt * (1 - Math.max(0, forward) / (type.maxSpeed * 1.12));
  } else if (control.throttle < 0) {
    if (forward > 12) forward += type.brake * control.throttle * dt;
    else forward += type.accel * 0.7 * control.throttle * dt * (1 - Math.max(0, -forward) / type.reverseSpeed);
  }
  // Rolling drag and air drag.
  forward -= forward * 0.55 * dt;
  if (Math.abs(forward) < 2 && control.throttle === 0) forward = 0;

  // Grip: bleed the sideways velocity (less with the handbrake = drift).
  const gripRate = control.handbrake ? 1.6 : type.grip;
  const bleed = Math.exp(-gripRate * dt);
  lateralX *= bleed;
  lateralY *= bleed;
  const lateralSpeed = Math.sqrt(lateralX * lateralX + lateralY * lateralY);

  const nfx = Math.cos(car.angle);
  const nfy = Math.sin(car.angle);
  car.vx = nfx * forward + lateralX;
  car.vy = nfy * forward + lateralY;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  return clamp(lateralSpeed / 130, 0, 1);
}

/** Point a car wants to reach when driving the grid in its current direction. */
function trafficTarget(city, car) {
  // Lane offset: keep right. Perpendicular of travel direction, to the right.
  const lane = ROAD_HALF * 0.42;
  const offX = -car.dirY * lane;
  const offY = car.dirX * lane;
  return { x: car.x + car.dirX * 130 + offX, y: car.y + car.dirY * 130 + offY, offX, offY };
}

/** At an intersection, maybe turn: mostly straight, sometimes left or right. */
function maybeTurnAtIntersection(city, car, rng) {
  for (const node of city.intersections) {
    const dx = car.x - node.x;
    const dy = car.y - node.y;
    if (dx * dx + dy * dy > 34 * 34) continue;
    if (car.lastIntersection === node) return;
    car.lastIntersection = node;
    const roll = rng.next();
    if (roll < 0.34) {
      // Turn left or right.
      const sign = roll < 0.17 ? 1 : -1;
      const oldX = car.dirX;
      car.dirX = -car.dirY * sign;
      car.dirY = oldX * sign;
    }
    return;
  }
  if (car.lastIntersection) {
    const dx = car.x - car.lastIntersection.x;
    const dy = car.y - car.lastIntersection.y;
    if (dx * dx + dy * dy > 90 * 90) car.lastIntersection = null;
  }
}

/** Is something slow or stopped close ahead of this car? Returns 0..1 urgency. */
export function trafficBlockAhead(game, car) {
  const aheadX = car.x + car.dirX * 58;
  const aheadY = car.y + car.dirY * 58;
  let urgency = 0;
  const consider = (x, y, radius) => {
    const dx = x - aheadX;
    const dy = y - aheadY;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < radius + 26) urgency = Math.max(urgency, 1 - d / (radius + 26));
  };
  for (const other of game.cars) {
    if (other === car) continue;
    consider(other.x, other.y, other.radius);
  }
  for (const ped of game.pedestrians) {
    if (ped.state !== 'down') consider(ped.x, ped.y, 10);
  }
  if (game.player.car === null) consider(game.player.x, game.player.y, 12);
  return urgency;
}

/** One traffic car's brain for a step: follow the grid, stop for trouble. */
export function updateTrafficCar(game, car, dt, rng) {
  maybeTurnAtIntersection(game.city, car, rng);
  const target = trafficTarget(game.city, car);
  const wanted = Math.atan2(target.y - car.y, target.x - car.x);
  const delta = angleDelta(car.angle, wanted);
  const steer = clamp(delta * 2.4, -1, 1);
  const block = trafficBlockAhead(game, car);
  let throttle = block > 0.25 ? -0.4 : 0.75;
  const speed = carSpeed(car);
  if (speed > car.cruiseSpeed) throttle = Math.min(throttle, 0);
  if (block > 0.05 && speed < 6 && throttle < 0) throttle = 0; // already stopped: hold, don't reverse into traffic
  car.honkCooldown = Math.max(0, car.honkCooldown - dt);
  if (block > 0.5 && car.honkCooldown <= 0) {
    car.honkCooldown = rng.range(1.5, 4);
    car.honked = true;
  } else car.honked = false;
  // Unstick: if barely moving while trying to go, jitter the steering.
  if (throttle > 0 && speed < 8) {
    car.stuckTime += dt;
    if (car.stuckTime > 2.2) {
      car.stuckTime = 0;
      car.dirX = -car.dirX;
      car.dirY = -car.dirY;
      car.lastIntersection = null;
    }
  } else car.stuckTime = 0;
  return updateCarPhysics(car, { throttle, steer, handbrake: false }, dt);
}

/** One police car's brain: intercept the player, ram when close. */
export function updatePoliceCar(game, car, dt) {
  const player = game.player;
  const px = player.car ? player.car.x : player.x;
  const py = player.car ? player.car.y : player.y;
  const pvx = player.car ? player.car.vx : 0;
  const pvy = player.car ? player.car.vy : 0;
  const dist = Math.sqrt((px - car.x) ** 2 + (py - car.y) ** 2);
  const lead = clamp(dist / 320, 0, 0.8);
  const tx = px + pvx * lead;
  const ty = py + pvy * lead;
  const wanted = Math.atan2(ty - car.y, tx - car.x);
  const delta = angleDelta(car.angle, wanted);
  const steer = clamp(delta * 2.8, -1, 1);
  let throttle = 1;
  // When the player is on foot and close, pull up beside them instead of running them down.
  if (!player.car && dist < 70) throttle = dist < 42 ? -0.2 : 0.25;
  if (Math.abs(delta) > 2.4 && carSpeed(car) > 60) throttle = -0.5; // overshot: brake and swing round
  return updateCarPhysics(car, { throttle, steer, handbrake: Math.abs(delta) > 1.6 && carSpeed(car) > 120 }, dt);
}

/** Spawn helper: a police interceptor on a road near (but not on) the player. */
export function findPoliceSpawn(city, rng, px, py) {
  let best = null;
  for (let tries = 0; tries < 24; tries += 1) {
    const node = rng.pick(city.intersections);
    const d = Math.sqrt((node.x - px) ** 2 + (node.y - py) ** 2);
    if (d > 330 && d < 720) { best = node; break; }
    if (!best || d > 300) best = node;
  }
  const angle = rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
  return { x: best.x, y: best.y, angle };
}
