// The wanted system: crimes add heat, heat makes stars, stars bring the
// Port Solano PD. Heat decays only while no officer has eyes on the player.
// Police interceptors spawn on roads near the player in numbers that scale
// with the stars, and a close, slow player gets BUSTED.

import { BUST_SECONDS, HEAT_DECAY_PER_SECOND, HEAT_SIGHT_RANGE, MAX_HEAT } from './config.js';
import { clamp, distance } from './random.js';
import { POLICE_TYPE, createCar, findPoliceSpawn } from './vehicles.js';

export const CRIMES = {
  carjack: { heat: 1.0, label: 'Grand theft auto' },
  hitCar: { heat: 0.35, label: 'Hit and run' },
  hitBuilding: { heat: 0.15, label: 'Property damage' },
  hitPedestrian: { heat: 2.0, label: 'Vehicular assault' },
  punchPedestrian: { heat: 1.0, label: 'Assault' },
  punchCar: { heat: 0.3, label: 'Vandalism' },
  missionMayhem: { heat: 0.5, label: 'Public disturbance' },
};

export function createWanted() {
  return {
    heat: 0,
    seenByPolice: false,
    bustMeter: 0,
    spawnTimer: 0,
    lastCrimeLabel: '',
  };
}

export function wantedStars(wanted) {
  return wanted.heat <= 0.01 ? 0 : Math.min(5, Math.ceil(wanted.heat));
}

/** Record a crime: raises heat (witnessed or not — this is an arcade city). */
export function commitCrime(game, kind) {
  const crime = CRIMES[kind];
  if (!crime) return;
  game.wanted.heat = clamp(game.wanted.heat + crime.heat, 0, MAX_HEAT);
  game.wanted.lastCrimeLabel = crime.label;
}

export function policeCount(game) {
  return game.cars.filter((car) => car.kind === 'police').length;
}

function desiredPolice(stars) {
  return stars <= 0 ? 0 : Math.min(2 + stars, 7);
}

export function updateWanted(game, dt, rng) {
  const wanted = game.wanted;
  const player = game.player;
  const px = player.car ? player.car.x : player.x;
  const py = player.car ? player.car.y : player.y;

  // Eyes on the player?
  wanted.seenByPolice = false;
  let nearestCop = Infinity;
  for (const car of game.cars) {
    if (car.kind !== 'police') continue;
    const d = distance(px, py, car.x, car.y);
    if (d < nearestCop) nearestCop = d;
    if (d < HEAT_SIGHT_RANGE) wanted.seenByPolice = true;
  }

  if (!wanted.seenByPolice && wanted.heat > 0) {
    wanted.heat = Math.max(0, wanted.heat - HEAT_DECAY_PER_SECOND * dt * (wanted.heat > 3 ? 0.6 : 1));
    if (wanted.heat < 0.02) wanted.heat = 0;
  }

  // Spawn or retire interceptors to match the stars.
  const stars = wantedStars(wanted);
  const want = desiredPolice(stars);
  wanted.spawnTimer -= dt;
  const current = policeCount(game);
  if (current < want && wanted.spawnTimer <= 0) {
    wanted.spawnTimer = 1.4;
    const spot = findPoliceSpawn(game.city, rng, px, py);
    const cop = createCar(POLICE_TYPE, spot.x, spot.y, spot.angle, 'police', POLICE_TYPE.colors[0]);
    cop.driver = 'police';
    game.cars.push(cop);
  } else if (current > want) {
    // The farthest interceptor gives up the chase and leaves the world.
    let farIndex = -1;
    let farDist = -1;
    game.cars.forEach((car, index) => {
      if (car.kind !== 'police') return;
      const d = distance(px, py, car.x, car.y);
      if (d > farDist) { farDist = d; farIndex = index; }
    });
    if (farIndex >= 0 && farDist > 500) game.cars.splice(farIndex, 1);
  }

  // BUSTED: a cop close by while the player is slow or on foot fills the meter.
  const playerSpeed = player.car
    ? Math.sqrt(player.car.vx ** 2 + player.car.vy ** 2)
    : Math.sqrt(player.vx ** 2 + player.vy ** 2);
  const catchable = nearestCop < (player.car ? 78 : 56) && playerSpeed < 55;
  if (stars > 0 && catchable) {
    wanted.bustMeter += dt / BUST_SECONDS;
    if (wanted.bustMeter >= 1) game.busted = true;
  } else {
    wanted.bustMeter = Math.max(0, wanted.bustMeter - dt * 0.7);
  }
}
