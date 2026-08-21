import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { markCrucibleContestEntryOpened } from './actions'
import { ContestEntryForm } from '@/components/crucible/employers/ContestEntryForm'
import { CrucibleWordmark } from '@/components/crucible/CrucibleWordmark'

export const metadata: Metadata = {
  title: { absolute: 'noexperienceneeded.ai — Contest invite' },
  robots: { index: false, follow: false },
}

export default async function CrucibleContestEntryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const entry = await prisma.crucibleContestEntry.findUnique({
    where: { token },
    include: { contest: { include: { employer: true } } },
  })

  // Fire-and-forget — a candidate opening a broken link shouldn't wait on
  // this, and it must never block rendering the "not valid" state below.
  if (entry && !entry.openedAt) void markCrucibleContestEntryOpened(token)

  return (
    <div className="flex min-h-screen flex-col bg-off-white">
      <header className="border-b border-border bg-white">
        <div className="mx-auto max-w-2xl px-6 py-4">
          <CrucibleWordmark className="text-xl" />
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        {!entry ? (
          <p className="text-muted-foreground">This link isn&apos;t valid. Double-check the link from your email.</p>
        ) : (
          <>
            <p className="text-sm font-medium text-muted-foreground">{entry.contest.employer.companyName}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{entry.contest.title}</h1>
            <p className="mt-4 whitespace-pre-wrap text-muted-foreground">{entry.contest.businessProblem}</p>
            {entry.contest.referenceFilePath && (
              <a
                href={entry.contest.referenceFilePath}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-sm font-medium text-primary underline underline-offset-4"
              >
                {entry.contest.referenceFileName ?? 'Reference file'}
              </a>
            )}

            {entry.contest.state === 'OPEN' ? (
              <ContestEntryForm token={token} existingSubmission={entry.submission} />
            ) : (
              <div className="mt-6 space-y-3">
                <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">This contest has closed.</p>
                {entry.submission && (
                  <p className="whitespace-pre-wrap rounded-lg border border-border p-4 text-sm text-foreground">
                    {entry.submission}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
