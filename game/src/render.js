// Drawing the world: Port Solano from above — sand, sea and pier, asphalt
// with lane markings and crosswalks, pastel blocks with neon signs, palms,
// lamps, crates, cars, citizens and the player — plus the day-to-dusk light
// that washes over it all and the full-screen menu screens. HUD lives in
// hud.js; this file paints everything inside the world and the menus.

import { BEACH_Y, GAME_TITLE, ROAD_HALF, WATER_Y } from './config.js';
import { clamp } from './random.js';
import { particleAlpha, shakeOffset } from './effects.js';
import { currentObjective } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

/** 0 at noon, 1 at deep night: drives the dusk wash and the neon glow. */
export function darknessAt(timeOfDay) {
  const sun = Math.sin((timeOfDay - 0.18) * Math.PI * 2);
  return clamp(0.55 - sun * 0.75, 0, 1);
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawGround(ctx, city, view) {
  const p = city.palette;
  ctx.fillStyle = p.blockGround;
  ctx.fillRect(view.left, view.top, view.width, view.height);
  // Beach and sea.
  ctx.fillStyle = p.sand;
  ctx.fillRect(view.left, city.beachY, view.width, city.waterY - city.beachY);
  const waterGrad = ctx.createLinearGradient(0, city.waterY, 0, city.height);
  waterGrad.addColorStop(0, p.water);
  waterGrad.addColorStop(1, p.waterDeep);
  ctx.fillStyle = waterGrad;
  ctx.fillRect(view.left, city.waterY, view.width, city.height - city.waterY);
  // The pier: a wooden walk out to a small lighthouse point.
  ctx.fillStyle = '#a9805a';
  ctx.fillRect(city.avenues[1] - 26, city.waterY - 10, 52, 190);
  ctx.fillStyle = '#8a6844';
  for (let y = city.waterY; y < city.waterY + 180; y += 22) ctx.fillRect(city.avenues[1] - 26, y, 52, 3);
  ctx.fillStyle = '#f2f0eb';
  ctx.beginPath();
  ctx.arc(city.avenues[1], city.waterY + 196, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8452c';
  ctx.beginPath();
  ctx.arc(city.avenues[1], city.waterY + 196, 15, Math.PI, Math.PI * 1.6);
  ctx.fill();
}

function drawRoads(ctx, city, time) {
  const p = city.palette;
  ctx.lineCap = 'butt';
  // Sidewalk underlay, then asphalt, for avenues and streets alike.
  for (const pass of [0, 1]) {
    ctx.strokeStyle = pass === 0 ? p.sidewalk : p.asphalt;
    ctx.lineWidth = pass === 0 ? ROAD_HALF * 2 + 22 : ROAD_HALF * 2;
    for (const x of city.avenues) {
      ctx.beginPath();
      ctx.moveTo(x, -20);
      ctx.lineTo(x, BEACH_Y + 12);
      ctx.stroke();
    }
    for (const y of city.streets) {
      ctx.beginPath();
      ctx.moveTo(-20, y);
      ctx.lineTo(city.width + 20, y);
      ctx.stroke();
    }
  }
  // Dashed centre lines.
  ctx.strokeStyle = 'rgba(250, 220, 120, 0.75)';
  ctx.lineWidth = 3;
  ctx.setLineDash([22, 26]);
  for (const x of city.avenues) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, BEACH_Y);
    ctx.stroke();
  }
  for (const y of city.streets) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(city.width, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Crosswalks at every intersection.
  ctx.fillStyle = 'rgba(245,245,245,0.55)';
  for (const node of city.intersections) {
    for (let i = -3; i <= 3; i += 1) {
      ctx.fillRect(node.x + i * 12 - 4, node.y - ROAD_HALF - 9, 8, 6);
      ctx.fillRect(node.x + i * 12 - 4, node.y + ROAD_HALF + 3, 8, 6);
    }
  }
  // Animated wave sparkle on the waterline.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x < city.width; x += 46) {
    const y = city.waterY + 8 + Math.sin(time * 1.4 + x * 0.05) * 3;
    ctx.moveTo(x, y);
    ctx.lineTo(x + 24, y);
  }
  ctx.stroke();
}

