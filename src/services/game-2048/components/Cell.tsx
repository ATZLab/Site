'use client';

import { tileTier } from '@/services/game-2048/logic';

interface CellProps {
  value: number;
  /** Was this cell empty in the previous board? (spawn animation) */
  isNew: boolean;
  /** Did the value just double from a merge? (pop animation) */
  isMerged: boolean;
}

const TIER_CLASS: Record<ReturnType<typeof tileTier>, string> = {
  0: 'bg-zinc-100 text-transparent', // empty
  1: 'bg-zinc-200 text-zinc-800',
  2: 'bg-zinc-300 text-zinc-800',
  3: 'bg-zinc-500 text-white',
  4: 'bg-zinc-800 text-white',
  5: 'bg-[#c93c2e] text-white', // 512+, deep coral
};

export function Cell({ value, isNew, isMerged }: CellProps) {
  const tier = tileTier(value);
  const classes = TIER_CLASS[tier];
  const isEmpty = value === 0;

  // Font size scales with the number of digits so 5-digit tiles still fit.
  const text =
    value >= 1000 ? 'text-base sm:text-lg' : value >= 100 ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl';

  // Pick exactly one animation: spawn (new tile) takes priority over pop
  // (merge) since they shouldn't co-occur anyway.
  const animClass = isEmpty
    ? ''
    : isNew
      ? 'animate-cell-spawn'
      : isMerged
        ? 'animate-cell-pop'
        : '';

  return (
    <div
      className={[
        'relative flex aspect-square items-center justify-center rounded-lg',
        'font-mono font-semibold tabular-nums',
        'transition-colors duration-200',
        classes,
        text,
        animClass,
      ].join(' ')}
    >
      {isEmpty ? '' : value}
    </div>
  );
}
