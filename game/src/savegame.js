// The save: cash and story progress in localStorage, so the start screen can
// offer Continue. Storage failures (private windows) degrade to no save.

import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || typeof data.missionsDone !== 'number') return null;
    return { cash: Math.max(0, Math.floor(data.cash)), missionsDone: Math.max(0, Math.floor(data.missionsDone)) };
  } catch {
    return null;
  }
}

export function writeSave(cash, missionsDone) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({ cash, missionsDone }));
  } catch {
    // No storage: progress lasts for this visit only.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear.
  }
}
