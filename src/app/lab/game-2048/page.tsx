import type { Metadata } from 'next';
import { Game2048 } from '@/services/game-2048/components/Game2048';

export const metadata: Metadata = {
  title: '2048',
  description: '방향키로 타일을 슬라이드하고 합쳐서 2048을 만드세요. 3×3, 4×4, 5×5.',
};

export default function Game2048Page() {
  return (
    <div>
      <header className="mb-6">
        <p className="mb-1 text-sm font-medium text-zinc-500">/lab/game-2048</p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">2048</h1>
        <p className="mt-2 max-w-prose text-sm text-zinc-600">
          같은 숫자 두 개를 부딪혀서 더 큰 숫자를 만드세요. <span className="font-medium text-zinc-900">2048</span>에 도달하면
          팝업이 떠요. 방향키 또는 스와이프로 플레이 가능.
        </p>
      </header>
      <Game2048 />
    </div>
  );
}
