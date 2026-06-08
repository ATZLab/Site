'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
const POWER_PER_FRAME = 0.025;
const LANDED_MS = 380; // how long the 'landed' phase lasts before next turn
const POPUP_MS = 900; // damage number floats up over this duration

// Canvas layout (logical pixels).
const TOP_HUD_H = 14;
const BOT_HUD_H = 14;
const PLAY_TOP = TOP_HUD_H;
const PLAY_BOT = LOGICAL_H - BOT_HUD_H;

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
  hudBg: '#0e0f1a',
  hudEdge: '#3a3f5c',
  hpBar: '#41a6f6',
  hpBarBack: '#29366f',
  hpBarLow: '#ef7d57',
  windArrow: '#94b0c2',
  windArrowStrong: '#ffcd75',
  aim: '#ffcd75',
  p1: '#41a6f6',
  p2: '#ef7d57',
  marker: '#ffcd75',
  damage: '#ffcd75',
  critDamage: '#ef7d57',
};

// --- Drawing helpers ----------------------------------------------------------

/** Draw a tiny 3×5 pixel digit at (x, y). Only handles 0-9 and "-". */
function drawDigit(ctx: CanvasRenderingContext2D, d: string, x: number, y: number, color: string) {
  const pat: Record<string, string[]> = {
    '0': ['111', '101', '101', '101', '111'],
    '1': ['010', '110', '010', '010', '111'],
    '2': ['111', '001', '111', '100', '111'],
    '3': ['111', '001', '111', '001', '111'],
    '4': ['101', '101', '111', '001', '001'],
    '5': ['111', '100', '111', '001', '111'],
    '6': ['111', '100', '111', '101', '111'],
    '7': ['111', '001', '010', '010', '010'],
    '8': ['111', '101', '111', '101', '111'],
    '9': ['111', '101', '111', '001', '111'],
    '-': ['000', '000', '111', '000', '000'],
    'P': ['111', '101', '111', '100', '100'],
    '1_long': ['010', '110', '010', '010', '111'],
    ' ': ['000', '000', '000', '000', '000'],
    'P1': ['111', '101', '111', '100', '100'],
    'P2': ['111', '101', '111', '100', '100'],
  };
  const rows = pat[d];
  if (!rows) return;
  ctx.fillStyle = color;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]!;
    for (let c = 0; c < row.length; c++) {
      if (row[c] === '1') ctx.fillRect(x + c, y + r, 1, 1);
    }
  }
}

/** Draw a string of digits/letters at (x, y) with 1px spacing. */
function drawString(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, color: string) {
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (ch === 'P' && i + 1 < s.length && (s[i + 1] === '1' || s[i + 1] === '2')) {
      drawDigit(ctx, ch, x, y, color);
      x += 4;
    } else {
      drawDigit(ctx, ch, x, y, color);
      x += 4;
    }
  }
}

function drawSky(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  g.addColorStop(0, PALETTE.sky2);
  g.addColorStop(1, PALETTE.sky);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  // Stars, but only above the play area.
  ctx.fillStyle = '#566c86';
  for (let i = 0; i < 30; i++) {
    const x = (i * 53) % LOGICAL_W;
    const y = TOP_HUD_H + (i * 17) % (PLAY_BOT - TOP_HUD_H - 30);
    ctx.fillRect(x, y, 1, 1);
  }
}

