import { cn } from '@/lib/utils'

/** The hand-drawn line under a page headline. Brand blue, never the action colour, so it cannot read as a button. */
export function Squiggle({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" width="150" height="8" viewBox="0 0 150 8" fill="none" className={cn('text-brand', className)}>
      <path d="M2 5q18-5 36 0t36 0 36 0 36 0" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}
