import { toggleCrucibleContestEntryShortlist } from '@/app/crucible/employers/(app)/contests/actions'
import { SubmitButton } from '@/components/ui/submit-button'

export function ShortlistToggleButton({ entryId, shortlisted }: { entryId: string; shortlisted: boolean }) {
  const action = toggleCrucibleContestEntryShortlist.bind(null, entryId)
  return (
    <form action={action}>
      <SubmitButton variant={shortlisted ? 'default' : 'outline'} size="sm">
        {shortlisted ? '★ Shortlisted' : '☆ Shortlist'}
      </SubmitButton>
    </form>
  )
}