function drawTerrain(ctx: CanvasRenderingContext2D, terrain: number[]) {
  ctx.fillStyle = PALETTE.ground;
  ctx.beginPath();
  ctx.moveTo(0, LOGICAL_H);
  for (let x = 0; x < LOGICAL_W; x++) {
    ctx.lineTo(x, terrain[x]!);
  }
  ctx.lineTo(LOGICAL_W, LOGICAL_H);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = PALETTE.groundTop;
  for (let x = 0; x < LOGICAL_W; x++) {
    ctx.fillRect(x, terrain[x]!, 1, 1);
  }

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
  flashAlpha: number, // 0..1, 1 = fully white
) {
  const left = Math.round(x - TANK_W / 2);
  const top = Math.round(y);

  ctx.fillStyle = PALETTE.tankTrack;
  ctx.fillRect(left, top + TANK_H - 2, TANK_W, 2);
  ctx.fillStyle = '#444';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(left + 1 + i * 3, top + TANK_H - 1, 1, 1);
  }
  ctx.fillStyle = PALETTE.tankBody;
  ctx.fillRect(left, top, TANK_W, TANK_H - 2);
  ctx.fillStyle = PALETTE.tankBodyDark;
  ctx.fillRect(left, top + TANK_H - 4, TANK_W, 1);
  ctx.fillStyle = PALETTE.tankWindow;
  ctx.fillRect(left + (player === 1 ? 1 : TANK_W - 4), top - 1, 3, 2);
  ctx.fillStyle = PALETTE.barrel;
  const dir = player === 1 ? 1 : -1;
  const barrelStartX = player === 1 ? left + TANK_W - 1 : left;
  const barrelStartY = top + 1;
  const barrelEndX = barrelStartX + (10 - recoil) * dir;
  ctx.fillRect(
    Math.min(barrelStartX, barrelEndX),
    barrelStartY,
    Math.abs(barrelEndX - barrelStartX) + 1,
    2,
  );

  // Damage flash overlay.
  if (flashAlpha > 0) {
    ctx.fillStyle = `rgba(255,255,255,${flashAlpha})`;
    ctx.fillRect(left, top, TANK_W, TANK_H);
  }
}

function drawShell(ctx: CanvasRenderingContext2D, shell: Shell) {
  ctx.fillStyle = PALETTE.shellTrail;
  for (let i = 0; i < shell.trail.length; i++) {
    const t = shell.trail[i]!;
    const alpha = i / shell.trail.length;
    if (alpha < 0.4) continue;
    ctx.fillRect(Math.round(t.x), Math.round(t.y), 1, 1);
  }
  ctx.fillStyle = PALETTE.shell;
  ctx.fillRect(Math.round(shell.x) - 1, Math.round(shell.y) - 1, 2, 2);
}

function drawExplosion(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  t: number,
) {
  const r = 4 + t * 10;
  ctx.fillStyle = PALETTE.explosion;
  for (let dx = -r; dx <= r; dx++) {
    const dy = Math.sqrt(r * r - dx * dx);
    ctx.fillRect(Math.round(cx + dx), Math.round(cy - dy), 1, 1);
    ctx.fillRect(Math.round(cx + dx), Math.round(cy + dy), 1, 1);
  }
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
    if (y >= state.terrain[Math.max(0, Math.min(LOGICAL_W - 1, Math.round(x)))]!) break;
    if (i % 2 === 0) ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
}

/** Bouncing arrow above the active tank. `bounce` is 0..1 phase. */
function drawActiveMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  top: number,
  bounce: number,
) {
  // 0 = top, 1 = bottom of bounce range. Sin gives a smooth bob.
  const dy = Math.round(Math.sin(bounce * Math.PI * 2) * 2);
  const cy = top - 6 - dy;
  const cx = Math.round(x);

  ctx.fillStyle = PALETTE.marker;
  // Downward-pointing triangle (tip at top of tank).
  ctx.fillRect(cx - 2, cy, 5, 1);
  ctx.fillRect(cx - 1, cy + 1, 3, 1);
  ctx.fillRect(cx, cy + 2, 1, 1);
}

