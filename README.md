# Neon Harbor: Port Solano

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/laoyalaoliu/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/laoyalaoliu/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game in a sun-soaked neon coastal city, built
with plain HTML, canvas and ES modules — no libraries, no build step, no
network. Every street, name, sign and sound of Port Solano is invented for
this game and drawn or synthesised in code.

## The story

Port Solano is a pastel harbour town of palm avenues, beach bars and neon —
and fixer **Marisol Vega** runs its errands after dark. You are the driver
she calls when a job needs fast hands and no questions. Run her chain of
four jobs — a sunset package delivery, a checkpoint dash across town, a
lesson in handling real heat, and a final manifest run under full pursuit —
while the Port Solano PD does its best to walk you in. Between jobs the city
is yours: steal anything with wheels, start trouble, and shake the stars.

## What's in the city

- A deterministic seeded city: a grid of avenues and streets, pastel blocks
  with glowing shop signs, parking lots, palm plazas, dock crates, a beach,
  a pier and the sea.
- On-foot play with sprint and a punch; enter and steal any car with **E**.
- Six car types (coupe, sedan, pickup, cab, Vela Spider sportscar, cargo
  van) with arcade driving physics — acceleration, braking, reverse,
  steering and drift-friendly grip — plus police interceptors.
- Traffic AI that drives the road grid, turns at intersections and stops
  for trouble; parked cars everywhere; pedestrians who stroll, flee and fall.
- A 0–5 star wanted system: carjacking, collisions, assaults and mission
  mayhem raise heat; break the police line of sight to cool off. Police
  spawn with the stars, pursue and ram. Get caught slow and close and you
  are **BUSTED**; hit zero health and you are **WASTED**.
- Four chained story missions with on-screen objectives, map markers,
  checkpoints, timers and cash rewards, plus free roam between jobs.
- HUD with health, cash, wanted stars, objective text and timer, a speedo,
  a BUSTED meter, and a live minimap showing streets, traffic, police, the
  player and the objective.
- Day-to-dusk light, neon glow, lamp light and headlight beams, tire smoke,
  skid marks, crash sparks, screen shake, and fully synthesised WebAudio
  sound (engine, siren, punches, crashes, cash) — no audio files.
- Title screen, pause, BUSTED/WASTED end screens, and a localStorage save
  (cash + jobs done) with Continue on the title screen.

## Controls

| Key | Action |
| --- | --- |
| WASD / Arrow keys | Move on foot / drive |
| Shift | Sprint |
| Space | Handbrake |
| E | Enter / exit car (stealing is a crime) |
| F or J | Punch |
| P or Esc | Pause |
| M | Mute |
| R | Restart after BUSTED / WASTED |
| Mouse | Click title and end-screen buttons |

## Run it

```sh
node serve.ts            # serves game/ on http://localhost:8080
# or: node serve.ts --port 8123
```

Then open the URL in desktop Chrome. The game runs fully offline; every
file it loads lives under `game/`.

Deterministic screenshot scenes (used for `screenshots/`):

```text
http://localhost:8123/?shot=cover&seed=1
http://localhost:8123/?shot=chase&seed=1
http://localhost:8123/?shot=mission&seed=1
http://localhost:8123/?shot=downtown&seed=1
```

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and
writes `dossier.json` with the vendored `buildDossier` from
`vendor/makefun-game.ts` (unchanged). Running it twice writes identical
bytes.

## Source map

- `game/src/city.js` — the seeded Port Solano generator and collision
- `game/src/vehicles.js` — car types, driving physics, traffic and police AI
- `game/src/pedestrians.js` — the crowd: stroll, flee, fall
- `game/src/player.js` — on-foot movement, punching, entering cars
- `game/src/wanted.js` — heat, stars, police response, BUSTED
- `game/src/missions.js` — the four-job story chain and objectives
- `game/src/game-state.js` — the whole simulation, stepped at 60 Hz
- `game/src/render.js` — world rendering, day-to-dusk light, menus
- `game/src/hud.js` — HUD and minimap
- `game/src/audio.js` — synthesised sound, `game/src/effects.js` — particles and shake
- `game/src/shots.js` — deterministic screenshot scenes
- `game/src/main.js` — boot, screens and the game loop

<sub>Entered on [make.fun](https://make.fun/?ref=8j9v25ys&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
