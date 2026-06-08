/**
 * 2048 game — pure logic, framework-free.
 * Variable board size (3×3, 4×4, 5×5, ...). Original implementation.
 *
 * Two state representations are supported:
 *   - `Board`: flat row-major `number[]` (the values; identity not tracked).
 *   - `Tile[]`: full tile objects with stable IDs, positions, and values.
 *
 * `Board` is convenient for win/lose checks. `Tile[]` is what the UI
 * actually renders, because stable IDs let React animate the slide of
 * each individual tile as the board changes.
 */

export type Direction = 'up' | 'down' | 'left' | 'right';

/** Flat row-major array, length = size * size. 0 = empty. */
export type Board = number[];

/* ----------------------------------------------------------------
   Tiles (stable-identity state)
   ---------------------------------------------------------------- */

export interface Tile {
  id: string;
  row: number;
  col: number;
  value: number;
}

let _idCounter = 0;
function nextId(): string {
  _idCounter += 1;
  return `t${_idCounter}`;
}

/** Convert a flat board to a list of tiles. Each non-zero cell gets a fresh
 *  ID. Used when bootstrapping a new game. */
export function tilesFromBoard(board: Board): Tile[] {
  const size = boardSize(board);
  const tiles: Tile[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const v = board[r * size + c]!;
      if (v !== 0) {
        tiles.push({ id: nextId(), row: r, col: c, value: v });
      }
    }
  }
  return tiles;
}

export const MIN_SIZE = 3;
export const MAX_SIZE = 6;
export const WIN_VALUE = 2048;

export function createEmptyBoard(size: number): Board {
  return new Array(size * size).fill(0);
}

export function boardSize(board: Board): number {
  return Math.round(Math.sqrt(board.length));
}

/** Flatten a tile list back into a `Board` (useful for win/lose checks). */
export function boardFromTiles(tiles: Tile[], size: number): Board {
  const board = createEmptyBoard(size);
  for (const t of tiles) {
    if (t.value === 0) continue;
    board[t.row * size + t.col] = t.value;
  }
  return board;
}

/** Pick a random empty cell index from a `Board`. Returns -1 if full. */
function pickRandomEmpty(board: Board, rng: () => number): number {
  const empties: number[] = [];
  for (let i = 0; i < board.length; i++) if (board[i] === 0) empties.push(i);
  if (empties.length === 0) return -1;
  const idx = Math.floor(rng() * empties.length);
  return empties[idx]!;
}

/** Place a 2 (90%) or 4 (10%) at a random empty cell. Returns a new board. */
export function addRandomTile(board: Board, rng: () => number = Math.random): Board {
  const idx = pickRandomEmpty(board, rng);
  if (idx === -1) return board.slice();
  const next = board.slice();
  next[idx] = rng() < 0.9 ? 2 : 4;
  return next;
}

/** Bootstrap a new game: empty board with two starting tiles. */
export function newGame(size: number, rng: () => number = Math.random): Board {
  let board = createEmptyBoard(size);
  board = addRandomTile(board, rng);
  board = addRandomTile(board, rng);
  return board;
}

/* ----------------------------------------------------------------
   Sliding / merging on a flat board
   ---------------------------------------------------------------- */

/** Slide + merge a 1D row (length = size) toward index 0. */
function slideRowLeft(row: number[]): { row: number[]; gained: number } {
  const size = row.length;
  const compact: number[] = [];
  for (let i = 0; i < size; i++) {
    if (row[i] !== 0) compact.push(row[i]!);
  }
  const merged: number[] = [];
  let gained = 0;
  let i = 0;
  while (i < compact.length) {
    const cur = compact[i]!;
    const next = compact[i + 1];
    if (next !== undefined && next === cur) {
      const v = cur * 2;
      merged.push(v);
      gained += v;
      i += 2;
    } else {
      merged.push(cur);
      i += 1;
    }
  }
  while (merged.length < size) merged.push(0);
  return { row: merged, gained };
}

