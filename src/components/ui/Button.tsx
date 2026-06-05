import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

const base =
  'inline-flex items-center justify-center gap-2 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50';

const variants: Record<Variant, string> = {
  primary: 'bg-zinc-900 text-white hover:bg-zinc-700',
  secondary: 'border border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300 hover:bg-zinc-50',
  ghost: 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 rounded-full px-3 text-sm',
  md: 'h-10 rounded-full px-5 text-sm',
  lg: 'h-12 rounded-full px-6 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
