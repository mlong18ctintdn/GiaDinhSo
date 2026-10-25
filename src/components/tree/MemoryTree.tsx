'use client';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useApp } from '@/lib/store';
import { Button } from '../ui';
// Heavy / rarely-needed pieces load only when opened.
const StoryDrawer = dynamic(() => import('./StoryDrawer'), { ssr: false });
const StoryForm = dynamic(() => import('./StoryForm'), { ssr: false });

const W = 800;
const STEP = 120;
const MAX_LEAVES = 8;

type Pt = [number, number];
const quad = (p0: Pt, c: Pt, p1: Pt, t: number): Pt => [
  (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * c[0] + t ** 2 * p1[0],
  (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * c[1] + t ** 2 * p1[1],
];

/** Interactive SVG tree: one branch per year, one leaf per story, a fruit at each branch tip. */
export default function MemoryTree() {
  const { t } = useTranslation();
  const years = useApp((s) => s.storySummary.years);
  const [openYear, setOpenYear] = useState<number | null>(null);
  const [formYear, setFormYear] = useState<number | null>(null);

  // Counts per year come from one tiny request: the tree never downloads the stories themselves.
  const groups = years.map((y) => [y.year, y.count] as const);

  const H = Math.max(520, groups.length * STEP + 240);
  const yOf = (i: number) => H - 120 - i * STEP;
  const topY = groups.length ? yOf(groups.length - 1) - 80 : H - 260;
  const thisYear = new Date().getFullYear();

  return (
    <section aria-labelledby="tree-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="tree-title" className="text-xl font-bold">{t('tree.title')}</h2>
          <p className="text-muted">{groups.length ? t('tree.subtitle') : t('tree.empty')}</p>
        </div>
        <Button onClick={() => setFormYear(thisYear)}>
          <Plus size={18} /> {t('tree.add')}
        </Button>
      </div>

      <div className="card overflow-hidden !p-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block w-full max-w-3xl" role="group" aria-label={t('tree.treeLabel')}>
          <ellipse cx={W / 2} cy={H - 14} rx={170} ry={12} fill="var(--trunk)" opacity={0.25} />
          <motion.path
            d={`M400 ${H - 16} C 392 ${(H + topY) / 2} 408 ${(H + topY) / 2} 400 ${topY}`}
            fill="none"
            stroke="var(--trunk)"
            strokeWidth={22}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1 }}
          />

          {groups.map(([year, count], i) => {
            const y = yOf(i);
            const dir = i % 2 === 0 ? -1 : 1;
            const p0: Pt = [400, y + 30];
            const c: Pt = [400 + dir * 110, y + 40];
            const p1: Pt = [400 + dir * 230, y - 30];
            const shown = Array.from({ length: Math.min(count, MAX_LEAVES) }, (_, k) => k);
            const open = () => setOpenYear(year);
            return (
              <g key={year}>
                <motion.path
                  d={`M${p0[0]} ${p0[1]} Q ${c[0]} ${c[1]} ${p1[0]} ${p1[1]}`}
                  fill="none"
                  stroke="var(--trunk)"
                  strokeWidth={10}
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                />
                <g
                  role="button"
                  tabIndex={0}
                  aria-label={`${year}: ${count}`}
                  className="cursor-pointer outline-none [&:focus-visible>circle]:stroke-[var(--accent)]"
                  onClick={open}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), open())}
                >
                  {shown.map((_, j) => {
                    const tt = shown.length > 1 ? 0.25 + (j / (shown.length - 1)) * 0.55 : 0.55;
                    const [x, py] = quad(p0, c, p1, tt);
                    const side = j % 2 ? 1 : -1;
                    return (
                      <g key={j} transform={`translate(${x} ${py + side * 16}) rotate(${dir * -25 + side * 35})`}>
                        <motion.ellipse
                          rx={15}
                          ry={7.5}
                          fill="var(--leaf)"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 220, damping: 14 }}
                          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                        />
                      </g>
                    );
                  })}
                  <motion.circle
                    cx={p1[0]}
                    cy={p1[1]}
                    r={23}
                    fill="var(--fruit)"
                    stroke="var(--card)"
                    strokeWidth={4}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: 0.7 }}
                    style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                  />
                  <text x={p1[0]} y={p1[1] + 44} textAnchor="middle" fontSize={17} fontWeight={700} style={{ fill: 'var(--fg)' }}>
                    {year}
                  </text>
                  <text x={p1[0]} y={p1[1] + 62} textAnchor="middle" fontSize={13} style={{ fill: 'var(--muted)' }}>
                    {count > MAX_LEAVES ? t('tree.more', { n: count }) : `${count} 🍃`}
                  </text>
                </g>
              </g>
            );
          })}

          {!groups.length && (
            <text x={W / 2} y={topY - 20} textAnchor="middle" fontSize={20} style={{ fill: 'var(--muted)' }}>
              🌱
            </text>
          )}
        </svg>
      </div>

      <StoryDrawer year={openYear} onClose={() => setOpenYear(null)} onAdd={(y) => setFormYear(y)} />
      <StoryForm year={formYear} onClose={() => setFormYear(null)} />
    </section>
  );
}
