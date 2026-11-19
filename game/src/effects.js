// Juice: particles (tire smoke, crash sparks, sea spray), fading skid marks,
// floating text popups ("+$350", "BUSTED meter" warnings) and screen shake.
// Everything is pooled in plain arrays on the game state and drawn by render.

import { clamp } from './random.js';

export function createEffects() {
  return {
    particles: [],
    skids: [],
    popups: [],
    shake: 0,
    flash: 0,
  };
}

export function addShake(effects, amount) {
  effects.shake = Math.min(16, effects.shake + amount);
}

export function spawnParticles(effects, x, y, count, options) {
  const { color, speed, life, size, gravity } = options;
  for (let i = 0; i < count; i += 1) {
    if (effects.particles.length > 420) break;
    const angle = Math.random() * Math.PI * 2;
    const velocity = speed * (0.3 + Math.random() * 0.9);
    effects.particles.push({
      x, y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      life: life * (0.6 + Math.random() * 0.7),
      age: 0,
      size: size * (0.6 + Math.random() * 0.8),
      color,
      gravity: gravity || 0,
    });
  }
}

export function spawnTireSmoke(effects, x, y) {
  spawnParticles(effects, x, y, 2, { color: 'rgba(235,235,235,0.5)', speed: 34, life: 0.7, size: 7 });
}

export function spawnCrashSparks(effects, x, y, strength) {
  spawnParticles(effects, x, y, Math.floor(6 + strength * 14), { color: '#ffd34d', speed: 190, life: 0.4, size: 3 });
  spawnParticles(effects, x, y, Math.floor(3 + strength * 6), { color: '#ff7a45', speed: 120, life: 0.55, size: 4 });
}

export function spawnSeaSpray(effects, x, y) {
  spawnParticles(effects, x, y, 3, { color: 'rgba(210,245,255,0.8)', speed: 60, life: 0.5, size: 4, gravity: 160 });
}

export function addSkidMark(effects, x, y, angle) {
  effects.skids.push({ x, y, angle, age: 0 });
  if (effects.skids.length > 700) effects.skids.shift();
}

export function addPopup(effects, x, y, text, color) {
  effects.popups.push({ x, y, text, color: color || '#ffffff', age: 0, life: 1.6 });
}

export function updateEffects(effects, dt) {
  for (const particle of effects.particles) {
    particle.age += dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += (particle.gravity || 0) * dt;
    particle.vx *= 0.98;
    particle.vy *= 0.98;
  }
  effects.particles = effects.particles.filter((p) => p.age < p.life);
  for (const skid of effects.skids) skid.age += dt;
  effects.skids = effects.skids.filter((s) => s.age < 14);
  for (const popup of effects.popups) {
    popup.age += dt;
    popup.y -= 26 * dt;
  }
  effects.popups = effects.popups.filter((p) => p.age < p.life);
  effects.shake = Math.max(0, effects.shake - dt * 26);
  effects.flash = Math.max(0, effects.flash - dt * 2.4);
}

/** Random camera offset for this frame, scaled by the remaining shake. */
export function shakeOffset(effects) {
  const s = effects.shake;
  if (s <= 0.05) return { x: 0, y: 0 };
  return { x: (Math.random() * 2 - 1) * s, y: (Math.random() * 2 - 1) * s };
}

export function particleAlpha(particle) {
  return clamp(1 - particle.age / particle.life, 0, 1);
}