function drawTopHud(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  hitFlash: Record<Player, number>,
) {
  // Background bar.
  ctx.fillStyle = PALETTE.hudBg;
  ctx.fillRect(0, 0, LOGICAL_W, TOP_HUD_H);
  ctx.fillStyle = PALETTE.hudEdge;
  ctx.fillRect(0, TOP_HUD_H - 1, LOGICAL_W, 1);

  // P1 HP bar (left).
  const drawHp = (player: Player, x: number) => {
    const t = state.tanks[player - 1]!;
    const ratio = Math.max(0, t.hp) / MAX_HP;
    const w = 36;
    // Tag.
    drawString(ctx, `P${player}`, x, 4, player === 1 ? PALETTE.p1 : PALETTE.p2);
    // Bar background.
    ctx.fillStyle = PALETTE.hpBarBack;
    ctx.fillRect(x + 12, 4, w, 5);
    // Bar fill.
    ctx.fillStyle = ratio < 0.3 ? PALETTE.hpBarLow : PALETTE.hpBar;
    ctx.fillRect(x + 12, 4, Math.round(w * ratio), 5);
    // Hit flash on the bar (pulse white).
    if (hitFlash[player] > 0) {
      ctx.fillStyle = `rgba(255,255,255,${hitFlash[player] * 0.7})`;
      ctx.fillRect(x + 12, 4, w, 5);
    }
    // HP digits to the right of the bar.
    const hpText = String(t.hp).padStart(3, ' ');
    drawString(ctx, hpText, x + 12 + w + 2, 4, PALETTE.text);
  };
  drawHp(1, 4);
  drawHp(2, LOGICAL_W - 4 - 12 - 36 - 3 * 4 - 4);

  // Wind indicator centered. Strength dot row + arrow.
  const strength = Math.min(1, Math.abs(state.wind) / 120);
  const color = strength > 0.66
    ? PALETTE.windArrowStrong
    : strength > 0.33
      ? '#c0cbdc'
      : PALETTE.windArrow;
  const cx = LOGICAL_W / 2;
  const cy = 4;
  // Background pill so wind is always legible.
  ctx.fillStyle = PALETTE.hudBg;
  ctx.fillRect(cx - 18, 3, 36, 8);
  // Arrow body.
  ctx.fillStyle = color;
  if (state.wind >= 0) {
    ctx.fillRect(cx - 8, cy + 3, 14, 2);
    ctx.fillRect(cx + 4, cy + 2, 1, 1);
    ctx.fillRect(cx + 5, cy + 3, 1, 1);
    ctx.fillRect(cx + 4, cy + 4, 1, 1);
  } else {
    ctx.fillRect(cx - 6, cy + 3, 14, 2);
    ctx.fillRect(cx - 7, cy + 2, 1, 1);
    ctx.fillRect(cx - 6, cy + 3, 1, 1);
    ctx.fillRect(cx - 7, cy + 4, 1, 1);
  }
  // Strength bar (centered below arrow).
  const w = Math.round(strength * 8);
  for (let i = 0; i < w; i++) {
    ctx.fillRect(cx - w / 2 + i, cy + 6, 1, 1);
  }
  // "W" label for wind? Optional. Skip — the arrow is recognizable.
}

function drawBottomHud(
  ctx: CanvasRenderingContext2D,
  state: GameState,
) {
  // Background bar.
  ctx.fillStyle = PALETTE.hudBg;
  ctx.fillRect(0, LOGICAL_H - BOT_HUD_H, LOGICAL_W, BOT_HUD_H);
  ctx.fillStyle = PALETTE.hudEdge;
  ctx.fillRect(0, LOGICAL_H - BOT_HUD_H, LOGICAL_W, 1);

  if (state.phase !== 'aim') return;
  const shooter = state.tanks[state.turn - 1]!;
  const shooterColor = state.turn === 1 ? PALETTE.p1 : PALETTE.p2;

  // Turn tag (left): "P1" or "P2".
  drawString(ctx, `P${state.turn}`, 4, LOGICAL_H - BOT_HUD_H + 4, shooterColor);

  // Angle readout (middle-left): "A60" — A=angle, value in degrees.
  const deg = Math.round((state.angle * 180) / Math.PI);
  drawString(ctx, 'A', 24, LOGICAL_H - BOT_HUD_H + 4, PALETTE.text);
  drawString(ctx, String(deg).padStart(2, ' '), 32, LOGICAL_H - BOT_HUD_H + 4, PALETTE.text);

  // Power gauge (right): horizontal bar, color shifts when hot.
  const barX = LOGICAL_W - 4 - 50;
  const barY = LOGICAL_H - BOT_HUD_H + 4;
  const barW = 40;
  // Label "P".
  drawString(ctx, 'P', barX - 8, LOGICAL_H - BOT_HUD_H + 4, PALETTE.text);
  // Background.
  ctx.fillStyle = PALETTE.hpBarBack;
  ctx.fillRect(barX, barY + 1, barW, 5);
  // Fill.
  ctx.fillStyle = state.power > 0.75 ? '#ef7d57' : PALETTE.aim;
  ctx.fillRect(barX, barY + 1, Math.round(barW * state.power), 5);
  // Tick marks.
  for (let i = 1; i < 4; i++) {
    ctx.fillStyle = PALETTE.hudEdge;
    ctx.fillRect(barX + Math.round((barW / 4) * i), barY, 1, 7);
  }
  // Reference back to which side: subtle triangle pointing away from the
  // shooter toward where the shot will go.
  const triX = shooter.player === 1 ? barX - 4 : barX + barW + 1;
  const triY = barY + 3;
  ctx.fillStyle = shooterColor;
  if (shooter.player === 1) {
    ctx.fillRect(triX, triY, 3, 1);
    ctx.fillRect(triX + 1, triY + 1, 1, 1);
  } else {
    ctx.fillRect(triX, triY, 3, 1);
    ctx.fillRect(triX + 1, triY + 1, 1, 1);
  }
}

