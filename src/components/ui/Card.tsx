import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

/** Rounded surface with thin border. Use for service tiles and content panels. */
export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`rounded-2xl border border-zinc-200 bg-white ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }: CardProps) {
  return <div className={`border-b border-zinc-100 px-5 py-4 ${className}`}>{children}</div>;
}

export function CardBody({ children, className = '' }: CardProps) {
  return <div className={`px-5 py-5 ${className}`}>{children}</div>;
}
