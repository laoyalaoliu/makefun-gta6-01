// The story of Neon Harbor: four jobs for fixer Marisol Vega and friends —
// a package run, a checkpoint dash across town, a lesson in shaking the
// heat, and a final manifest delivery under pursuit. Missions chain: finish
// one and the next giver marker appears on the map. Between jobs, free roam.

import { avenueX, sidewalkPoint, streetY } from './city.js';
import { distance } from './random.js';
import { addPopup } from './effects.js';
import { wantedStars } from './wanted.js';

function giverSpot(city, avenue, street, corner) {
  return sidewalkPoint(city, avenueX(avenue), streetY(street), corner);
}

export const MISSIONS = [
  {
    id: 'sunset-package',
    title: 'Sunset Package',
    giver: 'Marisol Vega',
    intro: 'Marisol needs a package moved, no questions. Meet her by the pier.',
    reward: 350,
    giverAt: (city) => giverSpot(city, 1, 4, 2),
    stages: [
      { kind: 'go', label: 'Meet Marisol Vega by the pier', at: (city) => giverSpot(city, 1, 4, 2), radius: 42 },
      { kind: 'go', label: 'Pick up the package at the Harbor Warehouse', at: (city) => giverSpot(city, 5, 4, 1), radius: 46, pickup: true },
      { kind: 'go', label: 'Deliver the package to Cafe Lumen', at: (city) => giverSpot(city, 0, 0, 3), radius: 46 },
    ],
  },
  {
    id: 'harbor-dash',
    title: 'Harbor Dash',
    giver: 'Dario Venn',
    intro: 'Dario bets nobody can cross Port Solano fast. Prove him wrong.',
    reward: 500,
    giverAt: (city) => giverSpot(city, 2, 1, 0),
    stages: [
      { kind: 'go', label: 'Meet Dario Venn downtown', at: (city) => giverSpot(city, 2, 1, 0), radius: 42 },
      {
        kind: 'checkpoints',
        label: 'Blast through every checkpoint before the clock runs out',
        time: 115,
        points: (city) => [
          { x: avenueX(4), y: streetY(0) },
          { x: avenueX(5), y: streetY(2) },
          { x: avenueX(3), y: streetY(4) },
          { x: avenueX(0), y: streetY(3) },
          { x: avenueX(2), y: streetY(1) },
        ],
        radius: 58,
      },
    ],
  },
  {
    id: 'three-star-heat',
    title: 'Three-Star Heat',
    giver: 'Rocco Fenn',
    intro: 'Rocco wants to know if you can handle real heat. Show him.',
    reward: 650,
    giverAt: (city) => giverSpot(city, 4, 3, 1),
    stages: [
      { kind: 'go', label: 'Meet Rocco Fenn at the east garage', at: (city) => giverSpot(city, 4, 3, 1), radius: 42 },
      { kind: 'reachHeat', label: 'Make some noise: reach 3 wanted stars', heat: 3 },
      { kind: 'loseHeat', label: 'Now lose the Port Solano PD completely' },
    ],
  },
  {
    id: 'midnight-manifest',
    title: 'The Midnight Manifest',
    giver: 'Marisol Vega',
    intro: 'One last job: the harbor manifest, delivered under the lights.',
    reward: 1200,
    giverAt: (city) => giverSpot(city, 1, 4, 2),
    stages: [
      { kind: 'go', label: 'Meet Marisol Vega by the pier', at: (city) => giverSpot(city, 1, 4, 2), radius: 42 },
      { kind: 'go', label: 'Collect the manifest at the Harbor Warehouse', at: (city) => giverSpot(city, 5, 4, 1), radius: 46, pickup: true, heatOnPickup: 3 },
      { kind: 'timedGo', label: 'Deliver the manifest to the Vista Heights lookout', at: (city) => giverSpot(city, 5, 0, 0), radius: 50, time: 170 },
    ],
  },
];

export function createMissionState(city, missionsDone) {
  return {
    index: Math.min(missionsDone, MISSIONS.length),
    active: false,
    stage: 0,
    checkpoint: 0,
    timeLeft: 0,
    banner: '',
    bannerUntil: 0,
  };
}

export function currentMission(game) {
  return MISSIONS[game.mission.index] || null;
}

function setBanner(game, text, seconds) {
  game.mission.banner = text;
  game.mission.bannerUntil = game.time + seconds;
}

