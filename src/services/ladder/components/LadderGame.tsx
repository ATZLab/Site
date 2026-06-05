'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  assignResults,
  generateLadder,
  randomLevels,
  type Assignment,
  type Ladder,
} from '@/services/ladder/logic';
import { LadderBoard } from '@/services/ladder/components/LadderBoard';
import { InputRow } from '@/services/ladder/components/InputRow';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';

const MIN_LEVELS = 4;
const MAX_LEVELS = 10;

const INITIAL_NAMES = ['', '', ''];
const INITIAL_RESULTS = ['', '', ''];

type RevealMode = 'all' | 'single';

interface RevealState {
  /** Mode used to drive the animation. */
  mode: RevealMode;
  /** Indices of names that have finished revealing (i.e. path is fully drawn). */
  revealedNames: Set<number>;
  /** True once the result labels for revealed names should fade in. */
  resultsShown: boolean;
}

const INITIAL_REVEAL: RevealState = {
  mode: 'all',
  revealedNames: new Set<number>(),
  resultsShown: false,
};

export function LadderGame() {
  const [names, setNames] = useState<string[]>(INITIAL_NAMES);
  const [results, setResults] = useState<string[]>(INITIAL_RESULTS);

  const [ladder, setLadder] = useState<Ladder | null>(null);
  const [assignments, setAssignments] = useState<Assignment[] | null>(null);
  const [reveal, setReveal] = useState<RevealState>(INITIAL_REVEAL);
  const [error, setError] = useState<string | null>(null);

  // ---- Input handlers ----------------------------------------------------

  const updateName = useCallback((i: number, value: string) => {
    setNames((prev) => prev.map((n, idx) => (idx === i ? value : n)));
  }, []);
  const removeName = useCallback((i: number) => {
    setNames((prev) => (prev.length <= 2 ? prev : prev.filter((_, idx) => idx !== i)));
  }, []);
  const addName = useCallback(() => {
    setNames((prev) => [...prev, '']);
  }, []);

  const updateResult = useCallback((i: number, value: string) => {
    setResults((prev) => prev.map((r, idx) => (idx === i ? value : r)));
  }, []);
  const removeResult = useCallback((i: number) => {
    setResults((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }, []);
  const addResult = useCallback(() => {
    setResults((prev) => [...prev, '']);
  }, []);

  // Reset the board whenever inputs change.
  useEffect(() => {
    setLadder(null);
    setAssignments(null);
    setReveal(INITIAL_REVEAL);
    setError(null);
  }, [names, results]);

  // ---- Generate + reveal -------------------------------------------------

  const nonEmptyNames = useMemo(() => names.filter((n) => n.trim() !== ''), [names]);
  const nonEmptyResults = useMemo(() => results.filter((r) => r.trim() !== ''), [results]);

  const buildLadder = useCallback(() => {
    setError(null);
    if (nonEmptyNames.length < 2) {
      setError('이름은 2개 이상 입력해 주세요.');
      return;
    }
    if (nonEmptyResults.length < 1) {
      setError('결과는 1개 이상 입력해 주세요.');
      return;
    }
    const width = Math.max(nonEmptyNames.length, nonEmptyResults.length);
    const levels = randomLevels(MIN_LEVELS, MAX_LEVELS);
    const newLadder = generateLadder(width, levels);
    const newAssignments = assignResults(nonEmptyNames, nonEmptyResults, newLadder);
    setLadder(newLadder);
    setAssignments(newAssignments);
    setReveal({ mode: 'all', revealedNames: new Set<number>(), resultsShown: false });
  }, [nonEmptyNames, nonEmptyResults]);

  /** Reveal a single name's path. Builds the ladder lazily if it doesn't exist. */
  const revealSingle = useCallback(
    (nameIndex: number) => {
      if (!ladder) {
        buildLadder();
        // buildLadder is async via setState — re-attempt on next tick.
        return;
      }
      setReveal((prev) => {
        if (prev.mode === 'single' && prev.revealedNames.has(nameIndex)) return prev;
        const next = new Set(prev.revealedNames);
        next.add(nameIndex);
        return { mode: 'single', revealedNames: next, resultsShown: true };
      });
    },
    [ladder, buildLadder],
  );

  // When ladder becomes available after a single-click on empty board,
  // kick off the reveal for the clicked name.
  const [pendingSingleIndex, setPendingSingleIndex] = useState<number | null>(null);
  useEffect(() => {
    if (ladder && pendingSingleIndex !== null) {
      setReveal({
        mode: 'single',
        revealedNames: new Set([pendingSingleIndex]),
        resultsShown: true,
      });
      setPendingSingleIndex(null);
    }
  }, [ladder, pendingSingleIndex]);

  const handleRevealSingle = useCallback(
    (i: number) => {
      if (ladder) {
        revealSingle(i);
      } else {
        // Ladder doesn't exist yet. Set flag and build it.
        if (nonEmptyNames.length < 2) {
          setError('이름은 2개 이상 입력해 주세요.');
          return;
        }
        if (nonEmptyResults.length < 1) {
          setError('결과는 1개 이상 입력해 주세요.');
          return;
        }
        setPendingSingleIndex(i);
        buildLadder();
      }
    },
    [ladder, revealSingle, buildLadder, nonEmptyNames.length, nonEmptyResults.length],
  );

  // ---- Animation timeline for "reveal all" -------------------------------

  // Track the ladder instance we've already started animating. Without this,
  // the effect would re-run whenever `revealedNames.size` changes (which it
  // does on every path completion), and the cleanup would cancel the remaining
  // timers — killing the rest of the animation.
  const animatedLadderRef = useRef<Ladder | null>(null);

  useEffect(() => {
    if (!ladder || !assignments || reveal.mode !== 'all') return;
    if (animatedLadderRef.current === ladder) return;
    animatedLadderRef.current = ladder;

    const traceableCount = assignments.filter((a) => a.name !== '').length;
    if (traceableCount === 0) return;

    const PATH_DURATION = 1100; // matches CSS transition
    const STAGGER = 240;
    const lastPathEnd = (traceableCount - 1) * STAGGER + PATH_DURATION;

    const timers: number[] = [];
    assignments.forEach((a) => {
      if (a.name === '') return;
      const order = assignments.filter((x) => x.name !== '').indexOf(a);
      const startAt = order * STAGGER;
      timers.push(
        window.setTimeout(() => {
          setReveal((prev) => {
            if (prev.mode !== 'all') return prev;
            const next = new Set(prev.revealedNames);
            next.add(a.nameIndex);
            return { ...prev, revealedNames: next };
          });
        }, startAt),
      );
    });
    timers.push(
      window.setTimeout(
        () => setReveal((prev) => ({ ...prev, resultsShown: true })),
        lastPathEnd + 100,
      ),
    );

    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [ladder, assignments, reveal.mode]);

  // ---- Render ------------------------------------------------------------

  const isBoardEmpty = !ladder || !assignments;

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <p className="text-sm font-medium text-zinc-900">입력</p>
        </CardHeader>
        <CardBody>
          <div className="grid gap-6 sm:grid-cols-2">
            <InputColumn
              label="이름"
              hint="시작점 — 비워두면 무시돼요"
              items={names}
              onUpdate={updateName}
              onRemove={removeName}
              onAdd={addName}
              minItems={2}
            />
            <InputColumn
              label="결과"
              hint="도착점 — 이름과 개수가 달라도 돼요"
              items={results}
              onUpdate={updateResult}
              onRemove={removeResult}
              onAdd={addResult}
              minItems={1}
            />
          </div>

          {error ? <p className="mt-3 text-sm text-[color:var(--color-accent)]">{error}</p> : null}

          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={buildLadder} disabled={!ladder ? false : false}>
              {ladder ? '다시 뽑기' : '한 번에 보기'}
            </Button>
            <p className="self-center text-xs text-zinc-500">
              {nonEmptyNames.length}명 · {nonEmptyResults.length}개 · 칸 수는 무작위 (4~10)
            </p>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium text-zinc-900">결과</p>
            {!isBoardEmpty ? (
              <p className="text-xs text-zinc-500">
                시작점을 클릭하면 그 경로만 보여줘요
              </p>
            ) : null}
          </div>
        </CardHeader>
        <CardBody>
          {ladder && assignments ? (
            <LadderBoard
              ladder={ladder}
              assignments={assignments}
              reveal={reveal}
              onRevealName={handleRevealSingle}
            />
          ) : (
            <EmptyBoard
              names={names}
              results={results}
              onRevealName={handleRevealSingle}
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}

interface InputColumnProps {
  label: string;
  hint: string;
  items: string[];
  onUpdate: (i: number, value: string) => void;
  onRemove: (i: number) => void;
  onAdd: () => void;
  minItems: number;
}

function InputColumn({
  label,
  hint,
  items,
  onUpdate,
  onRemove,
  onAdd,
  minItems,
}: InputColumnProps) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <label className="text-xs font-medium text-zinc-700">{label}</label>
        <span className="text-xs text-zinc-400">{hint}</span>
      </div>
      <div className="space-y-1.5">
        {items.map((value, i) => (
          <InputRow
            key={i}
            value={value}
            onChange={(v) => onUpdate(i, v)}
            onRemove={() => onRemove(i)}
            disableRemove={items.length <= minItems}
            ariaLabel={`${label} ${i + 1}`}
            maxLength={20}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-full border border-dashed border-zinc-200 px-3 text-xs text-zinc-500 transition-colors hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        추가
      </button>
    </div>
  );
}

interface EmptyBoardProps {
  names: string[];
  results: string[];
  onRevealName: (nameIndex: number) => void;
}

/** Empty state — show clickable name chips. Click any to build the ladder
 *  AND reveal that one path. Also shows the result chips below as a preview. */
function EmptyBoard({ names, results, onRevealName }: EmptyBoardProps) {
  const nonEmptyNames = names.map((n, i) => ({ name: n.trim(), index: i })).filter((n) => n.name);
  const nonEmptyResults = results.map((r) => r.trim()).filter(Boolean);

  return (
    <div className="py-8">
      <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
        {nonEmptyNames.length === 0 ? (
          <p className="text-sm text-zinc-400">왼쪽에서 이름을 입력해 주세요</p>
        ) : (
          nonEmptyNames.map((n) => (
            <button
              key={n.index}
              type="button"
              onClick={() => onRevealName(n.index)}
              className="inline-flex h-9 items-center rounded-full border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition-all hover:border-zinc-900 hover:bg-zinc-900 hover:text-white"
            >
              {n.name}
            </button>
          ))
        )}
      </div>
      <div className="mb-2 flex items-center justify-center gap-2 text-xs text-zinc-400">
        <span className="inline-block h-px w-8 bg-zinc-200" />
        결과
        <span className="inline-block h-px w-8 bg-zinc-200" />
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {nonEmptyResults.length === 0 ? (
          <p className="text-sm text-zinc-400">오른쪽에서 결과를 입력해 주세요</p>
        ) : (
          nonEmptyResults.map((r, i) => (
            <span
              key={i}
              className="inline-flex h-9 items-center rounded-full bg-zinc-100 px-4 text-sm text-zinc-500"
            >
              {r}
            </span>
          ))
        )}
      </div>
      <p className="mt-6 text-center text-xs text-zinc-400">
        이름을 클릭하면 그 경로만, <span className="font-medium text-zinc-600">한 번에 보기</span>를 누르면 전체가 나와요.
      </p>
    </div>
  );
}
