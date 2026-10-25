'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useToasts } from '@/lib/toast';
import { cn } from './ui';

/** Top-of-screen notifications. Large, readable, and announced to screen readers. */
export default function Toaster() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-14 z-[70] flex flex-col items-center gap-2 px-3" aria-live="polite" role="status">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ y: -24, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', damping: 22, stiffness: 320 }}
            className={cn(
              'pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-theme border-2 bg-card p-3 text-fg shadow-2xl',
              t.tone === 'error' ? 'border-red-500' : 'border-accent',
            )}
          >
            {t.emoji && <span className="text-3xl leading-none" aria-hidden>{t.emoji}</span>}
            <div className="min-w-0 flex-1">
              <p className="font-bold">{t.title}</p>
              {t.body && <p className="text-sm text-muted">{t.body}</p>}
            </div>
            <button onClick={() => dismiss(t.id)} aria-label="Close" className="rounded-full p-1 hover:bg-bg"><X size={18} /></button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
