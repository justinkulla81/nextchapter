import { Lock } from 'lucide-react'
import type { Grade } from '@/lib/scoring/grade'

// Shared locked-state notice for anything gated on an A Search Action
// Grade — always visible with the exact requirement and current standing,
// never a silently-disabled control. See design-principles.md: "never
// disable a button without explaining, in-context, why it is disabled."
export function LockedFeatureNotice({
  title,
  requirement,
  currentGrade,
}: {
  title: string
  requirement: string
  currentGrade: Grade | null
}) {
  return (
    <div className="rounded-lg border border-dashed border-light-gray bg-off-white p-4">
      <div className="flex items-center gap-2">
        <Lock className="size-4 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">{title} — locked</p>
      </div>
      <p className="mt-1.5 text-sm text-muted-foreground">{requirement}</p>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Your current Search Action Grade:{' '}
        <span className="font-semibold text-foreground">{currentGrade ?? 'Not yet graded'}</span>
      </p>
    </div>
  )
}
