// Neon Harbor: Port Solano — boot and the one loop. The world advances in
// fixed 1/60 s steps; the renderer paints title, play, pause and end screens.
// ?seed=N fixes the city. ?shot=cover|chase|mission|downtown (with &seed=N)
// stages that deterministic scene instead of running the loop, paints it
// twice and sets window.__shotReady for a screenshot.

import { GAME_TITLE, STEP } from './config.js';
import { createAudio } from './audio.js';
import { createGame, updateGame } from './game-state.js';
import { createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { drawHUD } from './hud.js';
import { stageShot } from './shots.js';
import { clearSave, loadSave, writeSave } from './savegame.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();
const renderer = createRenderer(canvas);
let save = loadSave();
let game = createGame(seed, save, audio);
let screen = SCREEN_TITLE;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

function pointInRect(x, y, rect) {
  return rect && x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function rebuildGame(nextSave) {
  save = nextSave;
  game = createGame(seed, save, audio);
}

function endRun(fee) {
  const kept = { cash: Math.max(0, game.cash - fee), missionsDone: game.missionsDone };
  writeSave(kept.cash, kept.missionsDone);
  rebuildGame(kept);
  screen = SCREEN_PLAY;
}

function runShot(name) {
  stageShot(name, game, updateGame);
  let painted = 0;
  function paint() {
    renderer.drawWorld(game, canvas.width, canvas.height);
    drawHUD(document.getElementById('game').getContext('2d'), game, canvas.width, canvas.height);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

if (shot) {
  runShot(shot);
} else {
  const input = createInput(canvas);
  let accumulator = 0;
  let last = performance.now();
  let overSince = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > MAX_FRAME) dt = MAX_FRAME;
    const viewW = canvas.width;
    const viewH = canvas.height;
    const ctx = canvas.getContext('2d');

    if (input.wasPressed('KeyM')) audio.toggleMute();

    if (screen === SCREEN_TITLE) {
      renderer.drawTitle(game, viewW, viewH, Boolean(save));
      if (input.mouse.clicked) {
        audio.ensure();
        audio.click();
        if (pointInRect(input.mouse.clickX, input.mouse.clickY, renderer.buttons.start)) {
          if (save) {
            clearSave();
            rebuildGame(null);
          }
          screen = SCREEN_PLAY;
        } else if (pointInRect(input.mouse.clickX, input.mouse.clickY, renderer.buttons.continue)) {
          screen = SCREEN_PLAY;
        }
      }
      if (input.wasPressed('Enter', 'Space')) {
        audio.ensure();
        screen = SCREEN_PLAY;
      }
    } else if (screen === SCREEN_PAUSED) {
      renderer.drawWorld(game, viewW, viewH);
      drawHUD(ctx, game, viewW, viewH);
      renderer.drawPaused(viewW, viewH);
      if (input.wasPressed('KeyP', 'Escape')) screen = SCREEN_PLAY;
    } else {
      // Play (and the frozen moment after BUSTED / WASTED).
      if (input.wasPressed('KeyP', 'Escape') && !game.busted && !game.wasted) {
        screen = SCREEN_PAUSED;
      } else {
        accumulator += dt;
        while (accumulator >= STEP) {
          updateGame(game, input, STEP);
          accumulator -= STEP;
        }
      }
      renderer.drawWorld(game, viewW, viewH);
      drawHUD(ctx, game, viewW, viewH);
      if (game.busted || game.wasted) {
        if (!overSince) overSince = now;
        renderer.drawOver(game, viewW, viewH);
        screen = SCREEN_OVER;
        if (now - overSince > 700) {
          if (input.wasPressed('KeyR') || (input.mouse.clicked && pointInRect(input.mouse.clickX, input.mouse.clickY, renderer.buttons.restart))) {
            overSince = 0;
            endRun(game.busted ? 120 : 150);
          }
        }
      } else {
        overSince = 0;
        if (screen === SCREEN_OVER) screen = SCREEN_PLAY;
      }
    }

    if (status) {
      status.textContent = screen === SCREEN_TITLE
        ? `${GAME_TITLE}: title screen. Activate Start to play.`
        : `${GAME_TITLE}: cash $${game.cash}, health ${Math.round(game.player.health)}, jobs done ${game.missionsDone} of 4.`;
    }
    input.endFrame();
  }
  requestAnimationFrame(frame);
}
