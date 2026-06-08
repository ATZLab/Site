'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import {
  addRandomTileToTiles,
  applyMove,
  boardFromTiles,
  hasWon,
  isGameOver,
  newGame,
  tilesFromBoard,
  type Direction,
  type Tile,
} from '@/services/game-2048/logic';
import { Cell } from '@/services/game-2048/components/Cell';

const SIZES = [3, 4, 5] as const;
type Size = (typeof SIZES)[number];

const BEST_KEY = 'best-2048';
const ANIMATION_MS = 200;
const SWIPE_THRESHOLD = 30; // px
const TILE_GAP_PX = 8; // must match `gap-2` in Tailwind v4

function formatScore(n: number): string {
  return n.toLocaleString('en-US');
}

export function Game2048() {
  const [size, setSize] = useState<Size>(4);
  const [tiles, setTiles] = useState<Tile[]>(() => tilesFromBoard(newGame(4)));
  const [score, setScore] = useState(0);
  const [bestScores, setBestScores] = useState<Record<number, number>>({});
  const [hasSeenWin, setHasSeenWin] = useState(false);
  const [showWinModal, setShowWinModal] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Per-tile transient animation flags. Cleared after `ANIMATION_MS`.
  // Keyed by tile id so we can flip them on exactly one render.
  const [newIds, setNewIds] = useState<ReadonlySet<string>>(new Set());
  const [mergedIds, setMergedIds] = useState<ReadonlySet<string>>(new Set());

  const touchStart = useRef<{ x: number; y: number } | null>(null);

  // Load best scores from localStorage.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(BEST_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, number>;
        const normalized: Record<number, number> = {};
        for (const k of Object.keys(parsed)) {
          const n = Number(k);
          if (!Number.isNaN(n)) normalized[n] = parsed[k]!;
        }
        setBestScores(normalized);
      }
    } catch {
      // ignore
    }
  }, []);

  // Persist best score whenever it changes.
  useEffect(() => {
    const current = bestScores[size] ?? 0;
    if (score > current) {
      const next = { ...bestScores, [size]: score };
      setBestScores(next);
      try {
        localStorage.setItem(BEST_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score, size]);

  const resetGame = useCallback((nextSize: Size = size) => {
    setTiles(tilesFromBoard(newGame(nextSize)));
    setScore(0);
    setHasSeenWin(false);
    setShowWinModal(false);
    setShowGameOver(false);
    setNewIds(new Set());
    setMergedIds(new Set());
  }, [size]);

  const changeSize = useCallback((nextSize: Size) => {
    setSize(nextSize);
    setTiles(tilesFromBoard(newGame(nextSize)));
    setScore(0);
    setHasSeenWin(false);
    setShowWinModal(false);
    setShowGameOver(false);
    setNewIds(new Set());
    setMergedIds(new Set());
  }, []);

  const handleMove = useCallback(
    (direction: Direction) => {
      if (isAnimating || showWinModal) return;
      const result = applyMove(tiles, size, direction);
      if (!result.moved) return;

      const spawned = addRandomTileToTiles(result.tiles, size);
      setTiles(spawned.tiles);
      setScore((s) => s + result.gained);
      setMergedIds(result.mergedIds);
      setNewIds(spawned.spawnedId ? new Set([spawned.spawnedId]) : new Set());
      setIsAnimating(true);

      window.setTimeout(() => {
        setIsAnimating(false);
        setMergedIds(new Set());
        setNewIds(new Set());
        const board = boardFromTiles(spawned.tiles, size);
        if (isGameOver(board)) {
          setShowGameOver(true);
          return;
        }
        if (!hasSeenWin && hasWon(board)) {
          setHasSeenWin(true);
          setShowWinModal(true);
        }
      }, ANIMATION_MS);
    },
    [tiles, size, isAnimating, showWinModal, hasSeenWin],
  );

  // Keyboard listener.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (showWinModal || showGameOver) return;
      let dir: Direction | null = null;
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          dir = 'up';
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          dir = 'down';
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          dir = 'left';
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          dir = 'right';
          break;
      }
      if (dir) {
        e.preventDefault();
        handleMove(dir);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleMove, showWinModal, showGameOver]);

  // Touch / swipe handlers.
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) return;
    const dir: Direction = Math.abs(dx) > Math.abs(dy)
      ? dx > 0 ? 'right' : 'left'
      : dy > 0 ? 'down' : 'up';
    handleMove(dir);
  };

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="text-sm font-medium text-zinc-900">2048</p>
            <p className="text-xs text-zinc-500">방향키 또는 스와이프로 플레이</p>
          </div>
        </CardHeader>
        <CardBody className="space-y-5">
          {/* Mode tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 rounded-full border border-zinc-200 bg-white p-1">
              {SIZES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => changeSize(s)}
                  className={[
                    'rounded-full px-3 py-1 text-sm transition-colors',
                    s === size
                      ? 'bg-zinc-900 text-white'
                      : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
                  ].join(' ')}
                >
                  {s}×{s}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex flex-col items-end">
                <span className="text-xs text-zinc-400">점수</span>
                <span className="font-mono tabular-nums text-zinc-900">
                  {formatScore(score)}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xs text-zinc-400">최고</span>
                <span className="font-mono tabular-nums text-zinc-500">
                  {formatScore(bestScores[size] ?? 0)}
                </span>
              </div>
              <Button variant="secondary" size="sm" onClick={() => resetGame()}>
                새 게임
              </Button>
            </div>
          </div>

          {/* Board */}
          <div
            className="relative mx-auto w-full max-w-md select-none"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <div
              className="board relative aspect-square w-full rounded-2xl bg-zinc-100 p-2"
              style={
                {
                  '--board-size': size,
                  '--gap': `${TILE_GAP_PX}px`,
                  '--cell': `calc((100% - ${(size - 1) * TILE_GAP_PX}px - 16px) / ${size})`,
                } as React.CSSProperties
              }
            >
              {/* Background grid of empty cells — gives the board its base
                  visual rhythm. Static, not animated. */}
              <div
                className="absolute inset-2 grid"
                style={{ gridTemplateColumns: `repeat(${size}, 1fr)`, gap: `${TILE_GAP_PX}px` }}
                aria-hidden
              >
                {Array.from({ length: size * size }).map((_, i) => (
                  <div key={i} className="rounded-lg bg-zinc-200/60" />
                ))}
              </div>

              {/* Animated tiles. `translate` is animated by CSS; the
                  browser interpolates between the old and new positions. */}
              {tiles.map((tile) => (
                <div
                  key={tile.id}
                  className="cell-slot"
                  style={{
                    width: 'var(--cell)',
                    height: 'var(--cell)',
                    transform: `translate(calc(${tile.col} * (var(--cell) + var(--gap))), calc(${tile.row} * (var(--cell) + var(--gap))))`,
                  }}
                >
                  <Cell
                    tile={tile}
                    isNew={newIds.has(tile.id)}
                    isMerged={mergedIds.has(tile.id)}
                  />
                </div>
              ))}

              {/* Overlays */}
              {showGameOver ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/80 backdrop-blur-sm">
                  <div className="text-center">
                    <p className="mb-1 text-sm font-medium text-zinc-500">Game Over</p>
                    <p className="mb-4 font-mono text-2xl tabular-nums text-zinc-900">
                      {formatScore(score)}점
                    </p>
                    <Button onClick={() => resetGame()}>다시 시도</Button>
                  </div>
                </div>
              ) : null}

              {showWinModal ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/85 backdrop-blur-sm">
                  <div className="w-full max-w-xs px-6 text-center">
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[color:var(--color-accent)]">
                      You did it
                    </p>
                    <p className="mb-2 font-mono text-4xl font-bold tabular-nums text-zinc-900">
                      2048
                    </p>
                    <p className="mb-5 text-sm text-zinc-600">
                      여기까지 잘 왔어요. 계속 가도 되고, 여기서 끝내도 돼요.
                    </p>
                    <div className="flex justify-center gap-2">
                      <Button variant="secondary" onClick={() => resetGame()}>
                        다시 시도
                      </Button>
                      <Button onClick={() => setShowWinModal(false)}>계속</Button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
