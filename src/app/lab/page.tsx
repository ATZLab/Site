import Link from 'next/link';
import { services } from '@/services/_registry';

export default function LabIndex() {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {services.map((s) => (
        <li key={s.id}>
          <Link
            href={s.route}
            className="group block rounded-2xl border border-zinc-200 p-6 transition-all hover:border-zinc-300 hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-medium text-zinc-900">{s.label}</p>
                <p className="mt-1 text-sm text-zinc-600">{s.description}</p>
              </div>
              <span
                aria-hidden
                className="text-zinc-400 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-900"
              >
                →
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
