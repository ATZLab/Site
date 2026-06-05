import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { services } from '@/services/_registry';

export default function HomePage() {
  return (
    <Container className="py-20 sm:py-28">
      {/* Hero */}
      <section className="max-w-2xl">
        <p className="mb-3 text-sm font-medium text-zinc-500">Personal Lab</p>
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">
          가볍게 만들고, <br className="hidden sm:block" />
          가볍게 굴려보는.
        </h1>
        <p className="mt-5 text-lg text-zinc-600">
          사다리 타기, 제비 뽑기 같은 자잘한 서비스들을 하나씩 모아두는 곳입니다.
          브라우저에서 바로 돌아가는 작은 도구들이에요.
        </p>
        <div className="mt-8 flex gap-3">
          <Link
            href="/lab"
            className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            실험실 가기
            <span aria-hidden>→</span>
          </Link>
          <a
            href="https://github.com/ATZLab/Site"
            className="inline-flex items-center gap-2 rounded-full border border-zinc-200 px-5 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
          >
            GitHub
          </a>
        </div>
      </section>

      {/* Services preview */}
      <section className="mt-24">
        <h2 className="text-sm font-medium text-zinc-500">들어있는 것들</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {services.map((s) => (
            <li key={s.id}>
              <Link
                href={s.route}
                className="block rounded-2xl border border-zinc-200 p-5 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
              >
                <p className="text-base font-medium text-zinc-900">{s.label}</p>
                <p className="mt-1 text-sm text-zinc-600">{s.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </Container>
  );
}