/** The objective line and world target the HUD and minimap should show. */
export function currentObjective(game) {
  const mission = currentMission(game);
  if (!mission) {
    return { title: 'Free Roam', text: 'Port Solano is yours. Story complete — cause some sunshine.', target: null };
  }
  if (!game.mission.active) {
    return {
      title: `Next job: ${mission.title}`,
      text: `See ${mission.giver} — follow the gold marker. ${mission.intro}`,
      target: mission.giverAt(game.city),
      giver: true,
    };
  }
  const stage = mission.stages[game.mission.stage];
  let target = null;
  if (stage.kind === 'go' || stage.kind === 'timedGo') target = stage.at(game.city);
  if (stage.kind === 'checkpoints') target = stage.points(game.city)[game.mission.checkpoint];
  let text = stage.label;
  if (stage.kind === 'checkpoints') text += ` (${game.mission.checkpoint + 1}/${stage.points(game.city).length})`;
  if (stage.kind === 'reachHeat') text += ` — now: ${wantedStars(game.wanted)} stars`;
  return { title: mission.title, text, target };
}

function startStage(game, mission, stageIndex) {
  const stage = mission.stages[stageIndex];
  game.mission.stage = stageIndex;
  game.mission.checkpoint = 0;
  if (stage.kind === 'checkpoints' || stage.kind === 'timedGo') game.mission.timeLeft = stage.time;
  else game.mission.timeLeft = 0;
}

function failMission(game, reason) {
  game.mission.active = false;
  setBanner(game, `Job failed: ${reason}. See the giver to try again.`, 5);
  game.audio.missionFail();
}

function completeMission(game, mission) {
  game.mission.active = false;
  game.mission.index += 1;
  game.cash += mission.reward;
  game.missionsDone = Math.max(game.missionsDone, game.mission.index);
  addPopup(game.effects, game.player.x, game.player.y - 44, `+$${mission.reward}`, '#7CFC98');
  game.audio.cash();
  game.audio.missionComplete();
  if (game.mission.index >= MISSIONS.length) {
    setBanner(game, `STORY COMPLETE — "${mission.title}" done. Port Solano is yours.`, 7);
    game.storyComplete = true;
  } else {
    setBanner(game, `Job done: "${mission.title}" — $${mission.reward} earned. Next marker is on the map.`, 6);
  }
  game.saveProgress();
}

function advanceStage(game, mission) {
  const next = game.mission.stage + 1;
  if (next >= mission.stages.length) completeMission(game, mission);
  else {
    startStage(game, mission, next);
    game.audio.pickup();
  }
}

/** Per-step mission logic: markers, checkpoints, timers, heat goals. */
export function updateMissions(game, dt) {
  const state = game.mission;
  const mission = currentMission(game);
  if (!mission) return;
  const px = game.player.x;
  const py = game.player.y;

  if (!state.active) {
    const giver = mission.giverAt(game.city);
    if (distance(px, py, giver.x, giver.y) < 44) {
      state.active = true;
      startStage(game, mission, 0);
      setBanner(game, `${mission.title} — ${mission.intro}`, 5);
      game.audio.pickup();
    }
    return;
  }

  const stage = mission.stages[state.stage];
  if (stage.kind === 'go' || stage.kind === 'timedGo') {
    const target = stage.at(game.city);
    if (stage.kind === 'timedGo') {
      state.timeLeft -= dt;
      if (state.timeLeft <= 0) { failMission(game, 'out of time'); return; }
    }
    if (distance(px, py, target.x, target.y) < stage.radius) {
      if (stage.pickup) {
        addPopup(game.effects, px, py - 36, stage.heatOnPickup ? 'MANIFEST TAKEN — GO!' : 'PACKAGE PICKED UP', '#ffd34d');
        if (stage.heatOnPickup) game.wanted.heat = Math.max(game.wanted.heat, stage.heatOnPickup);
      }
      advanceStage(game, mission);
    }
    return;
  }
  if (stage.kind === 'checkpoints') {
    state.timeLeft -= dt;
    if (state.timeLeft <= 0) { failMission(game, 'the clock beat you'); return; }
    const points = stage.points(game.city);
    const point = points[state.checkpoint];
    if (distance(px, py, point.x, point.y) < stage.radius) {
      state.checkpoint += 1;
      game.audio.pickup();
      addPopup(game.effects, px, py - 36, `CHECKPOINT ${state.checkpoint}/${points.length}`, '#7CFC98');
      if (state.checkpoint >= points.length) advanceStage(game, mission);
    }
    return;
  }
  if (stage.kind === 'reachHeat') {
    if (game.wanted.heat >= stage.heat - 0.01 || wantedStars(game.wanted) >= stage.heat) advanceStage(game, mission);
    return;
  }
  if (stage.kind === 'loseHeat') {
    if (game.wanted.heat <= 0.01) advanceStage(game, mission);
  }
}
