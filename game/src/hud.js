// The HUD: health, cash, wanted stars and the current objective across the
// top, speed and hints along the bottom, the BUSTED meter when the law is
// closing in, and the minimap — the whole city on one small canvas panel
// with streets, traffic, police, the player and the objective marker.

import { clamp } from './random.js';
import { carSpeed } from './vehicles.js';
import { currentObjective } from './missions.js';
import { wantedStars } from './wanted.js';

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = trial;
  }
  if (line) lines.push(line);
  return lines;
}

function drawTopLeftPanel(ctx, game) {
  ctx.fillStyle = 'rgba(12,16,28,0.62)';
  roundedRect(ctx, 14, 14, 218, 74, 10);
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  // Health bar.
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  roundedRect(ctx, 26, 26, 150, 13, 6);
  ctx.fill();
  const healthRatio = clamp(game.player.health / 100, 0, 1);
  ctx.fillStyle = healthRatio > 0.5 ? '#4ade80' : healthRatio > 0.25 ? '#facc15' : '#ef4444';
  if (healthRatio > 0) {
    roundedRect(ctx, 26, 26, Math.max(8, 150 * healthRatio), 13, 6);
    ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText('HEALTH', 26, 22 + 30);
  ctx.font = '900 21px system-ui, sans-serif';
  ctx.fillStyle = '#7CFC98';
  ctx.fillText(`$${game.cash}`, 26, 78);
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText(game.player.car ? game.player.car.type.name.toUpperCase() : 'ON FOOT', 118, 78);
}

function drawStarsPanel(ctx, game, viewW) {
  const stars = wantedStars(game.wanted);
  ctx.fillStyle = 'rgba(12,16,28,0.62)';
  roundedRect(ctx, viewW - 196, 14, 182, 52, 10);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.font = '26px system-ui, sans-serif';
  for (let i = 0; i < 5; i += 1) {
    const active = i < stars;
    ctx.fillStyle = active ? '#ffd34d' : 'rgba(255,255,255,0.22)';
    if (active) {
      ctx.save();
      ctx.shadowColor = '#ffd34d';
      ctx.shadowBlur = 9;
      ctx.fillText('★', viewW - 168 + i * 34, 52);
      ctx.restore();
    } else ctx.fillText('★', viewW - 168 + i * 34, 52);
  }
  if (stars > 0 && game.wanted.lastCrimeLabel) {
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,160,160,0.95)';
    ctx.fillText(game.wanted.lastCrimeLabel.toUpperCase(), viewW - 105, 82);
  }
}

function drawObjectivePanel(ctx, game, viewW) {
  const objective = currentObjective(game);
  ctx.font = '14px system-ui, sans-serif';
  const lines = wrapText(ctx, objective.text, 470);
  const bannerActive = game.mission.banner && game.time < game.mission.bannerUntil;
  const height = 30 + lines.length * 18 + (bannerActive ? 24 : 0) + (game.mission.timeLeft > 0 && game.mission.active ? 20 : 0);
  const w = 520;
  const x = (viewW - w) / 2;
  ctx.fillStyle = 'rgba(12,16,28,0.66)';
  roundedRect(ctx, x, 12, w, height, 10);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd34d';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(objective.title.toUpperCase(), viewW / 2, 32);
  ctx.fillStyle = '#ffffff';
  ctx.font = '14px system-ui, sans-serif';
  lines.forEach((line, i) => ctx.fillText(line, viewW / 2, 53 + i * 18));
  let cursor = 53 + lines.length * 18;
  if (game.mission.active && game.mission.timeLeft > 0) {
    const left = Math.max(0, game.mission.timeLeft);
    const mm = Math.floor(left / 60);
    const ss = Math.floor(left % 60).toString().padStart(2, '0');
    ctx.fillStyle = left < 16 ? '#ef4444' : '#7CFC98';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(`⏱ ${mm}:${ss}`, viewW / 2, cursor + 4);
    cursor += 20;
  }
  if (bannerActive) {
    ctx.fillStyle = '#ffd34d';
    ctx.font = 'bold 13.5px system-ui, sans-serif';
    const bannerLines = wrapText(ctx, game.mission.banner, 500);
    bannerLines.slice(0, 1).forEach((line) => ctx.fillText(line, viewW / 2, cursor + 6));
  }
}

function drawBustedMeter(ctx, game, viewW, viewH) {
  if (game.wanted.bustMeter <= 0.02 || game.busted) return;
  const w = 260;
  const x = (viewW - w) / 2;
  const y = viewH * 0.62;
  ctx.fillStyle = 'rgba(10,14,30,0.7)';
  roundedRect(ctx, x - 10, y - 26, w + 20, 58, 10);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#7db4ff';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText('BUSTED?', viewW / 2, y - 6);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  roundedRect(ctx, x, y + 2, w, 12, 6);
  ctx.fill();
  ctx.fillStyle = '#3b82f6';
  roundedRect(ctx, x, y + 2, w * clamp(game.wanted.bustMeter, 0, 1), 12, 6);
  ctx.fill();
}

