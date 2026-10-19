import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// Small pieces every mockup shares.

const AVATAR_TONES = ['bg-ink/90 text-white', 'bg-brand text-white', 'bg-success text-white', 'bg-orange/70 text-ink', 'bg-muted text-ink']
export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const tone = AVATAR_TONES[name.charCodeAt(0) % AVATAR_TONES.length]
  const dim = size === 'lg' ? 'size-14 text-xl' : size === 'sm' ? 'size-8 text-sm' : 'size-11 text-base'
  return (
    <span aria-hidden className={cn('inline-flex shrink-0 items-center justify-center rounded-xl font-semibold', tone, dim)}>
      {name.trim().charAt(0).toUpperCase()}
    </span>
  )
}

export function Chip({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'good' | 'warm' | 'ink' }) {
  const t = { muted: 'bg-muted text-muted-foreground', good: 'bg-success/10 text-success', warm: 'bg-orange/20 text-ink', ink: 'bg-ink text-white' }[tone]
  return <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', t)}>{children}</span>
}

export function Meter({ pct, label, tone = 'ink' }: { pct: number; label: string; tone?: 'ink' | 'good' }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-border" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={cn('h-full rounded-full', tone === 'good' ? 'bg-success' : 'bg-ink')} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function PrimaryButton({ children, href = '#' }: { children: ReactNode; href?: string }) {
  return <a href={href} className="inline-flex h-11 items-center rounded-full bg-action px-7 text-base font-semibold text-action-foreground hover:brightness-95">{children}</a>
}

export function SecondaryButton({ children, href = '#' }: { children: ReactNode; href?: string }) {
  return <a href={href} className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted">{children}</a>
}

export function DarkButton({ children, href = '#' }: { children: ReactNode; href?: string }) {
  return <a href={href} className="inline-flex h-10 items-center rounded-full bg-ink px-6 text-sm font-semibold text-white hover:opacity-90">{children}</a>
}

export function TextLink({ children, href = '#' }: { children: ReactNode; href?: string }) {
  return <a href={href} className="text-sm font-medium text-brand underline underline-offset-4">{children}</a>
}

export function H2({ children, id }: { children: ReactNode; id?: string }) {
  return <h2 id={id} className="font-display text-xl font-semibold text-ink">{children}</h2>
}

export function Section({ title, children, id }: { title: string; children: ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <H2 id={id}>{title}</H2>
      {children}
    </section>
  )
}