function reverseRow(row: number[]): number[] {
  return row.slice().reverse();
}

/** Move the board in a given direction. Returns `{ board, gained, moved }`. */
export function move(
  board: Board,
  direction: Direction,
): { board: Board; gained: number; moved: boolean } {
  const size = boardSize(board);
  const next: Board = new Array(size * size).fill(0);
  let totalGained = 0;
  let anyMoved = false;

  if (direction === 'left' || direction === 'right') {
    for (let r = 0; r < size; r++) {
      const row: number[] = [];
      for (let c = 0; c < size; c++) row.push(board[r * size + c]!);
      const processed =
        direction === 'left' ? slideRowLeft(row) : slideRowLeft(reverseRow(row));
      const finalRow = direction === 'left' ? processed.row : reverseRow(processed.row);
      for (let c = 0; c < size; c++) {
        const v = finalRow[c]!;
        const prev = board[r * size + c]!;
        next[r * size + c] = v;
        if (v !== prev) anyMoved = true;
      }
      totalGained += processed.gained;
    }
  } else {
    for (let c = 0; c < size; c++) {
      const col: number[] = [];
      for (let r = 0; r < size; r++) col.push(board[r * size + c]!);
      const processed =
        direction === 'up' ? slideRowLeft(col) : slideRowLeft(reverseCol(col));
      const finalCol = direction === 'up' ? processed.row : reverseCol(processed.row);
      for (let r = 0; r < size; r++) {
        const v = finalCol[r]!;
        const prev = board[r * size + c]!;
        next[r * size + c] = v;
        if (v !== prev) anyMoved = true;
      }
      totalGained += processed.gained;
    }
  }

  return { board: next, gained: totalGained, moved: anyMoved };
}

function reverseCol(col: number[]): number[] {
  return col.slice().reverse();
}

/* ----------------------------------------------------------------
   Sliding / merging on `Tile[]` — preserves tile identity
   ---------------------------------------------------------------- */

export interface ApplyMoveResult {
  tiles: Tile[];
  gained: number;
  moved: boolean;
  /** IDs of tiles that doubled in value this turn (need pop animation). */
  mergedIds: ReadonlySet<string>;
}

interface OrderedLine {
  /** Tiles in this line, ordered from the "near" edge (the edge they slide
   *  toward) to the "far" edge. */
  nearToFar: Tile[];
}

/** Group tiles into lines and order them by slide direction. */
function buildLines(tiles: Tile[], size: number, direction: Direction): OrderedLine[] {
  const lines: OrderedLine[] = [];
  if (direction === 'left' || direction === 'right') {
    for (let r = 0; r < size; r++) {
      const inRow = tiles.filter((t) => t.row === r).sort((a, b) => a.col - b.col);
      lines.push({ nearToFar: direction === 'left' ? inRow : inRow.slice().reverse() });
    }
  } else {
    for (let c = 0; c < size; c++) {
      const inCol = tiles.filter((t) => t.col === c).sort((a, b) => a.row - b.row);
      lines.push({ nearToFar: direction === 'up' ? inCol : inCol.slice().reverse() });
    }
  }
  return lines;
}

/**
 * Slide all tiles one step in `direction`. Preserves tile IDs.
 *
 * For each line, we walk near → far. We keep a "slot" that tracks the
 * position the last-placed tile occupies. The first tile of a merge pair
 * claims the slot and doubles in value; the second tile is dropped from
 * the result. All remaining tiles slide forward into the gap.
 */
