// The living world: builds Port Solano and everything in it from the seed,
// then advances the whole simulation one step at a time — the player on foot
// or driving, traffic, police, crowds, collisions, crimes, missions, wanted
// heat, camera and sound. Rendering and menus live elsewhere; this is rules.

import { DAY_CYCLE_SECONDS, PLAYER_MAX_HEALTH } from './config.js';
import { generateCity, collideCircleWithBuildings, sidewalkPoint, avenueX, streetY } from './city.js';
import { createRandom, clamp, distance } from './random.js';
import { CAR_TYPES, carSpeed, createCar, updateCarPhysics, updatePoliceCar, updateTrafficCar } from './vehicles.js';
import { createCrowd, knockDownPedestrian, recyclePedestrian, updatePedestrian } from './pedestrians.js';
import { createPlayer, syncPlayerToCar, tryEnterExitCar, updatePlayerOnFoot } from './player.js';
import { commitCrime, createWanted, updateWanted } from './wanted.js';
import { createMissionState, updateMissions } from './missions.js';
import { addPopup, addShake, addSkidMark, createEffects, spawnCrashSparks, spawnTireSmoke, updateEffects } from './effects.js';
import { writeSave } from './savegame.js';

export function createGame(seed, save, audio) {
  const cityRng = createRandom(seed);
  const city = generateCity(cityRng);
  const rng = createRandom((seed ^ 0x9e3779b9) >>> 0);

  const spawn = sidewalkPoint(city, avenueX(1), streetY(4), 2);
  const player = createPlayer(spawn.x - 26, spawn.y + 6);

  const cars = [];
  // Traffic already rolling on the grid.
  for (let i = 0; i < 15; i += 1) {
    const node = rng.pick(city.intersections);
    const vertical = rng.chance(0.5);
    const dir = rng.chance(0.5) ? 1 : -1;
    const type = rng.pick(CAR_TYPES);
    const car = createCar(type, node.x + rng.range(-40, 40), node.y + rng.range(-40, 40), 0, 'traffic', rng.pick(type.colors));
    car.dirX = vertical ? 0 : dir;
    car.dirY = vertical ? dir : 0;
    car.angle = Math.atan2(car.dirY, car.dirX);
    car.driver = 'ai';
    car.cruiseSpeed = type.maxSpeed * rng.range(0.34, 0.5);
    cars.push(car);
  }
  // Parked cars in the lots and along the shore road — all stealable.
  const lotSpots = city.lots.filter((lot) => !lot.plaza);
  for (let i = 0; i < 13 && lotSpots.length; i += 1) {
    const lot = rng.pick(lotSpots);
    const type = rng.pick(CAR_TYPES);
    const car = createCar(
      type,
      clamp(rng.range(lot.x + 30, lot.x + lot.w - 30), 40, city.width - 40),
      clamp(rng.range(lot.y + 30, lot.y + lot.h - 30), 40, city.height - 40),
      rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]),
      'parked',
      rng.pick(type.colors),
    );
    cars.push(car);
  }
  // A sporty coupe waits near the pier spawn — the natural first steal.
  const starter = createCar(CAR_TYPES[4], avenueX(1) + 20, streetY(4) - 20, -Math.PI / 2, 'parked', '#ff5da2');
  cars.push(starter);

  const game = {
    seed,
    rng,
    city,
    player,
    cars,
    pedestrians: createCrowd(city, rng, 26),
    wanted: createWanted(),
    mission: createMissionState(city, save ? save.missionsDone : 0),
    missionsDone: save ? save.missionsDone : 0,
    cash: save ? save.cash : 60,
    effects: createEffects(),
    audio,
    time: 0,
    timeOfDay: 0.34, // golden late afternoon
    camera: { x: player.x, y: player.y },
    busted: false,
    wasted: false,
    storyComplete: false,
    screechCooldown: 0,
    saveProgress() { writeSave(game.cash, game.missionsDone); },
  };
  return game;
}

function damagePlayer(game, amount) {
  const player = game.player;
  player.health = Math.max(0, player.health - amount);
  player.hurtFlash = 0.35;
  if (player.health <= 0) game.wasted = true;
}

