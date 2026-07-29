import Link from 'next/link'
import { Button } from '@/components/ui/button'

export const metadata = {
  title: 'Give a Reference | NextChapter',
  description: 'Leave a reference for someone you just let go, while it’s still fresh.',
}

// Prompt 65 section 2 — public landing page. Reframes an awkward moment
// (letting someone go) into something concrete and useful, in Victoria's
// direct, warm, no-filler voice rather than generic outplacement copy.
export default function GiveAReferenceLandingPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-20">
      <p className="text-sm font-medium text-muted-foreground">NextChapter for managers</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        You just let someone great go. Help them land well.
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">
        A reference from you, right now, while it&apos;s fresh, is worth more than anything they
        could round up months from now. Takes five minutes.
      </p>

      <div className="mt-8 space-y-4 text-sm text-muted-foreground">
        <p>Here&apos;s exactly what happens:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>You tell us who you are and who they are — takes 30 seconds.</li>
          <li>You leave a real reference: what they&apos;re good at, a story or two, whether you&apos;d work with them again.</li>
          <li>
            We invite them to NextChapter with your reference attached — but nothing becomes
            visible or usable anywhere until they see it themselves and choose to accept it.
          </li>
        </ul>
      </div>

      <div className="mt-10">
        <Button nativeButton={false} size="lg" render={<Link href="/for-managers/give-a-reference/submit" />}>
          Give a reference
        </Button>
      </div>
    </div>
  )
}
