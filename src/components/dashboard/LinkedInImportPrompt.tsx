'use client'

import Link from 'next/link'
import { posthog } from '@/lib/posthog/client'

// Shown until the candidate has imported their LinkedIn connections. Most
// people find work through someone they know, and the LinkedIn export is the
// one step that turns "I should network" into a list of real names to
// message — so it is the single most prominent action on the page until done.
export function LinkedInImportPrompt({ contactCount }: { contactCount: number }) {
  return (
    <section
      aria-labelledby="linkedin-import-heading"
      className="space-y-3 rounded-xl border border-brand/30 bg-brand/5 p-5"
    >
      <h2 id="linkedin-import-heading" className="text-base font-semibold text-foreground">
        Start with the people you already know
      </h2>
      <p className="text-sm text-muted-foreground">
        Most jobs are found through a person, not an application. Import your LinkedIn connections and we&apos;ll
        show you who works at the companies you want, who to reach out to first, and what to say. It takes about
        two minutes. We only read the file you upload and never log into your LinkedIn account.
      </p>
      <Link
        href="/dashboard/network/contacts?buildList=1#import"
        onClick={() => posthog.capture('linkedin_import_prompt_clicked', { contactCount })}
        className="inline-flex h-10 w-fit items-center justify-center rounded-md bg-brand px-5 text-sm font-medium text-white hover:bg-brand/90"
      >
        Import your LinkedIn connections
      </Link>
    </section>
  )
}
