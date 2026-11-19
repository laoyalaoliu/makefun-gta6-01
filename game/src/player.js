// The player on foot: WASD movement with sprint, a punch that lands on
// citizens and car panels, and getting into and out of cars — the enter key
// near any car, parked or (bravely) moving, which is where the crime starts.

import {
  ENTER_CAR_RANGE, PLAYER_MAX_HEALTH, PLAYER_RADIUS, PLAYER_SPRINT_SPEED,
  PLAYER_WALK_SPEED, PUNCH_RANGE,
} from './config.js';
import { collideCircleWithBuildings } from './city.js';
import { clamp, distance } from './random.js';
import { addPopup, addShake, spawnCrashSparks } from './effects.js';
import { knockDownPedestrian } from './pedestrians.js';
import { commitCrime } from './wanted.js';

export function createPlayer(x, y) {
  return {
    x, y,
    vx: 0, vy: 0,
    angle: -Math.PI / 2,
    radius: PLAYER_RADIUS,
    health: PLAYER_MAX_HEALTH,
    car: null,
    punchTime: 0,
    punchCooldown: 0,
    walkPhase: 0,
    hurtFlash: 0,
  };
}

/** On-foot movement, building collision and the punch, for one step. */
export function updatePlayerOnFoot(game, input, dt) {
  const player = game.player;
  const axes = input.moveAxes();
  const sprinting = input.isHeld('ShiftLeft', 'ShiftRight');
  const speed = sprinting ? PLAYER_SPRINT_SPEED : PLAYER_WALK_SPEED;
  let mx = axes.x;
  let my = axes.y;
  const len = Math.sqrt(mx * mx + my * my);
  if (len > 0) {
    mx /= len;
    my /= len;
    player.angle = Math.atan2(my, mx);
    player.walkPhase += dt * (sprinting ? 13 : 9);
  }
  player.vx = mx * speed;
  player.vy = my * speed;
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  const hit = collideCircleWithBuildings(game.city, player.x, player.y, player.radius, player.vx, player.vy);
  player.x = hit.x;
  player.y = hit.y;

  player.punchCooldown = Math.max(0, player.punchCooldown - dt);
  player.punchTime = Math.max(0, player.punchTime - dt);
  player.hurtFlash = Math.max(0, player.hurtFlash - dt);
  if (input.wasPressed('KeyF', 'KeyJ') && player.punchCooldown <= 0) {
    player.punchTime = 0.26;
    player.punchCooldown = 0.42;
    game.audio.punch();
    resolvePunch(game);
  }
}

/** What the fist connects with: the nearest citizen or car panel in front. */
function resolvePunch(game) {
  const player = game.player;
  const handX = player.x + Math.cos(player.angle) * PUNCH_RANGE;
  const handY = player.y + Math.sin(player.angle) * PUNCH_RANGE;
  let bestPed = null;
  let bestDist = PUNCH_RANGE + 12;
  for (const ped of game.pedestrians) {
    if (ped.state === 'down') continue;
    const d = distance(handX, handY, ped.x, ped.y);
    if (d < bestDist) { bestDist = d; bestPed = ped; }
  }
  if (bestPed) {
    knockDownPedestrian(bestPed, game.time);
    commitCrime(game, 'punchPedestrian');
    addPopup(game.effects, bestPed.x, bestPed.y - 18, 'ASSAULT!', '#ff5d5d');
    spawnCrashSparks(game.effects, bestPed.x, bestPed.y, 0.2);
    return;
  }
  for (const car of game.cars) {
    if (distance(handX, handY, car.x, car.y) < car.radius + 10) {
      car.damage = Math.min(100, car.damage + 4);
      commitCrime(game, 'punchCar');
      addShake(game.effects, 1.5);
      spawnCrashSparks(game.effects, handX, handY, 0.25);
      return;
    }
  }
}

/** E key: climb into the nearest car, or climb out of the current one. */
export function tryEnterExitCar(game) {
  const player = game.player;
  if (player.car) {
    const car = player.car;
    // Step out on the left side of the car.
    const sideX = car.x + Math.cos(car.angle - Math.PI / 2) * (car.type.width + 16);
    const sideY = car.y + Math.sin(car.angle - Math.PI / 2) * (car.type.width + 16);
    const placed = collideCircleWithBuildings(game.city, sideX, sideY, player.radius, 0, 0);
    player.x = placed.x;
    player.y = placed.y;
    player.vx = 0;
    player.vy = 0;
    car.driver = null;
    player.car = null;
    game.audio.click();
    return;
  }
  let best = null;
  let bestDist = ENTER_CAR_RANGE;
  for (const car of game.cars) {
    if (car.kind === 'police') continue;
    const d = distance(player.x, player.y, car.x, car.y);
    if (d < bestDist + car.radius * 0.4) { bestDist = d; best = car; }
  }
  if (!best) return;
  player.car = best;
  best.driver = 'player';
  best.stolen = true;
  player.x = best.x;
  player.y = best.y;
  commitCrime(game, 'carjack');
  addPopup(game.effects, best.x, best.y - 30, 'VEHICLE STOLEN', '#ffd34d');
  game.audio.click();
}

/** While driving, the on-foot body rides at the car's position. */
export function syncPlayerToCar(game) {
  const player = game.player;
  if (!player.car) return;
  player.x = player.car.x;
  player.y = player.car.y;
  player.angle = player.car.angle;
  player.hurtFlash = Math.max(0, player.hurtFlash - 1 / 60);
}
