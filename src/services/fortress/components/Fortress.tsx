'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import {
  GROUND_Y,
  LOGICAL_H,
  LOGICAL_W,
  MAX_HP,
  TANK_H,
  TANK_W,
  acknowledgeLanding,
  chooseAiShot,
  fire,
  initialVelocity,
  newGame,
  tick,
  type GameMode,
  type GameState,
  type Player,
  type Shell,
} from '@/services/fortress/logic';
import { PixelCanvas } from '@/services/fortress/components/PixelCanvas';

const ANGLE_STEP = 0.06; // rad
const POWER_PER_FRAME = 0.025; // gauge fill rate while held
const POWER_RELEASE_DECAY = 0; // we hold power in state while button is down

// --- Palette (8-bit feel) ----------------------------------------------------

const PALETTE = {
  sky: '#1a1c2c',
  sky2: '#29366f',
  ground: '#7a5230',
  groundTop: '#9c6b3f',
  groundDark: '#563b22',
  tankBody: '#5a6b3b',
  tankBodyDark: '#3d4a26',
  tankTrack: '#222034',
  tankWindow: '#b3e0ff',
  barrel: '#222034',
  shell: '#ffcd75',
  shellTrail: '#ef7d57',
  explosion: '#f4b41b',
  explosionHot: '#ffffff',
  text: '#f4f4f4',
  hpBar: '#41a6f6',
  hpBarBack: '#29366f',
  hpBarLow: '#ef7d57',
  windArrow: '#94b0c2',
  windArrowStrong: '#ffcd75',
  aim: '#ffcd75',
  p1: '#41a6f6',
  p2: '#ef7d57',
};

// --- Drawing helpers ----------------------------------------------------------

function drawSky(ctx: CanvasRenderingContext2D) {
  // Vertical gradient: top a bit lighter, bottom darker.
  const g = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  g.addColorStop(0, PALETTE.sky2);
  g.addColorStop(1, PALETTE.sky);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, LOGICAL_W, GROUND_Y);
  // Stars.
  ctx.fillStyle = '#566c86';
  for (let i = 0; i < 30; i++) {
    const x = (i * 53) % LOGICAL_W;
    const y = (i * 17) % (GROUND_Y - 30);
    ctx.fillRect(x, y, 1, 1);
  }
}

function drawTerrain(ctx: CanvasRenderingContext2D, terrain: number[]) {
  // Fill from terrain line down to LOGICAL_H.
  ctx.fillStyle = PALETTE.ground;
  ctx.beginPath();
  ctx.moveTo(0, LOGICAL_H);
  for (let x = 0; x < LOGICAL_W; x++) {
    ctx.lineTo(x, terrain[x]!);
  }
  ctx.lineTo(LOGICAL_W, LOGICAL_H);
  ctx.closePath();
  ctx.fill();

  // Top crust line — slightly lighter, 1px tall.
  ctx.fillStyle = PALETTE.groundTop;
  for (let x = 0; x < LOGICAL_W; x++) {
    ctx.fillRect(x, terrain[x]!, 1, 1);
  }

  // Subtle vertical hatching to suggest rock layers.
  ctx.fillStyle = PALETTE.groundDark;
  for (let x = 0; x < LOGICAL_W; x += 4) {
    const y = terrain[x]! + 4;
    ctx.fillRect(x, y, 1, 1);
  }
}