function drawDamagePopups(
  ctx: CanvasRenderingContext2D,
  popups: DamagePopup[],
) {
  for (const p of popups) {
    const t = p.elapsed / POPUP_MS;
    if (t >= 1) continue;
    const yOffset = Math.round(t * 18);
    const alpha = 1 - t;
    const color = p.color;
    // Numbers like "-35" or "-9".
    const text = p.value > 0 ? `-${p.value}` : '';
    const x = Math.round(p.x - (text.length * 4) / 2);
    const y = Math.round(p.y - yOffset);
    // Drop shadow for legibility.
    drawString(ctx, text, x + 1, y + 1, 'rgba(0,0,0,0.6)');
    drawStringWithAlpha(ctx, text, x, y, color, alpha);
  }
}

function drawStringWithAlpha(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  color: string,
  alpha: number,
) {
  // alpha only applied if color is hex; otherwise pass through.
  // For our palette, we just use the color directly. alpha is mostly for
  // visual continuity with the shadow.
  drawString(ctx, s, x, y, color);
  void alpha;
}

// --- Game state effects ------------------------------------------------------

interface DamagePopup {
  x: number;
  y: number;
  value: number;
  color: string;
  elapsed: number;
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
  const [popups, setPopups] = useState<DamagePopup[]>([]);
  const [hitFlash, setHitFlash] = useState<Record<Player, number>>({ 1: 0, 2: 0 });
  const [bouncePhase, setBouncePhase] = useState(0);

  const stateRef = useRef(state);
  stateRef.current = state;
  const chargingRef = useRef(isCharging);
  chargingRef.current = isCharging;

  // Bounce the active-player marker.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      setBouncePhase((p) => (p + dt * 1.6) % 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

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

