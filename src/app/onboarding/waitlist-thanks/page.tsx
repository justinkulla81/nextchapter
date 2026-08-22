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
      {/* Crucible entry point #2 (build spec §2) — the new-grad journey
          itself isn't built yet (this page IS the new-grad journey today),
          so this is where "prove what a resume can't" actually lives for
          this audience right now. */}
      <div className="mx-auto max-w-sm space-y-2 rounded-xl border border-border bg-off-white p-5">
        <p className="font-semibold text-navy">In the meantime — prove what a resume can&apos;t.</p>
        <p className="text-sm text-muted-foreground">
          Take the noexperienceneeded.ai challenge — 15 minutes, use any AI you want, get a scored work sample.
        </p>
        <Link
          href="/noexperience/test?src=nc_newgrad"
          className="mt-2 inline-block rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand/90"
        >
          Take the challenge
        </Link>
      </div>

      <Link href="/" className="inline-block text-sm font-medium text-primary underline underline-offset-4">
        Back to launchyournextchapter.com
      </Link>
    </div>
  )
}
