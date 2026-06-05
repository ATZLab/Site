import type { ReactNode } from 'react';
import { Container } from '@/components/ui/Container';

export default function LabLayout({ children }: { children: ReactNode }) {
  return (
    <Container className="py-12 sm:py-16">
      <p className="mb-2 text-sm font-medium text-zinc-500">/lab</p>
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">실험실</h1>
      <p className="mt-2 text-zinc-600">작은 서비스들을 한곳에 모아둔 메뉴예요.</p>
      <div className="mt-10">{children}</div>
    </Container>
  );
}
