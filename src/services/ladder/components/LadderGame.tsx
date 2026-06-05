'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  assignResults,
  generateLadder,
  parseList,
  type Assignment,
  type Ladder,
} from '@/services/ladder/logic';
import { LadderBoard } from '@/services/ladder/components/LadderBoard';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Input, Textarea } from '@/components/ui/Input';

const DEFAULT_LEVELS = 8;
const MIN_LEVELS = 4;
const MAX_LEVELS = 14;

interface RevealState {
  /** Number of rungs that have been drawn so far (cascades top to bottom). */
  rungsDrawn: number;
  /** Number of paths currently animated. */
  pathsRevealed: number;
  /** True when the final result labels fade in. */
  resultsShown: boolean;
}

const INITIAL_REVEAL: RevealState = { rungsDrawn: 0, pathsRevealed: 0, resultsShown: false };

export function LadderGame() {
  const [participantsInput, setParticipantsInput] = useState('민준\n서연\n도윤\n지우');
  const [resultsInput, setResultsInput] = useState('치킨\n피자\n떡볶이\n아이스크림');
  const [levels, setLevels] = useState(DEFAULT_LEVELS);

  const [ladder, setLadder] = useState<Ladder | null>(null);
  const [assignments, setAssignments] = useState<Assignment[] | null>(null);
  const [reveal, setReveal] = useState<RevealState>(INITIAL_REVEAL);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const participants = useMemo(() => parseList(participantsInput), [participantsInput]);
  const results = useMemo(() => parseList(resultsInput), [resultsInput]);

  const canStart = !isRunning && participants.length >= 2 && participants.length === results.length;

  const reset = useCallback(() => {
    setLadder(null);
    setAssignments(null);
    setReveal(INITIAL_REVEAL);
    setError(null);
  }, []);

  const handleStart = useCallback(() => {
    setError(null);
    if (participants.length < 2) {
      setError('이름은 2개 이상 입력해 주세요.');
      return;
    }
    if (participants.length !== results.length) {
      setError('이름과 결과의 개수가 같아야 해요.');
      return;
    }
    const newLadder = generateLadder(participants.length, levels);
    const newAssignments = assignResults(participants, results, newLadder);
    setLadder(newLadder);
    setAssignments(newAssignments);
    setReveal(INITIAL_REVEAL);
    setIsRunning(true);
  }, [participants, results, levels]);

  // Animation timeline. Sequentially reveals rungs, then paths, then labels.
  useEffect(() => {
    if (!isRunning || !ladder) return;

    const rungDuration = 80;
    const rungTotal = ladder.levels * rungDuration + 200;
    const pathStagger = 250;
    const pathTotal = ladder.width * pathStagger + 400;

    const timers: number[] = [];
    for (let i = 1; i <= ladder.levels; i++) {
      timers.push(window.setTimeout(() => setReveal((r) => ({ ...r, rungsDrawn: i })), i * rungDuration));
    }
    for (let p = 1; p <= ladder.width; p++) {
      timers.push(
        window.setTimeout(
          () => setReveal((r) => ({ ...r, pathsRevealed: p })),
          rungTotal + p * pathStagger,
        ),
      );
    }
    timers.push(
      window.setTimeout(
        () => setReveal((r) => ({ ...r, resultsShown: true })),
        rungTotal + pathTotal,
      ),
    );
    timers.push(window.setTimeout(() => setIsRunning(false), rungTotal + pathTotal + 200));

    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [ladder, isRunning]);

  // Reset reveal state when ladder inputs change.
  useEffect(() => {
    reset();
    // We intentionally only respond to identity-changing inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participantsInput, resultsInput, levels]);

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <Card>
        <CardHeader>
          <p className="text-sm font-medium text-zinc-900">입력</p>
        </CardHeader>
        <CardBody className="space-y-4">
          <div>
            <label htmlFor="ladder-participants" className="mb-1.5 block text-xs text-zinc-600">
              이름 (한 줄에 하나)
            </label>
            <Textarea
              id="ladder-participants"
              value={participantsInput}
              onChange={(e) => setParticipantsInput(e.target.value)}
              rows={5}
              placeholder="민준&#10;서연&#10;도윤&#10;지우"
            />
          </div>
          <div>
            <label htmlFor="ladder-results" className="mb-1.5 block text-xs text-zinc-600">
              결과 (한 줄에 하나, 이름과 같은 개수)
            </label>
            <Textarea
              id="ladder-results"
              value={resultsInput}
              onChange={(e) => setResultsInput(e.target.value)}
              rows={5}
              placeholder="치킨&#10;피자&#10;떡볶이&#10;아이스크림"
            />
          </div>
          <div>
            <label htmlFor="ladder-levels" className="mb-1.5 block text-xs text-zinc-600">
              다리 칸 수 ({levels})
            </label>
            <Input
              id="ladder-levels"
              type="range"
              min={MIN_LEVELS}
              max={MAX_LEVELS}
              value={levels}
              onChange={(e) => setLevels(Number(e.target.value))}
            />
          </div>

          {error ? <p className="text-sm text-[color:var(--color-accent)]">{error}</p> : null}

          <div className="flex gap-2 pt-1">
            <Button onClick={handleStart} disabled={!canStart}>
              {ladder ? '다시 뽑기' : '뽑기 시작'}
            </Button>
            {ladder ? (
              <Button variant="secondary" onClick={reset} disabled={isRunning}>
                초기화
              </Button>
            ) : null}
          </div>

          {participants.length > 0 ? (
            <p className="text-xs text-zinc-500">
              {participants.length}명 입력됨 · 결과 {results.length}개
            </p>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <p className="text-sm font-medium text-zinc-900">결과</p>
        </CardHeader>
        <CardBody>
          {ladder && assignments ? (
            <LadderBoard
              ladder={ladder}
              participants={assignments.map((a) => a.participant)}
              results={assignments.map((a) => a.result)}
              reveal={reveal}
            />
          ) : (
            <p className="py-12 text-center text-sm text-zinc-500">
              왼쪽에서 이름과 결과를 입력하고 뽑기를 시작해 보세요.
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
