import { assignCandidateToCohort, unassignCandidateFromCohort } from '@/app/support/admin/layoff-cohorts/actions'
import { SubmitButton } from '@/components/ui/submit-button'

export function LayoffCohortMatchRow({
  candidateId,
  cohortId,
  name,
  confirmed,
}: {
  candidateId: string
  cohortId?: string
  name: string
  confirmed: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
      <p className="text-sm text-foreground">{name}</p>
      {confirmed ? (
        <form action={unassignCandidateFromCohort.bind(null, candidateId)}>
          <SubmitButton variant="ghost" size="sm">
            Remove
          </SubmitButton>
        </form>
      ) : (
        <form action={assignCandidateToCohort.bind(null, candidateId, cohortId!)}>
          <SubmitButton variant="outline" size="sm">
            Confirm match
          </SubmitButton>
        </form>
      )}
    </div>
  )
}
