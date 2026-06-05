'use client';

import { useMemo } from 'react';
import type { Ladder } from '@/services/ladder/logic';

interface RevealState {
  rungsDrawn: number;
  pathsRevealed: number;
  resultsShown: boolean;
}

interface LadderBoardProps {
  ladder: Ladder;
  participants: string[];
  results: string[];
  reveal: RevealState;
}

// Geometry — keep all in SVG units; SVG scales the canvas to fit.
const CELL_W = 70;
const CELL_H = 28;
const TOP_PAD = 36;
const BOTTOM_PAD = 44;
const SIDE_PAD = 24;

export function LadderBoard({ ladder, participants, results, reveal }: LadderBoardProps) {
  const { width, levels, rungs } = ladder;

  const totalW = SIDE_PAD * 2 + (width - 1) * CELL_W;
  const totalH = TOP_PAD + levels * CELL_H + BOTTOM_PAD;

  const lineX = useMemo(() => Array.from({ length: width }, (_, i) => SIDE_PAD + i * CELL_W), [width]);
  const rungY = useMemo(() => Array.from({ length: levels }, (_, j) => TOP_PAD + (j + 1) * CELL_H), [levels]);

  // Trace every path up-front so we can stagger-fade them via reveal.pathsRevealed.
  const paths = useMemo(() => {
    const result: Array<{ start: number; polyline: string; endLine: number }> = [];
    for (let i = 0; i < width; i++) {
      let current = i;
      const points: Array<[number, number]> = [[lineX[i] ?? 0, TOP_PAD]];
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
      result.push({
        start: i,
        endLine: current,
        polyline: points.map(([x, y]) => `${x},${y}`).join(' '),
      });
    }
    return result;
  }, [width, levels, rungs, lineX, rungY]);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${totalW} ${totalH}`}
        width="100%"
        style={{ minWidth: 240 }}
        role="img"
        aria-label={`사다리 타기 결과: ${participants.length}명, ${results.length}개 결과`}
      >
        {/* Participant labels (top). */}
        {participants.map((name, i) => (
          <text
            key={`p-${i}`}
            x={lineX[i] ?? 0}
            y={TOP_PAD - 12}
            textAnchor="middle"
            className="fill-zinc-700 text-[11px] font-medium"
          >
            {truncate(name, 6)}
          </text>
        ))}

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

        {/* Rungs — each fades in once reveal.rungsDrawn passes its level. */}
        {rungs.map((row, level) => {
          const visible = level < reveal.rungsDrawn;
          return row.map((leftIdx, i) => {
            if (leftIdx === null) return null;
            const x1 = lineX[i] ?? 0;
            const x2 = lineX[i + 1] ?? 0;
            const y = rungY[level] ?? 0;
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
                  transition: 'opacity 220ms ease-out',
                }}
              />
            );
          });
        })}

        {/* Traced paths — one per participant, each fades in by index. */}
        {paths.map((p, i) => {
          const visible = i < reveal.pathsRevealed;
          return (
            <polyline
              key={`path-${i}`}
              points={p.polyline}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                opacity: visible ? 0.85 : 0,
                transition: 'opacity 320ms ease-out',
              }}
            />
          );
        })}

        {/* Result labels (bottom) — shown only after all paths are revealed. */}
        {results.map((result, i) => {
          const line = paths[i]?.endLine ?? i;
          return (
            <text
              key={`r-${i}`}
              x={lineX[line] ?? 0}
              y={TOP_PAD + levels * CELL_H + 18}
              textAnchor="middle"
              className="fill-zinc-900 text-[11px] font-semibold"
              style={{
                opacity: reveal.resultsShown ? 1 : 0,
                transition: 'opacity 300ms ease-out',
              }}
            >
              {truncate(result, 6)}
            </text>
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

      {/* Final results list — clean text summary below the SVG. */}
      {reveal.resultsShown && results.length > 0 ? (
        <ul className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {paths.map((p, i) => (
            <li
              key={`summary-${i}`}
              className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50/50 px-3 py-2 text-sm"
            >
              <span className="text-zinc-700">{participants[i]}</span>
              <span className="font-medium text-zinc-900">{results[p.endLine]}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}