export function drawMinimap(ctx, game, x, y, w, h) {
  const city = game.city;
  const sx = w / city.width;
  const sy = h / city.height;
  ctx.save();
  ctx.fillStyle = 'rgba(10,26,36,0.88)';
  roundedRect(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.beginPath();
  roundedRect(ctx, x, y, w, h, 10);
  ctx.clip();
  // Land, beach, water.
  ctx.fillStyle = '#5d7350';
  ctx.fillRect(x, y, w, city.beachY * sy);
  ctx.fillStyle = '#d9bc72';
  ctx.fillRect(x, y + city.beachY * sy, w, (city.waterY - city.beachY) * sy);
  ctx.fillStyle = '#146a8c';
  ctx.fillRect(x, y + city.waterY * sy, w, (city.height - city.waterY) * sy);
  // Streets.
  ctx.strokeStyle = 'rgba(240,240,240,0.75)';
  ctx.lineWidth = 2;
  for (const ax of city.avenues) {
    ctx.beginPath();
    ctx.moveTo(x + ax * sx, y);
    ctx.lineTo(x + ax * sx, y + city.beachY * sy);
    ctx.stroke();
  }
  for (const syLine of city.streets) {
    ctx.beginPath();
    ctx.moveTo(x, y + syLine * sy);
    ctx.lineTo(x + w, y + syLine * sy);
    ctx.stroke();
  }
  const dot = (wx, wy, color, size) => {
    ctx.fillStyle = color;
    ctx.fillRect(x + wx * sx - size / 2, y + wy * sy - size / 2, size, size);
  };
  for (const car of game.cars) {
    if (car.kind === 'police') continue;
    if (car === game.player.car) continue;
    dot(car.x, car.y, car.kind === 'parked' ? 'rgba(200,200,200,0.5)' : '#ffd9a0', 3);
  }
  const flash = Math.floor(game.time * 2.4) % 2 === 0;
  for (const car of game.cars) {
    if (car.kind !== 'police') continue;
    dot(car.x, car.y, flash ? '#ff5040' : '#4da3ff', 5);
  }
  const objective = currentObjective(game);
  if (objective.target) {
    const pulse = 3.4 + Math.sin(game.time * 5) * 1.1;
    ctx.fillStyle = objective.giver ? '#ffd34d' : '#22d3ee';
    ctx.beginPath();
    ctx.arc(x + objective.target.x * sx, y + objective.target.y * sy, pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  // Player arrow.
  const px = x + game.player.x * sx;
  const py = y + game.player.y * sy;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(game.player.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4.4, -3.8);
  ctx.lineTo(-4.4, 3.8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1.6;
  roundedRect(ctx, x, y, w, h, 10);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('PORT SOLANO', x + 8, y + 14);
}

export function drawHUD(ctx, game, viewW, viewH) {
  drawTopLeftPanel(ctx, game);
  drawStarsPanel(ctx, game, viewW);
  drawObjectivePanel(ctx, game, viewW);
  drawBustedMeter(ctx, game, viewW, viewH);

  const mapW = 208;
  const mapH = 190;
  drawMinimap(ctx, game, viewW - mapW - 14, viewH - mapH - 14, mapW, mapH);

  // Speedometer while driving.
  if (game.player.car) {
    const mph = Math.round(carSpeed(game.player.car) * 0.42);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 30px system-ui, sans-serif';
    ctx.fillText(`${mph}`, viewW - mapW - 30, viewH - 26);
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('MPH', viewW - mapW - 30, viewH - 8);
  }

  // Context hint, bottom-left.
  ctx.textAlign = 'left';
  ctx.font = '12.5px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  const hint = game.player.car
    ? 'WASD drive · Space handbrake · E exit car'
    : 'WASD move · Shift sprint · F punch · E enter car';
  ctx.fillText(hint, 16, viewH - 14);
  if (game.audio.muted) ctx.fillText('SOUND OFF (M)', 16, viewH - 32);

  // Hurt vignette.
  const hurt = game.player.hurtFlash;
  const lowHealth = game.player.health < 30 ? 0.12 + Math.sin(game.time * 5) * 0.05 : 0;
  const alpha = clamp(hurt * 0.55 + lowHealth, 0, 0.5);
  if (alpha > 0.01) {
    const grad = ctx.createRadialGradient(viewW / 2, viewH / 2, viewH * 0.32, viewW / 2, viewH / 2, viewH * 0.75);
    grad.addColorStop(0, 'rgba(200,0,0,0)');
    grad.addColorStop(1, `rgba(200,0,0,${alpha})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, viewW, viewH);
  }
}
