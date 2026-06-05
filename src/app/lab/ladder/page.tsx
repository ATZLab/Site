import type { Metadata } from 'next';
import { LadderGame } from '@/services/ladder/components/LadderGame';

export const metadata: Metadata = {
  title: '사다리 타기',
  description: '이름과 항목을 입력하면 경로를 추적해 매칭해줘요.',
};

export default function LadderPage() {
  return (
    <div>
      <header className="mb-6">
        <p className="mb-1 text-sm font-medium text-zinc-500">/lab/ladder</p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">사다리 타기</h1>
        <p className="mt-2 max-w-prose text-sm text-zinc-600">
          이름과 결과를 입력하고 사다리를 만들어 보세요. 다리 칸은 무작위로 결정돼요.
          <span className="font-medium text-zinc-900"> 한 번에 보기</span>로 전체 결과를 확인하거나,
          <span className="font-medium text-zinc-900"> 시작점</span>을 하나씩 클릭해 그 경로만 따라가 볼 수 있어요.
        </p>
      </header>
      <LadderGame />
    </div>
  );
}
