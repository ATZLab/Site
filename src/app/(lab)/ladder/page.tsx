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
          이름과 같은 개수의 결과를 입력하면, 사다리를 무작위로 만들고 각 경로를 끝까지 따라가서 매칭해요.
        </p>
      </header>
      <LadderGame />
    </div>
  );
}