/** Building impacts for any car: sparks, damage, shake and a little heat. */
function resolveCarBuildings(game, car, isPlayerCar) {
  const hit = collideCircleWithBuildings(game.city, car.x, car.y, car.radius * 0.82, car.vx, car.vy);
  car.x = hit.x;
  car.y = hit.y;
  if (hit.impact > 55) {
    const strength = clamp(hit.impact / 320, 0, 1);
    car.vx *= 0.3;
    car.vy *= 0.3;
    car.damage = Math.min(100, car.damage + hit.impact * 0.05);
    spawnCrashSparks(game.effects, car.x, car.y, strength);
    if (isPlayerCar) {
      addShake(game.effects, 2 + strength * 8);
      game.audio.crash(strength);
      if (hit.impact > 150) damagePlayer(game, (hit.impact - 150) / 16);
      car.crimeCooldown = Math.max(0, car.crimeCooldown);
      if (car.buildingCrimeAt === undefined || game.time - car.buildingCrimeAt > 2.5) {
        car.buildingCrimeAt = game.time;
        commitCrime(game, 'hitBuilding');
      }
    }
  }
}

/** Circle collisions between every pair of cars, with momentum exchange. */
function resolveCarCarCollisions(game) {
  const cars = game.cars;
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const minDist = (a.radius + b.radius) * 0.82;
      const d2 = dx * dx + dy * dy;
      if (d2 >= minDist * minDist || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const ny = dy / d;
      const overlap = (minDist - d) / 2;
      a.x -= nx * overlap;
      a.y -= ny * overlap;
      b.x += nx * overlap;
      b.y += ny * overlap;
      const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rel < 0) {
        const impulse = -rel * 0.72;
        a.vx -= nx * impulse;
        a.vy -= ny * impulse;
        b.vx += nx * impulse;
        b.vy += ny * impulse;
        const strength = clamp(-rel / 300, 0, 1);
        spawnCrashSparks(game.effects, (a.x + b.x) / 2, (a.y + b.y) / 2, strength);
        const playerInvolved = game.player.car === a || game.player.car === b;
        const other = game.player.car === a ? b : a;
        if (playerInvolved) {
          addShake(game.effects, 1.5 + strength * 7);
          game.audio.crash(strength);
          a.damage = Math.min(100, a.damage + strength * 9);
          b.damage = Math.min(100, b.damage + strength * 9);
          if (strength > 0.16 && other.kind === 'traffic' && game.time - (other.lastHitCrimeAt || -9) > 1.6) {
            other.lastHitCrimeAt = game.time;
            commitCrime(game, 'hitCar');
          }
          if (strength > 0.5) damagePlayer(game, strength * 7);
        }
      }
    }
  }
}

/** Cars versus citizens, and cars versus the player on foot. */
function resolveCarPedestrianHits(game) {
  for (const car of game.cars) {
    const speed = carSpeed(car);
    if (speed < 26) continue;
    for (const ped of game.pedestrians) {
      if (ped.state === 'down') continue;
      if (distance(car.x, car.y, ped.x, ped.y) < car.radius + 9) {
        if (knockDownPedestrian(ped, game.time)) {
          spawnCrashSparks(game.effects, ped.x, ped.y, 0.4);
          if (game.player.car === car) {
            commitCrime(game, 'hitPedestrian');
            addPopup(game.effects, ped.x, ped.y - 24, 'PEDESTRIAN DOWN!', '#ff5d5d');
            addShake(game.effects, 3.5);
            game.audio.crash(0.5);
          }
        }
      }
    }
    // A car meeting the on-foot player hurts.
    const player = game.player;
    if (!player.car && car.driver !== 'player' && speed > 55) {
      if (distance(car.x, car.y, player.x, player.y) < car.radius + 10) {
        damagePlayer(game, 14 + speed * 0.03);
        player.x += car.vx * 0.06;
        player.y += car.vy * 0.06;
        addShake(game.effects, 5);
        game.audio.crash(0.6);
      }
    }
  }
}