function drawTank(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  player: Player,
  recoil: number,
) {
  const left = Math.round(x - TANK_W / 2);
  const top = Math.round(y);

  // Treads (darker base).
  ctx.fillStyle = PALETTE.tankTrack;
  ctx.fillRect(left, top + TANK_H - 2, TANK_W, 2);
  // Wheels (3 small circles -> 1px tall segments).
  ctx.fillStyle = '#444';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(left + 1 + i * 3, top + TANK_H - 1, 1, 1);
  }
  // Body.
  ctx.fillStyle = PALETTE.tankBody;
  ctx.fillRect(left, top, TANK_W, TANK_H - 2);
  ctx.fillStyle = PALETTE.tankBodyDark;
  ctx.fillRect(left, top + TANK_H - 4, TANK_W, 1);
  // Cupola / window.
  ctx.fillStyle = PALETTE.tankWindow;
  ctx.fillRect(left + (player === 1 ? 1 : TANK_W - 4), top - 1, 3, 2);
  // Barrel. Points away from the tank toward the opponent.
  ctx.fillStyle = PALETTE.barrel;
  const dir = player === 1 ? 1 : -1;
  const barrelStartX = player === 1 ? left + TANK_W - 1 : left;
  const barrelStartY = top + 1;
  const barrelEndX = barrelStartX + (10 - recoil) * dir;
  const barrelEndY = barrelStartY;
  // 2px-thick barrel.
  ctx.fillRect(
    Math.min(barrelStartX, barrelEndX),
    barrelStartY,
    Math.abs(barrelEndX - barrelStartX) + 1,
    2,
  );
}

function drawShell(ctx: CanvasRenderingContext2D, shell: Shell) {
  // Trail.
  ctx.fillStyle = PALETTE.shellTrail;
  for (let i = 0; i < shell.trail.length; i++) {
    const t = shell.trail[i]!;
    const alpha = i / shell.trail.length;
    if (alpha < 0.4) continue;
    ctx.fillRect(Math.round(t.x), Math.round(t.y), 1, 1);
  }
  // Shell.
  ctx.fillStyle = PALETTE.shell;
  ctx.fillRect(Math.round(shell.x) - 1, Math.round(shell.y) - 1, 2, 2);
}

function drawExplosion(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  t: number, // 0..1
) {
  const r = 4 + t * 10;
  // Outer ring.
  ctx.fillStyle = PALETTE.explosion;
  for (let dx = -r; dx <= r; dx++) {
    const dy = Math.sqrt(r * r - dx * dx);
    ctx.fillRect(Math.round(cx + dx), Math.round(cy - dy), 1, 1);
    ctx.fillRect(Math.round(cx + dx), Math.round(cy + dy), 1, 1);
  }
  // Inner hot.
  if (t < 0.6) {
    const r2 = r * 0.6;
    ctx.fillStyle = PALETTE.explosionHot;
    for (let dx = -r2; dx <= r2; dx++) {
      const dy = Math.sqrt(r2 * r2 - dx * dx);
      ctx.fillRect(Math.round(cx + dx), Math.round(cy - dy), 1, 1);
      ctx.fillRect(Math.round(cx + dx), Math.round(cy + dy), 1, 1);
    }
  }
}

