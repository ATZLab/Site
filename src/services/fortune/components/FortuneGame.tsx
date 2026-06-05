'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { categories, rollFortune, type FortuneScore } from '@/services/fortune/logic';
import { ScoreCard } from '@/services/fortune/components/ScoreCard';

const CARD_STAGGER_MS = 140;

export function FortuneGame() {
  const [scores, setScores] = useState<FortuneScore[] | null>(null);
  const [reveal, setReveal] = useState(false);

  const draw = useCallback(() => {
    setScores(rollFortune());
    setReveal(false);
    // Flip the reveal flag on the next frame so the transition delay applies.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setReveal(true));
    });
  }, []);

  const reset = useCallback(() => {
    setScores(null);
    setReveal(false);
  }, []);

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="text-sm font-medium text-zinc-900">오늘의 운세</p>
            <p className="text-xs text-zinc-500">재미로만 봐주세요 :)</p>
          </div>
        </CardHeader>
        <CardBody>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={draw}>{scores ? '다시 뽑기' : '뽑기'}</Button>
            {scores ? (
              <Button variant="secondary" onClick={reset}>
                초기화
              </Button>
            ) : null}
            {scores ? (
              <p className="self-center text-xs text-zinc-500">
                {reveal ? '오늘 하루도 잘 보내세요.' : '카드를 섞는 중…'}
              </p>
            ) : (
              <p className="self-center text-xs text-zinc-500">
                학업 · 직장 · 돈 · 연애 · 건강 5가지가 한 번에 나와요.
              </p>
            )}
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {categories.map((c, i) => {
          const score = scores?.find((s) => s.categoryId === c.id) ?? null;
          return (
            <ScoreCard
              key={c.id}
              categoryId={c.id}
              target={score?.value ?? null}
              reveal={reveal}
              delayMs={i * CARD_STAGGER_MS}
            />
          );
        })}
      </div>
    </div>
  );
}
