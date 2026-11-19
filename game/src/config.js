// Neon Harbor: Port Solano — shared tuning constants for the whole game.
// Every module reads its numbers from here so the city size, road layout and
// difficulty stay in one place.

export const GAME_TITLE = 'Neon Harbor: Port Solano';
export const STEP = 1 / 60;
export const SAVE_KEY = 'neon-harbor-port-solano-save-v1';

// City layout: a grid of avenues and streets over a pitch, with a beach and
// the sea along the south edge.
export const ROAD_PITCH = 320;
export const ROAD_HALF = 46;
export const ROAD_COLS = 6;
export const ROAD_ROWS = 5;
export const CITY_MARGIN = 200;
export const BEACH_Y = 1700;
export const WATER_Y = 1850;
export const WORLD_WIDTH = CITY_MARGIN * 2 + (ROAD_COLS - 1) * ROAD_PITCH;
export const WORLD_HEIGHT = 2120;

// Player tuning.
export const PLAYER_RADIUS = 11;
export const PLAYER_WALK_SPEED = 175;
export const PLAYER_SPRINT_SPEED = 295;
export const PLAYER_MAX_HEALTH = 100;
export const PUNCH_RANGE = 34;
export const ENTER_CAR_RANGE = 52;

// Wanted tuning: heat is a float 0..5, stars shown are ceil(heat).
export const MAX_HEAT = 5;
export const HEAT_DECAY_PER_SECOND = 0.055;
export const HEAT_SIGHT_RANGE = 380;
export const BUST_SECONDS = 2.2;

// Camera and view.
export const CAMERA_LERP = 5.5;
export const DAY_CYCLE_SECONDS = 240;

// Colours of the sun-soaked neon coast.
export const PALETTE = {
  asphalt: '#33373f',
  asphaltEdge: '#2b2f36',
  sidewalk: '#b8ab98',
  blockGround: '#8f9a7d',
  sand: '#ecd28f',
  water: '#1d7f9e',
  waterDeep: '#146a8c',
  grass: '#7fae6d',
};