export function applyMove(
  tiles: Tile[],
  size: number,
  direction: Direction,
): ApplyMoveResult {
  const lines = buildLines(tiles, size, direction);
  const kept: Tile[] = [];
  const mergedIds = new Set<string>();
  let totalGained = 0;
  let anyMoved = false;

  for (const { nearToFar } of lines) {
    let slot = -1; // index in the line where the last-placed tile sits
    let slotTile: Tile | null = null;
    for (const tile of nearToFar) {
      if (slotTile && slotTile.value === tile.value) {
        // Merge: the previous tile absorbs this one.
        const newValue = slotTile.value * 2;
        totalGained += newValue;
        const merged: Tile = {
          id: slotTile.id,
          row: direction === 'down' || direction === 'up' ? slotTile.row : slotTile.row,
          col: direction === 'left' || direction === 'right' ? slotTile.col : slotTile.col,
          value: newValue,
        };
        // Rewrite `merged` to the slot's current (row, col) — it's already
        // there for slotTile; we just need the new value.
        merged.value = newValue;
        slotTile = merged;
        mergedIds.add(slotTile.id);
        // The absorbed tile is dropped — don't push it.
        anyMoved = true;
        continue;
      }
      // No merge: advance the slot, place this tile there.
      slot += 1;
      const newPos =
        direction === 'left'
          ? { row: tile.row, col: slot }
          : direction === 'right'
            ? { row: tile.row, col: size - 1 - slot }
            : direction === 'up'
              ? { row: slot, col: tile.col }
              : { row: size - 1 - slot, col: tile.col };
      if (newPos.row !== tile.row || newPos.col !== tile.col) anyMoved = true;
      const placed: Tile = { id: tile.id, row: newPos.row, col: newPos.col, value: tile.value };
      kept.push(placed);
      slotTile = placed;
    }
  }

  return { tiles: kept, gained: totalGained, moved: anyMoved, mergedIds };
}

/** Pick a random empty cell, given a list of occupied tiles. Returns null if
 *  the board is full. */
function pickRandomEmptyCell(
  tiles: Tile[],
  size: number,
  rng: () => number,
): { row: number; col: number } | null {
  const occupied = new Set<string>();
  for (const t of tiles) occupied.add(`${t.row},${t.col}`);
  const empties: { row: number; col: number }[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!occupied.has(`${r},${c}`)) empties.push({ row: r, col: c });
    }
  }
  if (empties.length === 0) return null;
  return empties[Math.floor(rng() * empties.length)]!;
}

export interface AddTileResult {
  tiles: Tile[];
  /** ID of the new tile, or null if no empty cell. */
  spawnedId: string | null;
}

/** Append a new 2/4 tile to a random empty cell. Returns the new tile list
 *  and the ID of the spawned tile (used to trigger a one-shot spawn
 *  animation). */
export function addRandomTileToTiles(
  tiles: Tile[],
  size: number,
  rng: () => number = Math.random,
): AddTileResult {
  const cell = pickRandomEmptyCell(tiles, size, rng);
  if (!cell) return { tiles: tiles.slice(), spawnedId: null };
  const value = rng() < 0.9 ? 2 : 4;
  const id = nextId();
  const newTile: Tile = { id, row: cell.row, col: cell.col, value };
  return { tiles: [...tiles, newTile], spawnedId: id };
}

/* ----------------------------------------------------------------
   Win / lose detection
   ---------------------------------------------------------------- */

export function hasWon(board: Board): boolean {
  for (const v of board) if (v >= WIN_VALUE) return true;
  return false;
}

export function canMove(board: Board): boolean {
  const size = boardSize(board);
  for (let i = 0; i < board.length; i++) {
    if (board[i] === 0) return true;
  }
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const v = board[r * size + c]!;
      if (c + 1 < size && board[r * size + c + 1] === v) return true;
      if (r + 1 < size && board[(r + 1) * size + c] === v) return true;
    }
  }
  return false;
}

export function isGameOver(board: Board): boolean {
  return !canMove(board);
}

/** Tile's "tier" for coloring. Reuses the same breakpoints as the fortune
 *  service so the visual language stays consistent across the lab. */
export function tileTier(value: number): 0 | 1 | 2 | 3 | 4 | 5 {
  if (value === 0) return 0;
  if (value <= 4) return 1;
  if (value <= 16) return 2;
  if (value <= 64) return 3;
  if (value <= 256) return 4;
  return 5;
}
