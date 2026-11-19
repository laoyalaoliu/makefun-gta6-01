// Deterministic screenshot scenes behind ?shot=cover|chase|mission|downtown.
// Each scene poses the real game — real city, real cars, real HUD — by
// placing the player and the law, then running the actual simulation for a
// fixed number of steps with a scripted driver, so the frame is gameplay,
// and the same seed always gives the same frame.

import { STEP } from './config.js';
import { avenueX, streetY } from './city.js';
import { POLICE_TYPE, createCar } from './vehicles.js';
import { SCREEN_PLAY } from './render.js';

function scriptedInput(heldCodes) {
  const held = new Set(heldCodes);
  return {
    mouse: { x: 0, y: 0, clicked: false, clickX: 0, clickY: 0 },
    isHeld: (...codes) => codes.some((code) => held.has(code)),
    wasPressed: () => false,
    moveAxes: () => ({ x: 0, y: 0 }),
    endFrame: () => {},
  };
}

function runSteps(game, steps, input, updateGame) {
  for (let i = 0; i < steps; i += 1) updateGame(game, input, STEP);
}

function snapCamera(game) {
  game.camera.x = game.player.x;
  game.camera.y = game.player.y;
}

function putPlayerInCar(game, car) {
  game.player.car = car;
  car.driver = 'player';
  game.player.x = car.x;
  game.player.y = car.y;
}

function addCop(game, x, y, angle) {
  const cop = createCar(POLICE_TYPE, x, y, angle, 'police', POLICE_TYPE.colors[0]);
  cop.driver = 'police';
  game.cars.push(cop);
  return cop;
}

/** The cover: our driver beside a stolen Vela Spider at the pier, job marker up. */
function stageCover(game, updateGame) {
  game.timeOfDay = 0.35;
  const coupe = game.cars[game.cars.length - 1];
  game.player.x = coupe.x - 30;
  game.player.y = coupe.y + 16;
  game.player.angle = 0.5;
  runSteps(game, 40, scriptedInput([]), updateGame);
  snapCamera(game);
}

/** The chase: four stars, a Spider at speed up the avenue, interceptors behind. */
function stageChase(game, updateGame) {
  game.timeOfDay = 0.58;
  const avenue = avenueX(3);
  const coupe = game.cars[game.cars.length - 1];
  coupe.x = avenue + 18;
  coupe.y = streetY(3) - 60;
  coupe.angle = -Math.PI / 2;
  putPlayerInCar(game, coupe);
  game.wanted.heat = 4;
  game.wanted.lastCrimeLabel = 'Vehicle theft';
  const copA = addCop(game, avenue - 16, streetY(3) + 175, -Math.PI / 2);
  const copB = addCop(game, avenue + 20, streetY(3) + 300, -Math.PI / 2);
  const copC = addCop(game, avenue - 14, streetY(4) - 120, -Math.PI / 2);
  for (const cop of [copA, copB, copC]) cop.vy = -170;
  runSteps(game, 95, scriptedInput(['KeyW']), updateGame);
  game.mission.banner = 'Shake the Port Solano PD — break their line of sight to cool the heat!';
  game.mission.bannerUntil = game.time + 999;
  snapCamera(game);
}

/** The mission: package aboard, the Cafe Lumen delivery beacon in view. */
function stageMission(game, updateGame) {
  game.timeOfDay = 0.38;
  game.mission.active = true;
  game.mission.stage = 2; // delivering the Sunset Package
  const sedan = game.cars.find((car) => car.kind === 'traffic' && car.type.id === 'sedan')
    || game.cars.find((car) => car.kind === 'traffic')
    || game.cars[0];
  sedan.x = avenueX(1) + 18;
  sedan.y = streetY(0) + 265;
  sedan.angle = -Math.PI / 2;
  sedan.vx = 0;
  sedan.vy = 0;
  putPlayerInCar(game, sedan);
  runSteps(game, 34, scriptedInput(['KeyW']), updateGame);
  game.mission.banner = 'Sunset Package — the drop is Cafe Lumen, north-west. Watch the corners.';
  game.mission.bannerUntil = game.time + 999;
  snapCamera(game);
}

/** Downtown on foot at dusk: crowds, traffic and neon on the Marlin Strip. */
function stageDowntown(game, updateGame) {
  game.timeOfDay = 0.64;
  game.player.x = avenueX(2) + 66;
  game.player.y = streetY(1) + 62;
  game.player.angle = 2.4;
  // Bring a few citizens into frame.
  let placed = 0;
  for (const ped of game.pedestrians) {
    if (placed >= 6) break;
    ped.x = game.player.x + [-46, 30, 74, -12, 52, -70][placed];
    ped.y = game.player.y + [22, -38, 30, 58, -64, -18][placed];
    ped.target = { x: ped.x + 60, y: ped.y + 20 };
    placed += 1;
  }
  runSteps(game, 80, scriptedInput([]), updateGame);
  snapCamera(game);
}

/**
 * Pose the named scene on a fresh game. Returns the screen to draw.
 * updateGame is passed in to keep this module free of an import cycle.
 */
export function stageShot(name, game, updateGame) {
  if (name === 'chase') stageChase(game, updateGame);
  else if (name === 'mission') stageMission(game, updateGame);
  else if (name === 'downtown') stageDowntown(game, updateGame);
  else stageCover(game, updateGame);
  return { screen: SCREEN_PLAY };
}
