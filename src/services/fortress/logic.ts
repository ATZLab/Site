/**
 * Fortress — pure game logic, framework-free.
 *
 * Coordinate system: y grows downward (canvas convention). Terrain is a
 * flat array of column heights, one per pixel column. Projectiles obey
 * `vx += wind*dt; vy += gravity*dt; x += vx*dt; y += vy*dt`.
 *
 * All distances are in *game pixels* (the low-res 320×200 canvas), not
 * screen pixels. The renderer scales these up.
 */

export const LOGICAL_W = 320;
export const LOGICAL_H = 200;
export const GROUND_Y = 180; // baseline y where terrain sits before generation
export const TANK_W = 14;
export const TANK_H = 8;
export const MAX_HP = 100;

export type Player = 1 | 2;

export interface Tank {
  player: Player;
  /** Top-left x in game pixels. */
  x: number;
  /** Top of tank body (y in game pixels). Derived from terrain height. */
  y: number;
  hp: number;
}

export type Phase =
  | 'aim' // current player adjusting angle/power
  | 'flying' // shell in the air
  | 'landed' // shell just landed, applying damage / destruction
  | 'gameover';

export interface GameState {
  /** Column heights from left to right. y values; higher = more ground. */
  terrain: number[];
  tanks: [Tank, Tank];
  /** Whose turn it is. */
  turn: Player;
  /** Angle in radians (positive = up, measured from horizontal). */
  angle: number;
  /** Power in [0, 1]. Multiplied by MAX_SPEED for initial velocity. */
  power: number;
  /** Wind: horizontal acceleration (px/s²). Negative = left. */
  wind: number;
  phase: Phase;
  /** Active projectile, if any. */
  shell: Shell | null;
  /** Idx of the player who has already seen the win screen this game. */
  winner: Player | null;
  /** Last shot result message, for the brief banner. */
  message: string;
  /** Sequence of turn events for replay/debug; not used in UI yet. */
  history: TurnEvent[];
  /** Current mode. */
  mode: GameMode;
}

export type GameMode = '1p' | '2p';

export interface Shell {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Owner — useful for friendly-fire rules if we ever add them. */
  owner: Player;
  /** Trail of past positions for the smoke trail. */
  trail: Array<{ x: number; y: number }>;
}

export interface TurnEvent {
  turn: Player;
  angle: number;
  power: number;
  wind: number;
  damageDealt: number;
  hit: boolean;
  destroyed: boolean; // direct hit kills the tank
}

// ---------------------------------------------------------------------------
// Terrain
// ---------------------------------------------------------------------------

/** Seeded RNG (mulberry32). Deterministic per seed so we can recreate a
 *  battlefield given its seed. The seed itself is chosen randomly at game
 *  start, so each game is unique. */
function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Build a fresh battlefield: a slightly rolling hill with two flat spots
 *  where the tanks sit. Uses cosine-based low-frequency noise for a
 *  natural-looking silhouette. */
export function generateTerrain(seed: number): number[] {
  const rng = mulberry32(seed);
  const heights = new Array<number>(LOGICAL_W);

  // Base hill shape: cosine with a few harmonics.
  const f1 = 1.4 + rng() * 1.2;
  const f2 = 0.4 + rng() * 0.6;
  const a1 = 18 + rng() * 14;
  const a2 = 8 + rng() * 8;
  const phase1 = rng() * Math.PI * 2;
  const phase2 = rng() * Math.PI * 2;
  const baseLine = GROUND_Y - 30 + rng() * 8;

  for (let x = 0; x < LOGICAL_W; x++) {
    const nx = x / LOGICAL_W;
    // Two flat zones at left/right ends so the tanks sit on stable ground.
    let y: number;
    if (x < 36 || x > LOGICAL_W - 36) {
      y = GROUND_Y - 4;
    } else {
      y =
        baseLine +
        a1 * Math.sin(nx * Math.PI * f1 + phase1) +
        a2 * Math.sin(nx * Math.PI * f2 + phase2);
    }
    // Quantize to integer pixels (canvas pixels) so the terrain has a
    // crisp pixel-art silhouette.
    heights[x] = Math.round(Math.max(40, Math.min(GROUND_Y - 4, y)));
  }
  return heights;
}