function drawAim(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  currentY: number,
) {
  // Draw a faint predicted-trajectory dots if the projectile hasn't been fired.
  if (state.phase !== 'aim') return;
  const shooter = state.tanks[state.turn - 1]!;
  const v = initialVelocity(shooter.player, state.angle, state.power);
  let x = shooter.x;
  let y = currentY;
  let vx = v.vx;
  let vy = v.vy;
  const dt = 0.1;
  ctx.fillStyle = PALETTE.aim;
  for (let i = 0; i < 60; i++) {
    x += vx * dt;
    y += vy * dt;
    vx += state.wind * dt;
    vy += 180 * dt;
    if (y >= state.terrain[Math.round(Math.max(0, Math.min(LOGICAL_W - 1, x)))]!) break;
    if (i % 2 === 0) ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
}

function drawWind(ctx: CanvasRenderingContext2D, wind: number) {
  const strength = Math.min(1, Math.abs(wind) / 120);
  const color =
    strength > 0.66
      ? PALETTE.windArrowStrong
      : strength > 0.33
        ? '#c0cbdc'
        : PALETTE.windArrow;
  ctx.fillStyle = color;
  const cx = LOGICAL_W / 2;
  const cy = 12;
  // Arrow body.
  if (wind >= 0) {
    ctx.fillRect(cx - 6, cy - 1, 10, 2);
    ctx.fillRect(cx + 2, cy - 3, 1, 1);
    ctx.fillRect(cx + 3, cy - 2, 1, 1);
    ctx.fillRect(cx + 4, cy - 1, 1, 1);
    ctx.fillRect(cx + 3, cy, 1, 1);
    ctx.fillRect(cx + 2, cy + 1, 1, 1);
  } else {
    ctx.fillRect(cx - 4, cy - 1, 10, 2);
    ctx.fillRect(cx - 6, cy - 3, 1, 1);
    ctx.fillRect(cx - 5, cy - 2, 1, 1);
    ctx.fillRect(cx - 4, cy - 1, 1, 1);
    ctx.fillRect(cx - 5, cy, 1, 1);
    ctx.fillRect(cx - 6, cy + 1, 1, 1);
  }
  // Wind strength text "WIND".
  ctx.fillStyle = color;
  // Tiny pixel digits to the side of the arrow.
  const w = Math.round(strength * 5);
  for (let i = 0; i < w; i++) {
    ctx.fillRect(cx - 8 - i * 2, cy, 1, 1);
  }
}

// --- Game component -----------------------------------------------------------

export function Fortress() {
  const [mode, setMode] = useState<GameMode | null>(null);
  const [state, setState] = useState<GameState>(() =>
    newGame({ mode: '1p', seed: 1 }),
  );
  const [isCharging, setIsCharging] = useState(false);
  const [explosion, setExplosion] = useState<
    { x: number; y: number; t: number } | null
  >(null);
  const [recoil, setRecoil] = useState(0);

  const stateRef = useRef(state);
  stateRef.current = state;
  const chargingRef = useRef(isCharging);
  chargingRef.current = isCharging;

  // When entering 'flying', set up the explosion once the shell lands.
  // When entering 'landed', schedule the auto-acknowledge.
  useEffect(() => {
    if (state.phase === 'flying' && state.shell) {
      setExplosion(null);
    }
    if (state.phase === 'landed') {
      const t = window.setTimeout(() => {
        setState((s) => acknowledgeLanding(s).next);
      }, 1400);
      return () => window.clearTimeout(t);
    }
  }, [state.phase, state.shell]);

  // Power-charge loop: while the user holds the fire button, ramp the
  // power up. Releasing fires.
  useEffect(() => {
    if (!isCharging) return;
    if (state.phase !== 'aim') return;
    const id = window.setInterval(() => {
      setState((s) =>
        s.phase === 'aim' ? { ...s, power: Math.min(1, s.power + POWER_PER_FRAME) } : s,
      );
    }, 16);
    return () => window.clearInterval(id);
  }, [isCharging, state.phase]);

  // AI auto-plays when in 1p mode and it's player 2's turn.
  useEffect(() => {
    if (mode !== '1p') return;
    if (state.phase !== 'aim') return;
    if (state.turn !== 2) return;
    const id = window.setTimeout(() => {
      setState((s) => {
        const ai = s.tanks[1]!;
        const me = s.tanks[0]!;
        const shot = chooseAiShot(ai, me, s.wind, s.terrain);
        return { ...s, angle: shot.angle, power: shot.power };
      });
      // Small delay before firing so the player can see the AI's choice.
      const id2 = window.setTimeout(() => {
        setState((s) => {
          const f = fire(s);
          setRecoil(6);
          window.setTimeout(() => setRecoil(0), 120);
          return f.next;
        });
      }, 600);
      return () => window.clearTimeout(id2);
    }, 700);
    return () => window.clearTimeout(id);
  }, [mode, state.phase, state.turn]);

  // Game loop: tick the shell forward while in 'flying'.
  useEffect(() => {
    if (state.phase !== 'flying') return;
    let last = performance.now();
    let raf = 0;
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      setState((s) => {
        if (s.phase !== 'flying') return s;
        const next = tick(s, dt).next;
        // Detect a landing: phase just changed from flying → landed.
        if (next.phase === 'landed' && s.phase === 'flying' && s.shell) {
          setExplosion({ x: s.shell.x, y: s.shell.y, t: 0 });
        }
        return next;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [state.phase]);

  // Animate the explosion.
  useEffect(() => {
    if (!explosion) return;
    let raf = 0;
    const start = performance.now();
    const loop = (t: number) => {
      const elapsed = (t - start) / 600;
      if (elapsed >= 1) {
        setExplosion(null);
        return;
      }
      setExplosion((e) => (e ? { ...e, t: elapsed } : e));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [explosion]);

  const startNewGame = useCallback((m: GameMode) => {
    setMode(m);
    setState(newGame({ mode: m, seed: Math.floor(Math.random() * 1e9) }));
    setIsCharging(false);
    setExplosion(null);
    setRecoil(0);
  }, []);

  const onFirePressStart = useCallback(() => {
    if (mode === '1p' && stateRef.current.turn === 2) return; // AI's turn
    if (stateRef.current.phase !== 'aim') return;
    setIsCharging(true);
  }, [mode]);

  const onFirePressEnd = useCallback(() => {
    setIsCharging(false);
    const s = stateRef.current;
    if (s.phase !== 'aim') return;
    if (mode === '1p' && s.turn === 2) return;
    setState((cur) => {
      if (cur.phase !== 'aim') return cur;
      const f = fire(cur);
      setRecoil(6);
      window.setTimeout(() => setRecoil(0), 120);
      return f.next;
    });
  }, [mode]);

  // Keyboard: space/enter to fire, arrows for angle, A/D for angle.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (state.phase === 'gameover' || state.phase === 'landed') return;
      if (mode === '1p' && state.turn === 2) return;
      switch (e.key) {
        case ' ':
        case 'Enter':
          e.preventDefault();
          onFirePressStart();
          // Auto-release after a frame so space becomes "tap".
          window.setTimeout(() => onFirePressEnd(), 16);
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          setState((s) => ({ ...s, angle: Math.max(0.15, s.angle - ANGLE_STEP) }));
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          setState((s) => ({
            ...s,
            angle: Math.min(Math.PI / 2 - 0.05, s.angle + ANGLE_STEP),
          }));
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
    };
  }, [state.phase, state.turn, mode, onFirePressStart, onFirePressEnd]);

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      // Clear.
      ctx.fillStyle = PALETTE.sky;
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

      const s = stateRef.current;
      drawSky(ctx);
      drawTerrain(ctx, s.terrain);

      // Tanks.
      drawTank(ctx, s.tanks[0]!.x, s.tanks[0]!.y, 1, recoil);
      drawTank(ctx, s.tanks[1]!.x, s.tanks[1]!.y, 2, 0);

      // Aim preview during aim phase.
      const shooter = s.tanks[s.turn - 1]!;
      drawAim(ctx, s, shooter.y);

      // Shell + explosion.
      if (s.shell) drawShell(ctx, s.shell);
      if (explosion) drawExplosion(ctx, explosion.x, explosion.y, explosion.t);

      // Wind indicator at the top.
      drawWind(ctx, s.wind);
    },
    [explosion, recoil],
  );

  // HP bar layout.
  const hpBar = (player: Player) => {
    const t = s.tanks[player - 1]!;
    const ratio = Math.max(0, t.hp) / MAX_HP;
    return (
      <div className="flex items-center gap-2 text-[10px] font-mono uppercase">
        <span
          className="inline-block w-2 h-2"
          style={{ background: player === 1 ? PALETTE.p1 : PALETTE.p2 }}
        />
        <span className="opacity-70">P{player}</span>
        <div
          className="h-2 w-24 overflow-hidden"
          style={{ background: PALETTE.hpBarBack }}
        >
          <div
            className="h-full"
            style={{
              width: `${ratio * 100}%`,
              background: ratio < 0.3 ? PALETTE.hpBarLow : PALETTE.hpBar,
              transition: 'width 200ms',
            }}
          />
        </div>
        <span className="tabular-nums">{t.hp}</span>
      </div>
    );
  };

  if (mode === null) {
    return (
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <p className="text-sm font-medium text-zinc-900">포트리스</p>
              <p className="text-xs text-zinc-500">턴제 포물선 대전</p>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <p className="text-sm text-zinc-600">
              탱크 두 대가 맞은편에서 번갈아 포탄을 쏴요. 체력을 먼저 0으로
              만든 쪽이 이깁니다. 꾹 누를수록 세게, 짧게 누르면 살짝.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button onClick={() => startNewGame('1p')}>
                1P vs AI
              </Button>
              <Button variant="secondary" onClick={() => startNewGame('2p')}>
                2P 한 기기
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  const s = state;
  const isAiTurn = mode === '1p' && s.turn === 2;

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="text-sm font-medium text-zinc-900">포트리스</p>
            <p className="text-xs text-zinc-500">
              {mode === '1p' ? '1P vs AI' : '2P 한 기기'} ·{' '}
              {s.phase === 'gameover' ? '종료' : s.phase === 'landed' ? '결과' : s.phase === 'flying' ? '비행 중' : `${s.turn === 1 ? 'P1' : 'P2'}의 차례`}
            </p>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          {/* HP bars */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {hpBar(1)}
            <span
              className="text-xs font-mono"
              style={{ color: PALETTE.windArrowStrong }}
            >
              바람 {Math.round(s.wind)}
            </span>
            {hpBar(2)}
          </div>

          {/* Canvas */}
          <div className="relative">
            <PixelCanvas
              width={LOGICAL_W}
              height={LOGICAL_H}
              draw={draw}
              className="w-full"
            />
            {/* Status overlay */}
            {s.phase === 'landed' || s.phase === 'gameover' ? (
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ background: 'rgba(26,28,44,0.55)' }}
              >
                <p className="text-sm font-mono text-white">{s.message}</p>
              </div>
            ) : null}
          </div>

          {/* Controls */}
          {s.phase === 'aim' && !isAiTurn ? (
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">각도</span>
                  <button
                    type="button"
                    className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-700 hover:bg-zinc-50"
                    onClick={() =>
                      setState((cur) => ({
                        ...cur,
                        angle: Math.max(0.15, cur.angle - ANGLE_STEP),
                      }))
                    }
                  >
                    −
                  </button>
                  <span className="w-12 text-center font-mono text-sm tabular-nums text-zinc-900">
                    {Math.round((s.angle * 180) / Math.PI)}°
                  </span>
                  <button
                    type="button"
                    className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-700 hover:bg-zinc-50"
                    onClick={() =>
                      setState((cur) => ({
                        ...cur,
                        angle: Math.min(Math.PI / 2 - 0.05, cur.angle + ANGLE_STEP),
                      }))
                    }
                  >
                    +
                  </button>
                </div>

                {/* Power gauge */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">힘</span>
                  <div className="h-3 w-32 overflow-hidden rounded border border-zinc-200">
                    <div
                      className="h-full"
                      style={{
                        width: `${s.power * 100}%`,
                        background: s.power > 0.75 ? '#ef7d57' : '#ffcd75',
                        transition: 'width 60ms linear',
                      }}
                    />
                  </div>
                </div>
              </div>

              <button
                type="button"
                onPointerDown={onFirePressStart}
                onPointerUp={onFirePressEnd}
                onPointerLeave={() => {
                  if (chargingRef.current) onFirePressEnd();
                }}
                onPointerCancel={() => {
                  if (chargingRef.current) onFirePressEnd();
                }}
                className="select-none rounded-xl border-2 py-3 text-sm font-mono uppercase tracking-wide active:translate-y-px"
                style={{
                  borderColor: '#ff5a4e',
                  background: '#fff1ef',
                  color: '#c93c2e',
                  touchAction: 'none',
                }}
              >
                꾹 눌러서 충전, 떼서 발사
              </button>
            </div>
          ) : null}

          {s.phase === 'aim' && isAiTurn ? (
            <p className="text-center text-xs text-zinc-500">AI가 차롈예요…</p>
          ) : null}

          {/* Game over */}
          {s.phase === 'gameover' ? (
            <div className="flex justify-center gap-2">
              <Button onClick={() => startNewGame(mode)}>다시 하기</Button>
              <Button variant="secondary" onClick={() => setMode(null)}>
                모드 선택
              </Button>
            </div>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
