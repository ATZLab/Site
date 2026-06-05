/**
 * Ladder game — pure logic, framework-free.
 * Safe to import from both server and client components.
 */

export interface Ladder {
  /** Number of vertical lines (= number of participants). */
  width: number;
  /** Total number of horizontal levels. */
  levels: number;
  /**
   * Rungs indexed by level. Each rung is the LEFT index of a horizontal bar
   * connecting lines `i` and `i + 1`. Multiple rungs per level are not allowed.
   * `null` means no rung at that slot.
   */
  rungs: Array<Array<number | null>>;
}

export interface Assignment {
  participant: string;
  result: string;
  /** Indices of (level, line) the participant visited, top to bottom. */
  path: Array<{ level: number; line: number }>;
}

/**
 * Generate a ladder for `width` participants with `levels` horizontal levels.
 * Rungs are placed left-to-right with a coin flip; overlapping rungs on the
 * same level are skipped so two rungs never share a line.
 */
export function generateLadder(
  width: number,
  levels: number,
  rng: () => number = Math.random,
): Ladder {
  if (width < 2) throw new Error('ladder requires at least 2 participants');
  if (levels < 1) throw new Error('ladder requires at least 1 level');

  const rungs: Array<Array<number | null>> = [];
  for (let level = 0; level < levels; level++) {
    const row: Array<number | null> = new Array(width - 1).fill(null);
    const occupied = new Set<number>();
    for (let i = 0; i < width - 1; i++) {
      if (occupied.has(i)) continue;
      // ~45% chance to add a rung. Skips a slot if previous or next is already occupied.
      if (rng() < 0.45) {
        row[i] = i;
        occupied.add(i);
        if (i + 1 < width - 1) occupied.add(i + 1);
      }
    }
    rungs.push(row);
  }
  return { width, levels, rungs };
}

/**
 * Trace a single path from the top of the ladder. Returns the final line index
 * and the full path (top to bottom) for animation.
 */
export function tracePath(
  ladder: Ladder,
  startLine: number,
): { endLine: number; path: Array<{ level: number; line: number }> } {
  const path: Array<{ level: number; line: number }> = [{ level: -1, line: startLine }];
  let current = startLine;
  for (let level = 0; level < ladder.levels; level++) {
    const rung = ladder.rungs[level];
    if (rung === undefined) continue;
    // Rung to the left?
    if (current > 0 && rung[current - 1] === current - 1) {
      current -= 1;
    } else if (current < ladder.width - 1 && rung[current] === current) {
      current += 1;
    }
    path.push({ level, line: current });
  }
  return { endLine: current, path };
}

/**
 * Run every participant through the ladder and pair them with results based on
 * the line they ended on. Throws if `results.length !== participants.length`.
 */
export function assignResults(
  participants: string[],
  results: string[],
  ladder: Ladder,
): Assignment[] {
  if (participants.length !== ladder.width) {
    throw new Error('participant count must match ladder width');
  }
  if (participants.length !== results.length) {
    throw new Error('results count must match participants count');
  }

  const linesToResults = new Map<number, string>();
  results.forEach((r, i) => linesToResults.set(i, r));

  return participants.map((participant, i) => {
    const { endLine, path } = tracePath(ladder, i);
    return {
      participant,
      result: linesToResults.get(endLine) ?? '',
      path,
    };
  });
}

/** Parse a multi-line textarea into a trimmed, non-empty string list. */
export function parseList(input: string): string[] {
  return input
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