/** y of the ground surface at column x. y=0 is top, larger is lower. */
export function groundYAt(terrain: number[], x: number): number {
  const ix = Math.max(0, Math.min(LOGICAL_W - 1, Math.round(x)));
  return terrain[ix]!;
}

/** Apply a circular blast at the given point, carving out a chunk of
 *  terrain. Returns a new terrain array. The blast radius determines how
 *  much is removed. */
export function deformTerrain(
  terrain: number[],
  cx: number,
  cy: number,
  radius: number,
): number[] {
  const next = terrain.slice();
  const r2 = radius * radius;
  const minX = Math.max(0, Math.floor(cx - radius));
  const maxX = Math.min(LOGICAL_W - 1, Math.ceil(cx + radius));
  for (let x = minX; x <= maxX; x++) {
    const dx = x - cx;
    const within = dx * dx <= r2;
    if (!within) continue;
    const dy = Math.sqrt(r2 - dx * dx);
    // The blast removes ground from `cy - dy` down to `cy + dy` at this x.
    // Pixel-art style: round, not circular gradient. We carve the dirt
    // out above the new ground line at this column.
    const newGround = Math.round(cy + dy);
    // Only carve down, never add dirt.
    if (newGround > next[x]!) next[x] = newGround;
  }
  return next;
}

// ---------------------------------------------------------------------------
// Tanks
// ---------------------------------------------------------------------------

/** Place the two tanks on the flat zones at the edges. x is the *center*
 *  of the tank. */
export function placeTanks(terrain: number[]): [Tank, Tank] {
  const x1 = 22;
  const x2 = LOGICAL_W - 22;
  const t1: Tank = {
    player: 1,
    x: x1,
    y: groundYAt(terrain, x1) - TANK_H,
    hp: MAX_HP,
  };
  const t2: Tank = {
    player: 2,
    x: x2,
    y: groundYAt(terrain, x2) - TANK_H,
    hp: MAX_HP,
  };
  return [t1, t2];
}

export function tankCenter(t: Tank): { x: number; y: number } {
  return { x: t.x, y: t.y + TANK_H / 2 };
}

// ---------------------------------------------------------------------------
// Wind
// ---------------------------------------------------------------------------

/** Random wind value, roughly symmetric around 0. Range tuned so it
 *  noticeably bends the trajectory but doesn't dominate over angle. */
export function randomWind(rng: () => number = Math.random): number {
  // [-1, 1] with bias toward 0 (cube for softer extremes).
  const r = (rng() * 2 - 1) * (rng() * 2 - 1) * (rng() * 2 - 1);
  return r * 140; // px/s²
}

// ---------------------------------------------------------------------------
// Shell physics
// ---------------------------------------------------------------------------

export const MAX_SPEED = 220; // px/s
export const GRAVITY = 180; // px/s²
export const EXPLOSION_RADIUS = 26; // terrain deformation
export const HIT_RADIUS = 14; // direct-hit threshold (center-to-center)

/** Convert a (angle, power) pair to an initial velocity vector. Angle is
 *  measured from the horizontal pointing *away* from the tank, so player
 *  1 (on the left) fires to the right (positive x) and player 2 (on the
 *  right) fires to the left (negative x). */
export function initialVelocity(
  player: Player,
  angle: number,
  power: number,
): { vx: number; vy: number } {
  const speed = MAX_SPEED * power;
  const dir = player === 1 ? 1 : -1;
  return {
    vx: Math.cos(angle) * speed * dir,
    vy: -Math.sin(angle) * speed,
  };
}

/** Step a shell forward by `dt` seconds. Returns the new shell, plus a
 *  flag indicating whether the shell has left the playfield (clamp off
 *  the bottom/sides counts as "landed"). */
export function stepShell(
  shell: Shell,
  dt: number,
  wind: number,
  gravity: number,
): Shell {
  const next: Shell = {
    x: shell.x + shell.vx * dt,
    y: shell.y + shell.vy * dt,
    vx: shell.vx + wind * dt,
    vy: shell.vy + gravity * dt,
    owner: shell.owner,
    trail: [...shell.trail, { x: shell.x, y: shell.y }].slice(-12),
  };
  return next;
}

export function shellOutOfBounds(shell: Shell): boolean {
  return (
    shell.x < -4 ||
    shell.x > LOGICAL_W + 4 ||
    shell.y > LOGICAL_H + 4
  );
}

/** True if the shell's current position is at or below the ground
 *  surface at its x. */
