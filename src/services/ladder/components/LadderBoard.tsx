'use client';

import { useMemo } from 'react';
import type { Assignment, Ladder } from '@/services/ladder/logic';

interface RevealState {
  mode: 'all' | 'single';
  revealedNames: Set<number>;
  resultsShown: boolean;
}

interface LadderBoardProps {
  ladder: Ladder;
  assignments: Assignment[];
  reveal: RevealState;
  onRevealName: (nameIndex: number) => void;
}

// Geometry — keep all in SVG units; SVG scales the canvas to fit.
const CELL_W = 48;
const CELL_H = 20;
const TOP_PAD = 30;
const BOTTOM_PAD = 38;
const SIDE_PAD = 24;
const PILL_W = 44;
const PILL_H = 16;

const PATH_DRAW_MS = 1100;
const RUNG_FADE_MS = 220;

interface Path {
  nameIndex: number;
  endLine: number;
  points: Array<[number, number]>;
  polyline: string;
  length: number;
}

export function LadderBoard({ ladder, assignments, reveal, onRevealName }: LadderBoardProps) {
  const { width, levels, rungs } = ladder;

  const totalW = SIDE_PAD * 2 + (width - 1) * CELL_W;
  const totalH = TOP_PAD + levels * CELL_H + BOTTOM_PAD;

  const lineX = useMemo(
    () => Array.from({ length: width }, (_, i) => SIDE_PAD + i * CELL_W),
    [width],
  );
  const rungY = useMemo(
    () => Array.from({ length: levels }, (_, j) => TOP_PAD + (j + 1) * CELL_H),
    [levels],
  );

  // Pre-compute every path so we can stagger their reveal.
  const paths = useMemo<Path[]>(() => {
    return assignments
      .filter((a) => a.name !== '')
      .map((a) => {
        let current = a.nameIndex;
        const points: Array<[number, number]> = [[lineX[current] ?? 0, TOP_PAD]];
        for (let level = 0; level < levels; level++) {
          const row = rungs[level];
          if (row === undefined) continue;
          if (current > 0 && row[current - 1] === current - 1) {
            current -= 1;
          } else if (current < width - 1 && row[current] === current) {
            current += 1;
          }
          points.push([lineX[current] ?? 0, rungY[level] ?? 0]);
        }
        points.push([lineX[current] ?? 0, TOP_PAD + levels * CELL_H]);
        const length = polylineLength(points);
        return {
          nameIndex: a.nameIndex,
          endLine: current,
          points,
          polyline: points.map(([x, y]) => `${x},${y}`).join(' '),
          length,
        };
      });
  }, [assignments, rungs, levels, width, lineX, rungY]);

  // End line → result label (keyed by the actual endLine, not assignment index).
  const resultByEndLine = useMemo(() => {
    const m = new Map<number, string>();
    assignments.forEach((a) => {
      if (a.result !== '') m.set(a.endLine, a.result);
    });
    return m;
  }, [assignments]);

  const totalRungs = rungs.reduce((acc, row) => acc + row.filter((r) => r !== null).length, 0);
  const visibleRungCount = reveal.mode === 'all' ? totalRungs : 0;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${totalW} ${totalH}`}
        preserveAspectRatio="xMidYMid meet"
        style={{
          maxWidth: '100%',
          maxHeight: 360,
          height: 'auto',
          display: 'block',
          margin: '0 auto',
        }}
        role="img"
        aria-label="사다리 타기 보드"
      >
        {/* Vertical lines. */}
        {lineX.map((x, i) => (
          <line
            key={`v-${i}`}
            x1={x}
            y1={TOP_PAD}
            x2={x}
            y2={TOP_PAD + levels * CELL_H}
            stroke="#e4e4e7"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        ))}

        {/* Rungs — fade in once the game starts (single click) or all at once with
            staggered delays for "reveal all". We map each rung to a "stagger order"
            and conditionally apply the visible style. */}
        {rungs.map((row, level) =>
          row.map((leftIdx, i) => {
            if (leftIdx === null) return null;
            const x1 = lineX[i] ?? 0;
            const x2 = lineX[i + 1] ?? 0;
            const y = rungY[level] ?? 0;
            // Stagger order = rung count up to this point.
            let order = 0;
            for (let lv = 0; lv < level; lv++) {
              const r = rungs[lv];
              if (r) order += r.filter((x) => x !== null).length;
            }
            order += row.slice(0, i).filter((x) => x !== null).length;
            const visible = reveal.mode === 'all' && order < visibleRungCount;
            return (
              <line
                key={`r-${level}-${i}`}
                x1={x1}
                y1={y}
                x2={x2}
                y2={y}
                stroke="#a1a1aa"
                strokeWidth={1.5}
                strokeLinecap="round"
                style={{
                  opacity: visible ? 1 : 0,
                  transition: `opacity ${RUNG_FADE_MS}ms ease-out`,
                }}
              />
            );
          }),
        )}

        {/* Traced paths — draw with stroke-dashoffset animation. */}
        {paths.map((p) => {
          const isRevealed = reveal.revealedNames.has(p.nameIndex);
          return (
            <polyline
              key={`path-${p.nameIndex}`}
              points={p.polyline}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth={2.25}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                strokeDasharray: p.length,
                strokeDashoffset: isRevealed ? 0 : p.length,
                transition: `stroke-dashoffset ${PATH_DRAW_MS}ms cubic-bezier(0.5, 0, 0.35, 1)`,
                opacity: isRevealed ? 0.95 : 0,
              }}
            />
          );
        })}

        {/* Participant name labels (top) — clickable. */}
        {assignments.map((a, i) => {
          if (a.name === '') {
            return (
              <text
                key={`p-${i}`}
                x={lineX[i] ?? 0}
                y={TOP_PAD - 12}
                textAnchor="middle"
                className="fill-zinc-300 text-[11px]"
              >
                ·
              </text>
            );
          }
          const isRevealed = reveal.revealedNames.has(i);
          return (
            <g
              key={`p-${i}`}
              style={{ cursor: 'pointer' }}
              onClick={() => onRevealName(i)}
              role="button"
              tabIndex={0}
              aria-label={`${a.name} 경로 보기`}
            >
              <rect
                x={(lineX[i] ?? 0) - PILL_W / 2}
                y={TOP_PAD - 22}
                width={PILL_W}
                height={PILL_H}
                rx={PILL_H / 2}
                fill={isRevealed ? 'var(--color-accent)' : '#ffffff'}
                stroke={isRevealed ? 'var(--color-accent)' : '#e4e4e7'}
                strokeWidth={1}
                style={{ transition: 'all 200ms ease-out' }}
              />
              <text
                x={lineX[i] ?? 0}
                y={TOP_PAD - 11}
                textAnchor="middle"
                className="pointer-events-none select-none"
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  fill: isRevealed ? '#ffffff' : '#3f3f46',
                  transition: 'fill 200ms ease-out',
                }}
              >
                {truncate(a.name, 4)}
              </text>
            </g>
          );
        })}

        {/* Result labels (bottom) — appear after the corresponding path is revealed. */}
        {Array.from(resultByEndLine.entries()).map(([endLine, result]) => {
          // The result shows on every assignment whose endLine is this, but we want
          // to fade it in once ANY of the paths going to that line is revealed.
          const anyRevealedToLine = paths.some(
            (p) => p.endLine === endLine && reveal.revealedNames.has(p.nameIndex),
          );
          return (
            <g key={`r-${endLine}`}>
              <text
                x={lineX[endLine] ?? 0}
                y={TOP_PAD + levels * CELL_H + 18}
                textAnchor="middle"
                className="select-none"
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  fill: '#18181b',
                  opacity: reveal.resultsShown && anyRevealedToLine ? 1 : 0,
                  transition: 'opacity 300ms ease-out',
                }}
              >
                {truncate(result, 5)}
              </text>
            </g>
          );
        })}

        {/* Bottom guide line so the result column reads as anchored. */}
        {reveal.resultsShown ? (
          <line
            x1={SIDE_PAD - 6}
            y1={TOP_PAD + levels * CELL_H + 6}
            x2={totalW - SIDE_PAD + 6}
            y2={TOP_PAD + levels * CELL_H + 6}
            stroke="#e4e4e7"
            strokeWidth={1}
            strokeDasharray="2 3"
            style={{ transition: 'opacity 400ms ease-out' }}
          />
        ) : null}
      </svg>

      {/* Final results list — clean text summary. */}
      {reveal.resultsShown && assignments.some((a) => a.name !== '' && a.result !== '') ? (
        <ul className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {assignments
            .filter((a) => a.name !== '' && a.result !== '')
            .map((a) => {
              const isRevealed = reveal.revealedNames.has(a.nameIndex);
              return (
                <li
                  key={`summary-${a.nameIndex}`}
                  className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50/50 px-3 py-2 text-sm"
                  style={{
                    opacity: isRevealed ? 1 : 0.4,
                    transition: 'opacity 280ms ease-out',
                  }}
                >
                  <span className="text-zinc-700">{a.name}</span>
                  <span className="font-medium text-zinc-900">{a.result}</span>
                </li>
              );
            })}
        </ul>
      ) : null}
    </div>
  );
}

function polylineLength(points: Array<[number, number]>): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i - 1]!;
    const [x2, y2] = points[i]!;
    total += Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  }
  return total;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}
