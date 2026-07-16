import { RecruiterSignupForm } from '@/components/recruiter/RecruiterSignupForm'

export default function RecruiterSignupPage() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <div className="mb-6 space-y-2">
        <p className="text-sm font-medium text-muted-foreground">NextChapter for Recruiters</p>
        <h1 className="text-2xl font-semibold tracking-tight">Get your calibration tool</h1>
        <p className="text-muted-foreground">
          Paste a client brief and get an instant memo on redundant requirements, conflicts, and
          candidates you might be overlooking.
        </p>
      </div>
      <RecruiterSignupForm appUrl={appUrl} />
    </div>
  )
}