function drawLotsAndPlazas(ctx, city) {
  for (const lot of city.lots) {
    ctx.fillStyle = lot.plaza ? '#a8bf8d' : '#4a4f57';
    ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
    if (!lot.plaza) {
      ctx.strokeStyle = 'rgba(245,245,245,0.4)';
      ctx.lineWidth = 2;
      for (let x = lot.x + 26; x < lot.x + lot.w - 12; x += 46) {
        ctx.strokeRect(x, lot.y + 14, 34, lot.h - 28);
      }
    }
  }
}

function drawBuildings(ctx, city, darkness) {
  for (const b of city.buildings) {
    ctx.fillStyle = 'rgba(40,32,24,0.25)';
    ctx.fillRect(b.x + 7, b.y + 9, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 7, b.y + 7, b.w - 14, b.h - 14);
    // Rooftop details: parapet lines, skylights and plant boxes, placed by a
    // hash of the building's position so every roof is stable and distinct.
    const hash = Math.abs(Math.sin(b.x * 12.9898 + b.y * 78.233) * 43758.5453) % 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 13, b.y + 13, b.w - 26, b.h - 26);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(b.x + 14, b.y + 14, Math.max(8, b.w * 0.2), Math.max(8, b.h * 0.16));
    ctx.fillStyle = 'rgba(30,30,40,0.25)';
    ctx.fillRect(b.x + b.w - 30, b.y + b.h - 26, 14, 12);
    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    const boxW = 12 + hash * 16;
    ctx.fillRect(b.x + b.w * (0.3 + hash * 0.3), b.y + b.h * 0.34, boxW, boxW * 0.7);
    ctx.fillRect(b.x + b.w * 0.16, b.y + b.h * (0.5 + hash * 0.2), 9, 9);
    if (darkness > 0.3) {
      // Windows glow as the light goes down.
      ctx.fillStyle = `rgba(255, 214, 130, ${(darkness - 0.3) * 0.55})`;
      for (let wy = b.y + 16; wy < b.y + b.h - 20; wy += 17) {
        for (let wx = b.x + 16; wx < b.x + b.w - 20; wx += 19) {
          if ((Math.sin(wx * 3.7 + wy * 9.1) % 1 + 1) % 1 > 0.45) ctx.fillRect(wx, wy, 6, 4);
        }
      }
    }
    if (b.sign) {
      const signW = Math.min(b.w - 16, 22 + b.sign.length * 8.4);
      const signX = b.x + (b.w - signW) / 2;
      const signY = b.y + b.h - 17;
      if (darkness > 0.2) {
        ctx.save();
        ctx.shadowColor = b.signColor;
        ctx.shadowBlur = 16 * darkness;
        ctx.fillStyle = b.signColor;
        ctx.fillRect(signX, signY, signW, 13);
        ctx.restore();
      } else {
        ctx.fillStyle = b.signColor;
        ctx.fillRect(signX, signY, signW, 13);
      }
      ctx.fillStyle = 'rgba(20,16,28,0.92)';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.sign, b.x + b.w / 2, signY + 7);
    }
  }
}

