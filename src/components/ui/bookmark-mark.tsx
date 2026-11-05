import { cn } from '@/lib/utils'

/** The NextChapter bookmark: a page marker with a small smile. */
export function BookmarkMark({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" width="18" height="26" viewBox="0 0 18 26" className={cn('text-brand', className)}>
      <path d="M2 1h14v23l-7-5-7 5z" fill="currentColor" />
      <circle cx="6.5" cy="8" r="1.1" fill="#fff" />
      <circle cx="11.5" cy="8" r="1.1" fill="#fff" />
      <path d="M6.5 11.5q2.5 2 5 0" stroke="#fff" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </svg>
  )
}
