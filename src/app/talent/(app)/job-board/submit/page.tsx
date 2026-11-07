import { JobBoardSubmissionForm } from '@/components/jobs/JobBoardSubmissionForm'
import { submitEmployerJobBoardPosting } from './actions'
import { Squiggle } from '@/components/ui/squiggle'

export default function TalentJobBoardSubmitPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Post to the Job Board</h1>
        <Squiggle className="mt-2" />
        <p className="mt-1 text-muted-foreground">
          Shown only to candidates currently holding an A Market Reality Assessment. Every posting needs
          a named contact and a real salary band, and is reviewed by a person before it goes live.
        </p>
      </div>
      <JobBoardSubmissionForm action={submitEmployerJobBoardPosting} />
    </div>
  )
}