export function shellHitsGround(shell: Shell, terrain: number[]): boolean {
  return shell.y >= groundYAt(terrain, shell.x);
}

// ---------------------------------------------------------------------------
// Damage model
// ---------------------------------------------------------------------------

/** Compute damage dealt to a tank given the impact point. Direct hit
 *  (within HIT_RADIUS) → high damage. Proximity damage falls off
 *  linearly. A missed shot that lands on the terrain still deals small
 *  damage if it lands close to the tank. */
export function damageFromImpact(
  impact: { x: number; y: number },
  tank: Tank,
): { damage: number; hit: boolean } {
  const dx = impact.x - tank.x;
  const dy = impact.y - (tank.y + TANK_H / 2);
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist <= HIT_RADIUS) {
    return { damage: 35, hit: true };
  }
  if (dist <= 32) {
    const falloff = 1 - (dist - HIT_RADIUS) / (32 - HIT_RADIUS);
    return { damage: Math.round(18 * falloff), hit: false };
  }
  return { damage: 0, hit: false };
}

// ---------------------------------------------------------------------------
// AI: pick the best (angle, power) to land near the enemy
// ---------------------------------------------------------------------------

/** Simulate a full shot and return the impact point. Used by the AI to
 *  score candidate (angle, power) pairs. */
export function simulateShot(
  from: Tank,
  angle: number,
  power: number,
  wind: number,
  terrain: number[],
  maxSteps = 600,
): { x: number; y: number; hitGround: boolean } {
  const v = initialVelocity(from.player, angle, power);
  let x = from.x;
  let y = from.y;
  const dt = 1 / 30; // 30 fps simulation
  for (let i = 0; i < maxSteps; i++) {
    x += v.vx * dt;
    y += v.vy * dt;
    v.vx += wind * dt;
    v.vy += GRAVITY * dt;
    if (y >= groundYAt(terrain, x)) {
      return { x, y, hitGround: true };
    }
    if (x < 0 || x > LOGICAL_W || y > LOGICAL_H) {
      return { x, y, hitGround: false };
    }
  }
  return { x, y, hitGround: false };
}

/** Pick a (angle, power) for the AI to fire. Strategy: try a grid of
 *  candidates, simulate each, score by distance to enemy (closer = better
 *  with preference for direct hit). Add a little randomness so the AI
 *  doesn't play perfectly and the game stays fun. */
