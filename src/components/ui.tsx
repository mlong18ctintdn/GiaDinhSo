'use client';
import { ButtonHTMLAttributes, ReactNode, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { X } from 'lucide-react';

export const cn = (...a: ClassValue[]) => twMerge(clsx(a));

export function Button({
  variant = 'primary',
  className,
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'outline' | 'ghost' }) {
  return (
    <button
      {...p}
      className={cn(
        'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-theme px-4 py-2.5 font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'bg-accent text-accent-fg hover:brightness-110',
        variant === 'outline' && 'border-2 border-border bg-card hover:border-accent',
        variant === 'ghost' && 'hover:bg-card',
        className,
      )}
    />
  );
}

/** Centered modal, or a right-hand drawer when `side` is set. */
export function Modal({
  open,
  onClose,
  title,
  children,
  side,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  side?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="overlay"
          className="fixed inset-0 z-50 flex bg-black/55 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={(e) => e.stopPropagation()}
            initial={side ? { x: '100%' } : { y: 24, opacity: 0 }}
            animate={side ? { x: 0 } : { y: 0, opacity: 1 }}
            exit={side ? { x: '100%' } : { y: 24, opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            className={cn(
              'overflow-y-auto border border-border bg-card text-fg shadow-2xl',
              side ? 'ml-auto h-full w-full max-w-lg sm:rounded-theme' : 'm-auto max-h-[92vh] w-full max-w-lg rounded-theme',
            )}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-card p-4">
              <h2 className="text-xl font-bold">{title}</h2>
              <button onClick={onClose} aria-label="Close" className="rounded-full p-2 hover:bg-bg">
                <X />
              </button>
            </div>
            <div className="p-4">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
