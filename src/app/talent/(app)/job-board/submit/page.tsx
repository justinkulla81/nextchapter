import { JobBoardSubmissionForm } from '@/components/jobs/JobBoardSubmissionForm'
import { submitEmployerJobBoardPosting } from './actions'

export default function TalentJobBoardSubmitPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Post to the Job Board</h1>
        <p className="mt-1 text-muted-foreground">
          Shown only to candidates currently holding an A Current Market Reality. Every posting needs
          a named contact and a real salary band, and is reviewed by a person before it goes live.
        </p>
      </div>
      <JobBoardSubmissionForm action={submitEmployerJobBoardPosting} />
    </div>
  )
}