/** Driving the player's car for one step, with smoke, skids and sound. */
function updatePlayerDriving(game, input, dt) {
  const car = game.player.car;
  const throttle = (input.isHeld('KeyW', 'ArrowUp') ? 1 : 0) - (input.isHeld('KeyS', 'ArrowDown') ? 1 : 0);
  const steer = (input.isHeld('KeyD', 'ArrowRight') ? 1 : 0) - (input.isHeld('KeyA', 'ArrowLeft') ? 1 : 0);
  const handbrake = input.isHeld('Space');
  const slip = updateCarPhysics(car, { throttle, steer, handbrake }, dt);
  const speed = carSpeed(car);
  const forward = car.vx * Math.cos(car.angle) + car.vy * Math.sin(car.angle);
  const drifting = slip > 0.34 && speed > 90;
  const burningOut = throttle > 0 && Math.abs(forward) < 26 && speed > 8;
  if (drifting || burningOut || (handbrake && speed > 60)) {
    const rearX = car.x - Math.cos(car.angle) * car.type.length * 0.36;
    const rearY = car.y - Math.sin(car.angle) * car.type.length * 0.36;
    spawnTireSmoke(game.effects, rearX, rearY);
    if (drifting) {
      addSkidMark(game.effects, rearX, rearY, car.angle);
      if (game.screechCooldown <= 0) {
        game.screechCooldown = 0.34;
        game.audio.screech();
      }
    }
  }
  game.screechCooldown = Math.max(0, game.screechCooldown - dt);
  resolveCarBuildings(game, car, true);
  syncPlayerToCar(game);
  game.audio.setEngine(clamp(speed / car.type.maxSpeed, 0, 1));
}

/** Advance the whole world one fixed step. */
export function updateGame(game, input, dt) {
  if (game.busted || game.wasted) {
    updateEffects(game.effects, dt);
    game.audio.setEngine(null);
    game.audio.setSiren(false);
    return;
  }
  game.time += dt;
  game.timeOfDay = (game.timeOfDay + dt / DAY_CYCLE_SECONDS) % 1;

  if (input.wasPressed('KeyE')) tryEnterExitCar(game);

  if (game.player.car) updatePlayerDriving(game, input, dt);
  else {
    updatePlayerOnFoot(game, input, dt);
    game.audio.setEngine(null);
  }

  for (const car of game.cars) {
    if (car === game.player.car) continue;
    if (car.kind === 'traffic' && car.driver === 'ai') {
      updateTrafficCar(game, car, dt, game.rng);
      resolveCarBuildings(game, car, false);
    } else if (car.kind === 'police') {
      updatePoliceCar(game, car, dt);
      resolveCarBuildings(game, car, false);
    }
  }

  resolveCarCarCollisions(game);
  resolveCarPedestrianHits(game);

  for (const ped of game.pedestrians) {
    updatePedestrian(game, ped, dt, game.rng);
    const placed = collideCircleWithBuildings(game.city, ped.x, ped.y, 9, ped.vx, ped.vy);
    ped.x = placed.x;
    ped.y = placed.y;
    if (ped.state === 'down' && game.time > ped.respawnAt && distance(ped.x, ped.y, game.player.x, game.player.y) > 420) {
      recyclePedestrian(game, ped, game.rng);
    }
  }

  updateWanted(game, dt, game.rng);
  updateMissions(game, dt);

  // Slow recovery while the heat is off.
  if (game.wanted.heat <= 0.01 && game.player.health > 0) {
    game.player.health = Math.min(PLAYER_MAX_HEALTH, game.player.health + 1.1 * dt);
  }
  if (game.player.health <= 0) game.wasted = true;

  const focusX = game.player.x;
  const focusY = game.player.y;
  const lerpRate = 1 - Math.exp(-5.5 * dt);
  game.camera.x += (focusX - game.camera.x) * lerpRate;
  game.camera.y += (focusY - game.camera.y) * lerpRate;

  const anyCopNear = game.cars.some((car) => car.kind === 'police' && distance(car.x, car.y, focusX, focusY) < 560);
  game.audio.setSiren(anyCopNear && game.wanted.heat > 0);

  updateEffects(game.effects, dt);
}
