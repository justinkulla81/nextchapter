import { cn } from '@/lib/utils'

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('font-bold tracking-tight text-navy', className)}>NextChapter</span>
  )
}