  // Animate damage popups: tick elapsed, drop when expired.
  const popupsActive = popups.length > 0;
  useEffect(() => {
    if (!popupsActive) return;
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = (t - last);
      last = t;
      setPopups((cur) => {
        const next = cur
          .map((p) => ({ ...p, elapsed: p.elapsed + dt }))
          .filter((p) => p.elapsed < POPUP_MS);
        return next.length === cur.length ? cur : next;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [popupsActive]);

  // Fade hit flash.
  const hitFlashActive = hitFlash[1] > 0 || hitFlash[2] > 0;
  useEffect(() => {
    if (!hitFlashActive) return;
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = (t - last) / 200;
      last = t;
      setHitFlash((cur) => {
        const next: Record<Player, number> = { ...cur };
        if (next[1] > 0) next[1] = Math.max(0, next[1] - dt);
        if (next[2] > 0) next[2] = Math.max(0, next[2] - dt);
        if (next[1] === 0 && next[2] === 0) return cur;
        return next;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [hitFlashActive]);

  // 'landed' → 'aim' transition.
  useEffect(() => {
    if (state.phase !== 'landed') return;
    const t = window.setTimeout(() => {
      setState((s) => acknowledgeLanding(s).next);
    }, LANDED_MS);
    return () => window.clearTimeout(t);
  }, [state.phase]);

  // Power-charge loop.
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

  // AI auto-plays.
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

  // Game loop while flying.
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
        if (next.phase === 'landed' && s.phase === 'flying' && s.shell) {
          setExplosion({ x: s.shell.x, y: s.shell.y, t: 0 });
          // Detect damage: if a popup-worthy event happened, push a popup
          // and trigger a hit flash. The easiest source of truth is
          // comparing the previous and next tank HPs of the *enemy*.
          const prevEnemy = s.tanks[s.turn - 1]!;
          const newEnemy = next.tanks[s.turn - 1]!;
          const dmg = prevEnemy.hp - newEnemy.hp;
          if (dmg > 0) {
            setPopups((cur) => [
              ...cur,
              {
                x: newEnemy.x,
                y: newEnemy.y - 6,
                value: dmg,
                color: dmg >= 30 ? PALETTE.critDamage : PALETTE.damage,
                elapsed: 0,
              },
            ]);
            const hit: Record<Player, number> = { 1: 0, 2: 0 };
            hit[s.turn === 1 ? 2 : 1] = 1;
            setHitFlash(hit);
          }
        }
        return next;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [state.phase]);

  const startNewGame = useCallback((m: GameMode) => {
    setMode(m);
    setState(newGame({ mode: m, seed: Math.floor(Math.random() * 1e9) }));
    setIsCharging(false);
    setExplosion(null);
    setRecoil(0);
    setPopups([]);
    setHitFlash({ 1: 0, 2: 0 });
  }, []);

  const onFirePressStart = useCallback(() => {
    if (mode === '1p' && stateRef.current.turn === 2) return;
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

  // Keyboard.
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
      ctx.fillStyle = PALETTE.sky;
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

      const s = stateRef.current;

      drawSky(ctx);
      // Clip terrain drawing to the play area.
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, PLAY_TOP, LOGICAL_W, PLAY_BOT - PLAY_TOP);
      ctx.clip();
      drawTerrain(ctx, s.terrain);
      drawTank(ctx, s.tanks[0]!.x, s.tanks[0]!.y, 1, recoil, hitFlash[1]);
      drawTank(ctx, s.tanks[1]!.x, s.tanks[1]!.y, 2, 0, hitFlash[2]);
      drawAim(ctx, s, s.tanks[s.turn - 1]!.y);
      if (s.shell) drawShell(ctx, s.shell);
      if (explosion) drawExplosion(ctx, explosion.x, explosion.y, explosion.t);
      drawDamagePopups(ctx, popups);
      ctx.restore();

      // HUD overlays (drawn unclipped, on top of everything).
      drawTopHud(ctx, s, hitFlash);
      drawBottomHud(ctx, s);

      // Active-player marker above the current tank (only in 'aim').
      if (s.phase === 'aim') {
        const shooter = s.tanks[s.turn - 1]!;
        drawActiveMarker(ctx, shooter.x, shooter.y, bouncePhase);
      }
    },
    [explosion, recoil, popups, hitFlash, bouncePhase],
  );

  // --- Mode select screen ---

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
              <Button onClick={() => startNewGame('1p')}>1P vs AI</Button>
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
              {s.phase === 'gameover'
                ? '종료'
                : s.phase === 'landed'
                  ? '결과'
                  : s.phase === 'flying'
                    ? '비행 중'
                    : `${s.turn === 1 ? 'P1' : 'P2'}의 차례`}
            </p>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          {/* Canvas — all gameplay + HUD lives inside. */}
          <div className="relative">
            <PixelCanvas
              width={LOGICAL_W}
              height={LOGICAL_H}
              draw={draw}
              className="w-full"
            />
          </div>

          {/* Controls — only the interactive bits. Power gauge is in-canvas. */}
          {s.phase === 'aim' && !isAiTurn ? (
            <div className="grid gap-3">
              <div className="flex items-center justify-center gap-2">
                <span className="text-xs text-zinc-500">각도</span>
                <button
                  type="button"
                  className="rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-50"
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
                  className="rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-50"
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