export function chooseAiShot(
  from: Tank,
  target: Tank,
  wind: number,
  terrain: number[],
  rng: () => number = Math.random,
): { angle: number; power: number } {
  const candidates: Array<{ angle: number; power: number; score: number }> = [];
  // Angle range: 25°–75° (radians). Player 2 fires left, so we use
  // the same absolute angle and let initialVelocity flip the sign.
  for (let deg = 25; deg <= 75; deg += 5) {
    for (let p = 0.3; p <= 1; p += 0.1) {
      const angle = (deg * Math.PI) / 180;
      const impact = simulateShot(from, angle, p, wind, terrain);
      const dx = impact.x - target.x;
      const dy = impact.y - (target.y + TANK_H / 2);
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Score: higher = better. Big bonus for direct hit.
      let score = -dist;
      if (dist <= HIT_RADIUS) score += 200;
      candidates.push({ angle, power: p, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  // Take the best, with a small chance of picking one of the next few
  // to add some "personality" to the AI.
  const top = candidates[0]!;
  if (rng() < 0.15 && candidates[1]) {
    return { angle: candidates[1].angle, power: candidates[1].power };
  }
  return { angle: top.angle, power: top.power };
}

// ---------------------------------------------------------------------------
// Game state factory + reducers
// ---------------------------------------------------------------------------

export interface NewGameOptions {
  mode: GameMode;
  seed?: number;
}

export function newGame(opts: NewGameOptions): GameState {
  const seed = opts.seed ?? Math.floor(Math.random() * 1e9);
  const terrain = generateTerrain(seed);
  const tanks = placeTanks(terrain);
  return {
    terrain,
    tanks,
    turn: 1,
    angle: Math.PI / 3, // 60°
    power: 0.5,
    wind: randomWind(),
    phase: 'aim',
    shell: null,
    winner: null,
    message: 'P1의 차례',
    history: [],
    mode: opts.mode,
  };
}

export interface FireResult {
  next: GameState;
}

/** Start a shot: move the game to 'flying' and create a shell. */
export function fire(state: GameState): FireResult {
  if (state.phase !== 'aim') return { next: state };
  const shooter = state.tanks[state.turn - 1]!;
  const v = initialVelocity(shooter.player, state.angle, state.power);
  const shell: Shell = {
    x: shooter.x,
    y: shooter.y,
    vx: v.vx,
    vy: v.vy,
    owner: shooter.player,
    trail: [],
  };
  return {
    next: {
      ...state,
      phase: 'flying',
      shell,
      message: '…',
    },
  };
}

/** Tick the shell one step. Resolves landing / hit / out-of-bounds. */
export function tick(state: GameState, dt: number): FireResult {
  if (state.phase !== 'flying' || !state.shell) return { next: state };

  // Sub-step the integration for stability at high velocities / dt values.
  const steps = Math.max(1, Math.ceil(dt * 60));
  const sdt = dt / steps;
  let shell = state.shell;
  let hitGround = false;
  for (let i = 0; i < steps; i++) {
    shell = stepShell(shell, sdt, state.wind, GRAVITY);
    if (shellOutOfBounds(shell)) {
      const next: GameState = {
        ...state,
        phase: 'landed',
        shell: null,
        message: '멀리 빗나갔어',
        turn: state.turn === 1 ? 2 : 1,
        wind: randomWind(),
        angle: Math.PI / 3,
        power: 0.5,
      };
      return { next };
    }
    if (shellHitsGround(shell, state.terrain)) {
      hitGround = true;
      break;
    }
  }
  if (!hitGround) {
    return { next: { ...state, shell } };
  }
  return resolveLanding(state, shell);
}

/** Resolve a shell that just hit the ground. */
function resolveLanding(state: GameState, shell: Shell): FireResult {
  const impact = { x: shell.x, y: shell.y };
  const enemy = state.tanks[state.turn === 1 ? 1 : 0]!;
  const { damage, hit } = damageFromImpact(impact, enemy);

  // Deform terrain.
  const newTerrain = deformTerrain(state.terrain, impact.x, impact.y, EXPLOSION_RADIUS);

  // Update the enemy tank's position (its y may have changed if the blast
  // shifted the ground under it) and HP.
  const newEnemy: Tank = {
    ...enemy,
    hp: Math.max(0, enemy.hp - damage),
    y: groundYAt(newTerrain, enemy.x) - TANK_H,
  };
  const tanks: [Tank, Tank] =
    state.turn === 1 ? [state.tanks[0]!, newEnemy] : [newEnemy, state.tanks[1]!];
  const newWind = randomWind();
  const turnEnded = newEnemy.hp <= 0;
  const message = turnEnded
    ? `P${state.turn} 승!`
    : hit
      ? `직격! ${damage} 데미지`
      : damage > 0
        ? `근접 폭발 ${damage} 데미지`
        : '빗나갔어';

  const history: TurnEvent[] = [
    ...state.history,
    {
      turn: state.turn,
      angle: state.angle,
      power: state.power,
      wind: state.wind,
      damageDealt: damage,
      hit,
      destroyed: newEnemy.hp <= 0,
    },
  ];

  const next: GameState = {
    ...state,
    terrain: newTerrain,
    tanks,
    phase: turnEnded ? 'gameover' : 'landed',
    shell: null,
    winner: turnEnded ? state.turn : null,
    message,
    history,
    turn: turnEnded ? state.turn : state.turn === 1 ? 2 : 1,
    wind: turnEnded ? state.wind : newWind,
    angle: Math.PI / 3,
    power: 0.5,
  };
  return { next };
}

/** After the brief 'landed' phase, transition back to 'aim' (or stay
 *  'gameover'). The component calls this on a timer to give the player
 *  time to read the result. */
export function acknowledgeLanding(state: GameState): FireResult {
  if (state.phase !== 'landed') return { next: state };
  return { next: { ...state, phase: 'aim' } };
}

export function setAngle(state: GameState, angle: number): GameState {
  if (state.phase !== 'aim') return state;
  const clamped = Math.max(0.15, Math.min(Math.PI / 2 - 0.05, angle));
  return { ...state, angle: clamped };
}

export function setPower(state: GameState, power: number): GameState {
  if (state.phase !== 'aim') return state;
  const clamped = Math.max(0, Math.min(1, power));
  return { ...state, power: clamped };
}
