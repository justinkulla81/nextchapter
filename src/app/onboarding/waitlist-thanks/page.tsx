import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'

export const metadata: Metadata = { title: "You're on the list" }

export default function WaitlistThanksPage() {
  return (
    <div className="space-y-6 text-center">
      <div className="flex justify-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-success/10 text-success">
          <CheckCircle2 className="size-7" aria-hidden />
        </span>
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">You&apos;re on the list</h1>
        <p className="mt-1 text-muted-foreground">
          We&apos;re building a NextChapter experience made for new graduates — we&apos;ll email you the moment it
          launches.
        </p>
      </div>
      <Link href="/" className="inline-block text-sm font-medium text-primary underline underline-offset-4">
        Back to launchyournextchapter.com
      </Link>
    </div>
  )
}
