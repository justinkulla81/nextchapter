import { ShareToLinkedIn } from '@/components/ShareToLinkedIn'

export const metadata = {
  title: 'Thank you | NextChapter',
}

// Prompt 65 section 7 — a real recognition moment, not a bare confirmation
// screen. A manager sharing this is organic distribution to an audience of
// other managers who'll eventually be in the same position.
export default function GiveAReferenceThankYouPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-medium text-muted-foreground">NextChapter</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        You helped someone land well.
      </h1>
      <p className="mt-3 text-muted-foreground">
        Your reference and invite are on their way. They&apos;ll see everything you wrote and choose
        for themselves whether to use it — nothing is shared automatically.
      </p>
      <div className="mt-6">
        <ShareToLinkedIn url="https://launchyournextchapter.com/for-managers/give-a-reference" />
      </div>
    </div>
  )
}
