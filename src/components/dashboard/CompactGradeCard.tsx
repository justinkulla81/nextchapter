import Link from 'next/link'
import type { HireabilityGrade, Grade } from '@/lib/scoring/grade'
import { cn } from '@/lib/utils'

const GRADE_COLOR: Record<Grade, string> = {
  A: 'text-success',
  B: 'text-brand',
  C: 'text-light-blue',
  D: 'text-warning',
  F: 'text-error',
}

export function CompactGradeCard({
  grade,
  searchExecutionAvailable,
}: {
  grade: HireabilityGrade
  searchExecutionAvailable: boolean
}) {
  return (
    <Link
      href="/dashboard/hireability-report"
      className="block rounded-xl border border-border bg-white p-6 transition-colors hover:border-brand/40"
    >
      <p className="text-sm font-medium text-muted-foreground">Hireability Grade</p>
      <div className="mt-3 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Market Reality
          </p>
          <p className={cn('text-5xl font-bold', GRADE_COLOR[grade.marketReality.grade])}>
            {grade.marketReality.grade}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Search Execution
          </p>
          <p
            className={cn(
              'text-5xl font-bold',
              searchExecutionAvailable ? GRADE_COLOR[grade.searchExecution.grade] : 'text-muted-foreground'
            )}
          >
            {searchExecutionAvailable ? grade.searchExecution.grade : 'N/A'}
          </p>
        </div>
      </div>
      <p className="mt-3 text-xs text-primary underline underline-offset-4">See full report →</p>
      <p className="mt-2 text-xs text-muted-foreground">
        Both grades feed your executive dossier — the Recruiter Report you hand to hiring
        managers, recruiters, and coaches alongside your resume and cover letter.
      </p>
    </Link>
  )
}
