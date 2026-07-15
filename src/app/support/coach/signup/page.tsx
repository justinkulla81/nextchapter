import { CoachSignupForm } from '@/components/coach/CoachSignupForm'

export default function CoachSignupPage() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <div className="mb-6 space-y-2">
        <p className="text-sm font-medium text-muted-foreground">NextChapter for Coaches</p>
        <h1 className="text-2xl font-semibold tracking-tight">Bring your clients onto NextChapter</h1>
        <p className="text-muted-foreground">
          Set up in under a minute, then invite the clients you&apos;re already working with.
        </p>
      </div>
      <CoachSignupForm appUrl={appUrl} />
    </div>
  )
}
