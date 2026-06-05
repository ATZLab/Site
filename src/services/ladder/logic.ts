/**
 * Ladder game — pure logic, framework-free.
 * Safe to import from both server and client components.
 */

export interface Ladder {
  /** Number of vertical lines. Equals max(names, results) at assignment time. */
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
  name: string;
  result: string;
  /** The line the name ends on after the trace (the result is the label there). */
  endLine: number;
  /** Indices of (level, line) the name visited, top to bottom. */
  path: Array<{ level: number; line: number }>;
  /** Index in the assignments array (== the starting line on the ladder). */
  nameIndex: number;
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
  if (width < 2) throw new Error('ladder requires at least 2 lines');
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

/** Pick a random integer in [min, max] inclusive. */
export function randomLevels(
  min: number,
  max: number,
  rng: () => number = Math.random,
): number {
  if (max < min) throw new Error('randomLevels: max must be >= min');
  return Math.floor(rng() * (max - min + 1)) + min;
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
 * Match names to results. Name and result counts can differ.
 *   - If `names.length < results.length`: ladder width = results.length, names
 *     are placed at the first N lines, results fill the bottom; unmatched
 *     results (lines no name traces to) are simply not assigned.
 *   - If `names.length > results.length`: ladder width = names.length, results
 *     fill the first M lines, and any name tracing to a line beyond M gets "".
 *   - The function only traces non-empty names; empty name rows are ignored.
 */
export function assignResults(
  names: string[],
  results: string[],
  ladder: Ladder,
): Assignment[] {
  const width = ladder.width;
  const paddedNames = names.slice(0, width);
  const paddedResults = results.slice(0, width);
  while (paddedNames.length < width) paddedNames.push('');
  while (paddedResults.length < width) paddedResults.push('');

  return paddedNames.map((name, i) => {
    if (name === '') {
      // Empty input row — no path to trace.
      return { name: '', result: '', endLine: i, path: [], nameIndex: i };
    }
    const { endLine, path } = tracePath(ladder, i);
    return {
      name,
      result: paddedResults[endLine] ?? '',
      endLine,
      path,
      nameIndex: i,
    };
  });
}
