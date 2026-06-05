import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';

const baseField =
  'block w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors hover:border-zinc-300 focus:border-zinc-900 focus:outline-none focus:ring-0';

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = '', ...rest },
  ref,
) {
  return <input ref={ref} className={`${baseField} ${className}`} {...rest} />;
});

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className = '', ...rest },
  ref,
) {
  return <textarea ref={ref} className={`${baseField} resize-y ${className}`} {...rest} />;
});
