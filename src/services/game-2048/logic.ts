/**
 * 2048 game — pure logic, framework-free.
 * Variable board size (3×3, 4×4, 5×5, ...). Original implementation.
 */

export type Direction = 'up' | 'down' | 'left' | 'right';

/** Flat row-major array, length = size * size. 0 = empty. */
export type Board = number[];

export const MIN_SIZE = 3;
export const MAX_SIZE = 6;
export const WIN_VALUE = 2048;

export function createEmptyBoard(size: number): Board {
  return new Array(size * size).fill(0);
}

export function boardSize(board: Board): number {
  return Math.round(Math.sqrt(board.length));
}

/** Pick a random empty cell index. Returns -1 if no empty cells. */
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
   Sliding / merging
   ---------------------------------------------------------------- */

/**
 * Slide + merge a 1D row (length = size) toward index 0.
 * Returns the new row and the score gained by merges.
 */
function slideRowLeft(row: number[]): { row: number[]; gained: number } {
  const size = row.length;
  // 1) Compact non-zero values to the left.
  const compact: number[] = [];
  for (let i = 0; i < size; i++) {
    if (row[i] !== 0) compact.push(row[i]!);
  }
  // 2) Merge equal adjacent values, left to right.
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
  // 3) Pad with zeros to size.
  while (merged.length < size) merged.push(0);
  return { row: merged, gained };
}

function reverseRow(row: number[]): number[] {
  return row.slice().reverse();
}

/** Move the board in a given direction. Returns { board, gained, moved }. */
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
        direction === 'up' ? slideRowLeft(col) : slideRowLeft(reverseRow(col));
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
  // For 'down' we slide the column toward index size-1. We achieved that by
  // reversing the column, sliding left, then reversing back.
  return col.slice().reverse();
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
  // No empties — check for any adjacent equal pair.
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
