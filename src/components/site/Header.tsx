import Link from 'next/link';
import { Container } from '@/components/ui/Container';

const nav = [
  { href: '/lab', label: 'Lab' },
  { href: 'https://github.com/ATZLab/Site', label: 'GitHub', external: true },
];

export function Header() {
  return (
    <header className="border-b border-zinc-100">
      <Container className="flex h-14 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
          <span
            aria-hidden
            className="inline-block h-5 w-5 rounded-md bg-zinc-900"
          />
          Site
        </Link>
        <nav className="flex items-center gap-1">
          {nav.map((item) =>
            item.external ? (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noreferrer noopener"
                className="rounded-full px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>
      </Container>
    </header>
  );
}
