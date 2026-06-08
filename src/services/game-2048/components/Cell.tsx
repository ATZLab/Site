'use client';

import type { Tile } from '@/services/game-2048/logic';
import { tileTier } from '@/services/game-2048/logic';

interface CellProps {
  tile: Tile;
  /** Set on the very first render of this tile (spawns into existence). */
  isNew: boolean;
  /** Set on the render where this tile's value just doubled (pop). */
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

export function Cell({ tile, isNew, isMerged }: CellProps) {
  const tier = tileTier(tile.value);
  const classes = TIER_CLASS[tier];

  // Font size scales with the number of digits so 5-digit tiles still fit.
  const text =
    tile.value >= 1000
      ? 'text-base sm:text-lg'
      : tile.value >= 100
        ? 'text-lg sm:text-xl'
        : 'text-xl sm:text-2xl';

  // Spawn (scale 0→1) and pop (scale 1→1.18→1) use `transform`, so they
  // don't fight with the slide transition (which uses `translate`).
  const animClass = isNew
    ? 'animate-cell-spawn'
    : isMerged
      ? 'animate-cell-pop'
      : '';

  return (
    <div
      className={[
        'cell',
        'flex aspect-square items-center justify-center rounded-lg',
        'font-mono font-semibold tabular-nums',
        classes,
        text,
        animClass,
      ].join(' ')}
      data-tile
    >
      {tile.value}
    </div>
  );
}
