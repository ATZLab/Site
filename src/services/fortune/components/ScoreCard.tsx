'use client';

import { useEffect, useState } from 'react';
import {
  categoryById,
  commentFor,
  tierClass,
  tierGlow,
  tierOf,
} from '@/services/fortune/logic';

interface ScoreCardProps {
  categoryId: string;
  /** Final score 0–100. Pass `null` to keep the card in its idle "?" state. */
  target: number | null;
  /** Stagger delay in ms — card appears this long after `reveal` becomes true. */
  delayMs: number;
  /** When true, the card plays its reveal animation. */
  reveal: boolean;
}

const COUNT_DURATION_MS = 900;

export function ScoreCard({ categoryId, target, delayMs, reveal }: ScoreCardProps) {
  const category = categoryById(categoryId);
  const [displayed, setDisplayed] = useState(0);
  const [barVisible, setBarVisible] = useState(false);

  // Count-up: animate from 0 to target once the card is revealed.
  useEffect(() => {
    if (!reveal || target === null) {
      setDisplayed(0);
      setBarVisible(false);
      return;
    }

    // Stagger the bar/count start by `delayMs`.
    const startTimer = window.setTimeout(() => {
      setBarVisible(true);
      const start = performance.now();
      let raf = 0;
      const step = (now: number) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / COUNT_DURATION_MS, 1);
        // ease-out cubic — fast at first, slow at the end
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplayed(Math.round(target * eased));
        if (progress < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
      return () => cancelAnimationFrame(raf);
    }, delayMs);

    return () => window.clearTimeout(startTimer);
  }, [reveal, target, delayMs]);

  if (!category) return null;

  const tier = target === null ? 'low' : tierOf(target);
  const fillColor = tierClass(tier);
  const glow = tierGlow(tier);
  const comment = target === null ? '뽑기를 눌러보세요' : commentFor(categoryId, target);
  const barWidthPct = target === null ? 0 : target;

  return (
    <div
      className="rounded-2xl border border-zinc-200 bg-white p-5 transition-all duration-500"
      style={{
        opacity: reveal ? 1 : 0,
        transform: reveal ? 'translateY(0)' : 'translateY(8px)',
        transitionDelay: reveal ? `${delayMs}ms` : '0ms',
      }}
    >
      {/* Row 1: icon + category name */}
      <div className="mb-2.5 flex items-center gap-2">
        <span aria-hidden className="text-base">
          {category.icon}
        </span>
        <span className="text-sm font-medium text-zinc-900">{category.label}</span>
      </div>

      {/* Row 2: gauge bar + score */}
      <div className="flex items-center gap-3">
        <div
          className="relative h-2 flex-1 overflow-hidden rounded-full bg-zinc-100"
          aria-hidden
        >
          <div
            className={`h-full rounded-full ${fillColor} transition-[width] ease-out`}
            style={{
              width: barVisible ? `${barWidthPct}%` : '0%',
              transitionDuration: `${COUNT_DURATION_MS}ms`,
              boxShadow: glow,
            }}
          />
        </div>
        <span
          className="w-10 text-right font-mono text-sm tabular-nums text-zinc-900"
          aria-label={target === null ? '점수 미정' : `${target}점`}
        >
          {target === null ? '—' : `${displayed}`}
        </span>
      </div>

      {/* Row 3: comment */}
      <p
        className="mt-2 text-xs text-zinc-500"
        style={{ minHeight: '1.25rem' }}
      >
        {comment}
      </p>
    </div>
  );
}
