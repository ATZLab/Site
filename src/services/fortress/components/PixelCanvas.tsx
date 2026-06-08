'use client';

import { useEffect, useRef } from 'react';

interface PixelCanvasProps {
  /** Logical width in game pixels. */
  width: number;
  /** Logical height in game pixels. */
  height: number;
  /** Render function. Called each frame with the 2D context. */
  draw: (ctx: CanvasRenderingContext2D) => void;
  /** Optional className for the outer wrapper. */
  className?: string;
  /** Pause the rAF loop. Drawing still happens once on resize. */
  paused?: boolean;
}

/**
 * Low-resolution canvas that scales up with `image-rendering: pixelated`
 * for a crisp 8-bit feel. Owns the rAF loop and re-renders every frame
 * while mounted (cheap on a 320×200 canvas).
 */
export function PixelCanvas({ width, height, draw, className, paused }: PixelCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    let raf = 0;
    const loop = () => {
      if (!paused) draw(ctx);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [draw, paused]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={className}
      style={{
        width: '100%',
        height: 'auto',
        imageRendering: 'pixelated',
        display: 'block',
      }}
    />
  );
}
