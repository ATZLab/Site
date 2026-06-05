import type { Metadata } from 'next';
import { FortuneGame } from '@/services/fortune/components/FortuneGame';

export const metadata: Metadata = {
  title: '오늘의 운세',
  description: '학업, 직장, 돈, 연애, 건강 — 재미로 보는 가벼운 운세.',
};

export default function FortunePage() {
  return (
    <div>
      <header className="mb-6">
        <p className="mb-1 text-sm font-medium text-zinc-500">/lab/fortune</p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">오늘의 운세</h1>
        <p className="mt-2 max-w-prose text-sm text-zinc-600">
          5가지 카테고리를 한 번에 뽑아줘요. 0~100 사이 값이 나오고, 구간에 따라 짧은 코멘트가 따라옵니다.
          <br className="hidden sm:block" />
          점은 진지한 거 아니에요. 그냥 가볍게 재미로만 봐주세요.
        </p>
      </header>
      <FortuneGame />
    </div>
  );
}