function drawPalmsAndProps(ctx, city, darkness, time) {
  for (const palm of city.palms) {
    ctx.strokeStyle = '#8a6844';
    ctx.lineWidth = 3.4 * palm.s;
    ctx.beginPath();
    ctx.moveTo(palm.x, palm.y);
    ctx.lineTo(palm.x + 3, palm.y - 5);
    ctx.stroke();
    ctx.fillStyle = 'rgba(30,60,30,0.2)';
    ctx.beginPath();
    ctx.ellipse(palm.x + 8, palm.y + 6, 15 * palm.s, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3f9e4d';
    ctx.lineWidth = 2.6 * palm.s;
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 + Math.sin(time * 0.8 + palm.x) * 0.05;
      ctx.beginPath();
      ctx.moveTo(palm.x + 3, palm.y - 5);
      ctx.quadraticCurveTo(
        palm.x + 3 + Math.cos(a) * 11 * palm.s,
        palm.y - 5 + Math.sin(a) * 7 * palm.s - 3,
        palm.x + 3 + Math.cos(a) * 17 * palm.s,
        palm.y - 5 + Math.sin(a) * 12 * palm.s + 2,
      );
      ctx.stroke();
    }
  }
  for (const prop of city.props) {
    ctx.fillStyle = prop.color;
    ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(prop.x, prop.y, prop.w, prop.h);
  }
  if (darkness > 0.15) {
    for (const lamp of city.lamps) {
      const glow = ctx.createRadialGradient(lamp.x, lamp.y, 2, lamp.x, lamp.y, 34);
      glow.addColorStop(0, `rgba(255, 214, 130, ${0.5 * darkness})`);
      glow.addColorStop(1, 'rgba(255, 214, 130, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(lamp.x, lamp.y, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffe9b0';
      ctx.fillRect(lamp.x - 1.6, lamp.y - 1.6, 3.2, 3.2);
    }
  }
}

function drawObjectiveBeacon(ctx, game) {
  const objective = currentObjective(game);
  if (!objective.target) return;
  const { x, y } = objective.target;
  const pulse = 1 + Math.sin(game.time * 4) * 0.16;
  const gold = objective.giver ? '#ffd34d' : '#22d3ee';
  const grad = ctx.createLinearGradient(0, y - 300, 0, y);
  grad.addColorStop(0, 'rgba(255, 211, 77, 0)');
  grad.addColorStop(1, objective.giver ? 'rgba(255, 211, 77, 0.4)' : 'rgba(34, 211, 238, 0.4)');
  ctx.fillStyle = grad;
  ctx.fillRect(x - 9, y - 300, 18, 300);
  ctx.strokeStyle = gold;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, 24 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = gold;
  ctx.font = 'bold 21px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(objective.giver ? '!' : '◆', x, y - 40 - Math.sin(game.time * 4) * 4);
}

function drawCar(ctx, car, time, darkness) {
  const { length, width } = car.type;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(25,20,16,0.3)';
  roundedRect(ctx, -length / 2 + 3, -width / 2 + 4, length, width, 7);
  ctx.fill();
  const isPolice = car.kind === 'police';
  ctx.fillStyle = isPolice ? '#20304a' : car.color;
  roundedRect(ctx, -length / 2, -width / 2, length, width, 7);
  ctx.fill();
  if (isPolice) {
    ctx.fillStyle = '#f2f5f9';
    roundedRect(ctx, -length * 0.08, -width / 2, length * 0.3, width, 4);
    ctx.fill();
    // Light bar, flashing with the clock.
    const phase = Math.floor(time * 2.4) % 2 === 0;
    ctx.fillStyle = phase ? '#ff3b30' : '#3b82f6';
    ctx.fillRect(-4, -width / 2 + 2, 8, width / 2 - 2);
    ctx.fillStyle = phase ? '#3b82f6' : '#ff3b30';
    ctx.fillRect(-4, 0, 8, width / 2 - 2);
  }
  // Cabin and glass.
  ctx.fillStyle = 'rgba(18,26,38,0.9)';
  roundedRect(ctx, -length * 0.16, -width / 2 + 3.4, length * 0.36, width - 6.8, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(140,200,235,0.5)';
  ctx.fillRect(length * 0.13, -width / 2 + 4.4, 3.4, width - 8.8);
  // Headlights and tail lights.
  ctx.fillStyle = '#fff6c9';
  ctx.fillRect(length / 2 - 2.4, -width / 2 + 2.6, 2.6, 4.6);
  ctx.fillRect(length / 2 - 2.4, width / 2 - 7.2, 2.6, 4.6);
  ctx.fillStyle = '#ff4040';
  ctx.fillRect(-length / 2 - 0.4, -width / 2 + 2.6, 2.6, 4.2);
  ctx.fillRect(-length / 2 - 0.4, width / 2 - 6.8, 2.6, 4.2);
  if (car.type.id === 'cab') {
    ctx.fillStyle = '#20304a';
    ctx.font = 'bold 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CAB', length * 0.02, 0);
  }
  // Damage: dents and smoke wisps.
  if (car.damage > 45) {
    ctx.fillStyle = 'rgba(30,30,30,0.35)';
    ctx.beginPath();
    ctx.arc(length * 0.3, width * 0.2, 5.5, 0, Math.PI * 2);
    ctx.fill();
  }
  if (darkness > 0.35) {
    const beam = ctx.createLinearGradient(length / 2, 0, length / 2 + 88, 0);
    beam.addColorStop(0, 'rgba(255, 244, 190, 0.28)');
    beam.addColorStop(1, 'rgba(255, 244, 190, 0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(length / 2, -width / 2 + 3);
    ctx.lineTo(length / 2 + 88, -width / 2 - 12);
    ctx.lineTo(length / 2 + 88, width / 2 + 12);
    ctx.lineTo(length / 2, width / 2 - 3);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  if (car.damage > 68) {
    const puff = 5 + Math.sin(time * 7 + car.id) * 2;
    ctx.fillStyle = 'rgba(60,60,60,0.4)';
    ctx.beginPath();
    ctx.arc(car.x + Math.cos(car.angle) * 18, car.y + Math.sin(car.angle) * 18 - 6, puff, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPedestrian(ctx, ped) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  if (ped.state === 'down') {
    ctx.rotate(ped.angle + Math.PI / 2);
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 5.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(15, 0, 4.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.fillStyle = 'rgba(30,25,20,0.25)';
  ctx.beginPath();
  ctx.ellipse(1.6, 2.6, 8, 4.6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Little legs mid-stride.
  const stride = Math.sin(ped.walkPhase) * 4.4;
  ctx.strokeStyle = '#3a3f4a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(ped.angle + 2.6) * 6 + stride * 0.4, Math.sin(ped.angle + 2.6) * 6);
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(ped.angle - 2.6) * 6 - stride * 0.4, Math.sin(ped.angle - 2.6) * 6);
  ctx.stroke();
  ctx.rotate(ped.angle);
  ctx.fillStyle = ped.shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 6.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ped.skin;
  ctx.beginPath();
  ctx.arc(2.4, 0, 4.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPlayer(ctx, game) {
  const player = game.player;
  if (player.car) return;
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.fillStyle = 'rgba(30,25,20,0.3)';
  ctx.beginPath();
  ctx.ellipse(1.6, 2.8, 9, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  const stride = Math.sin(player.walkPhase) * 4.6;
  ctx.strokeStyle = '#22303e';
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(player.angle + 2.6) * 6.6 + stride * 0.4, Math.sin(player.angle + 2.6) * 6.6);
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(player.angle - 2.6) * 6.6 - stride * 0.4, Math.sin(player.angle - 2.6) * 6.6);
  ctx.stroke();
  ctx.rotate(player.angle);
  // Punch: the arm shoots out ahead.
  if (player.punchTime > 0.05) {
    ctx.strokeStyle = '#f2c09a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(4, 3);
    ctx.lineTo(19, 3);
    ctx.stroke();
  }
  ctx.fillStyle = '#0e9594';
  ctx.beginPath();
  ctx.arc(0, 0, 7.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.fillStyle = '#f2c09a';
  ctx.beginPath();
  ctx.arc(2.6, 0, 4.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#20303c';
  ctx.beginPath();
  ctx.arc(3.6, 0, 4.2, Math.PI * 0.7, Math.PI * 1.7);
  ctx.fill();
  ctx.restore();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const buttons = { start: null, continue: null, restart: null, resume: null };

  function viewRect(game, viewW, viewH) {
    const camX = clamp(game.camera.x, viewW / 2, Math.max(viewW / 2, game.city.width - viewW / 2));
    const camY = clamp(game.camera.y, viewH / 2, Math.max(viewH / 2, game.city.height - viewH / 2));
    return { camX, camY, left: camX - viewW / 2, top: camY - viewH / 2, width: viewW, height: viewH };
  }

  function drawWorld(game, viewW, viewH) {
    const city = game.city;
    const darkness = darknessAt(game.timeOfDay);
    const view = viewRect(game, viewW, viewH);
    const shake = shakeOffset(game.effects);
    ctx.save();
    ctx.translate(viewW / 2 - view.camX + shake.x, viewH / 2 - view.camY + shake.y);
    const drawView = { left: view.left - 30, top: view.top - 30, width: viewW + 60, height: viewH + 60 };
    drawGround(ctx, city, drawView);
    drawRoads(ctx, city, game.time);
    drawLotsAndPlazas(ctx, city);
    // Skid marks under everything that moves.
    for (const skid of game.effects.skids) {
      const alpha = clamp(0.4 * (1 - skid.age / 14), 0, 0.4);
      ctx.save();
      ctx.translate(skid.x, skid.y);
      ctx.rotate(skid.angle);
      ctx.fillStyle = `rgba(22,22,26,${alpha})`;
      ctx.fillRect(-7, -3.4, 14, 2.4);
      ctx.fillRect(-7, 1.2, 14, 2.4);
      ctx.restore();
    }
    drawBuildings(ctx, city, darkness);
    drawPalmsAndProps(ctx, city, darkness, game.time);
    drawObjectiveBeacon(ctx, game);
    for (const ped of game.pedestrians) drawPedestrian(ctx, ped);
    for (const car of game.cars) drawCar(ctx, car, game.time, darkness);
    drawPlayer(ctx, game);
    for (const particle of game.effects.particles) {
      ctx.globalAlpha = particleAlpha(particle);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // Day-to-dusk wash over the world (screen space).
    if (darkness > 0.02) {
      ctx.fillStyle = `rgba(24, 20, 66, ${darkness * 0.36})`;
      ctx.fillRect(0, 0, viewW, viewH);
      if (darkness > 0.25 && darkness < 0.85) {
        ctx.fillStyle = `rgba(255, 122, 60, ${(darkness - 0.25) * 0.1})`;
        ctx.fillRect(0, 0, viewW, viewH);
      }
    }
    // Floating popups in world space need the camera transform: draw them last via view math.
    ctx.save();
    ctx.translate(viewW / 2 - view.camX, viewH / 2 - view.camY);
    for (const popup of game.effects.popups) {
      ctx.globalAlpha = clamp(1.4 - popup.age / popup.life, 0, 1);
      ctx.fillStyle = popup.color;
      ctx.font = 'bold 17px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(popup.text, popup.x, popup.y);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    if (game.effects.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${game.effects.flash * 0.4})`;
      ctx.fillRect(0, 0, viewW, viewH);
    }
    return view;
  }

  function panel(x, y, w, h, fill) {
    ctx.fillStyle = fill;
    roundedRect(ctx, x, y, w, h, 12);
    ctx.fill();
  }

  function drawTitle(game, viewW, viewH, hasSave) {
    drawWorld(game, viewW, viewH);
    const grad = ctx.createLinearGradient(0, 0, 0, viewH);
    grad.addColorStop(0, 'rgba(16,10,34,0.62)');
    grad.addColorStop(0.55, 'rgba(16,10,34,0.28)');
    grad.addColorStop(1, 'rgba(16,10,34,0.72)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.textAlign = 'center';
    ctx.save();
    ctx.shadowColor = '#ff5da2';
    ctx.shadowBlur = 30;
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 62px system-ui, sans-serif';
    ctx.fillText('NEON HARBOR', viewW / 2, viewH * 0.24);
    ctx.restore();
    ctx.fillStyle = '#ffd34d';
    ctx.font = '700 27px system-ui, sans-serif';
    ctx.fillText('· PORT SOLANO ·', viewW / 2, viewH * 0.24 + 42);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('Fixer Marisol Vega has work for a driver with no questions and fast hands.', viewW / 2, viewH * 0.24 + 76);
    ctx.fillText('Steal cars, run her jobs, and stay ahead of the Port Solano PD.', viewW / 2, viewH * 0.24 + 98);

    const bw = 230;
    const bh = 52;
    const by = viewH * 0.52;
    buttons.start = { x: viewW / 2 - bw - 12, y: by, w: bw, h: bh };
    buttons.continue = hasSave ? { x: viewW / 2 + 12, y: by, w: bw, h: bh } : null;
    ctx.fillStyle = '#ff5da2';
    roundedRect(ctx, buttons.start.x, by, bw, bh, 10);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(hasSave ? 'NEW GAME' : 'START DRIVING', viewW / 2 - bw / 2 - 12, by + 33);
    if (buttons.continue) {
      ctx.fillStyle = '#22d3ee';
      roundedRect(ctx, buttons.continue.x, by, bw, bh, 10);
      ctx.fill();
      ctx.fillStyle = '#10222e';
      ctx.fillText('CONTINUE', viewW / 2 + bw / 2 + 12, by + 33);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.font = '15px system-ui, sans-serif';
    const lines = [
      'WASD / Arrows — move & drive      Shift — sprint      Space — handbrake',
      'E — enter / exit car (stealing is a crime)      F or J — punch      P / Esc — pause      M — mute',
      'Follow the gold marker for jobs. Five stars of heat brings the whole PD down on you.',
    ];
    lines.forEach((line, i) => ctx.fillText(line, viewW / 2, viewH * 0.68 + i * 24));
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('An original game — every street, name and neon sign of Port Solano was drawn in code.', viewW / 2, viewH - 26);
  }

  function drawPaused(viewW, viewH) {
    ctx.fillStyle = 'rgba(10,10,24,0.62)';
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 46px system-ui, sans-serif';
    ctx.fillText('PAUSED', viewW / 2, viewH / 2 - 30);
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('P or Esc to resume · your cash and story progress are saved automatically', viewW / 2, viewH / 2 + 12);
  }

  function drawOver(game, viewW, viewH) {
    drawWorld(game, viewW, viewH);
    const busted = game.busted;
    ctx.fillStyle = busted ? 'rgba(16,30,80,0.66)' : 'rgba(80,10,14,0.62)';
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.textAlign = 'center';
    ctx.save();
    ctx.shadowColor = busted ? '#3b82f6' : '#ff3b30';
    ctx.shadowBlur = 26;
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 72px system-ui, sans-serif';
    ctx.fillText(busted ? 'BUSTED' : 'WASTED', viewW / 2, viewH * 0.38);
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText(
      busted ? 'The Port Solano PD walked you in. Bail and fines sting.' : 'You woke up at Solano General with a lighter wallet.',
      viewW / 2, viewH * 0.38 + 44,
    );
    ctx.fillText(`Cash kept: $${game.cash} · Jobs done: ${game.missionsDone}/4`, viewW / 2, viewH * 0.38 + 74);
    const bw = 240;
    const bh = 50;
    buttons.restart = { x: viewW / 2 - bw / 2, y: viewH * 0.56, w: bw, h: bh };
    ctx.fillStyle = '#ffd34d';
    roundedRect(ctx, buttons.restart.x, buttons.restart.y, bw, bh, 10);
    ctx.fill();
    ctx.fillStyle = '#241a05';
    ctx.font = 'bold 19px system-ui, sans-serif';
    ctx.fillText('BACK ON THE STREET (R)', viewW / 2, buttons.restart.y + 32);
  }

  return {
    buttons,
    drawWorld,
    drawTitle,
    drawPaused,
    drawOver,
    viewRect,
  };
}
