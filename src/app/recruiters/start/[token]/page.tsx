import Link from 'next/link'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { findClaimableFirm } from '@/lib/recruiter/firm-invite'
import { SubmitButton } from '@/components/ui/submit-button'
import { claimFirmAction } from './actions'

export const metadata: Metadata = { title: 'Set up your firm on NextChapter', robots: { index: false, follow: false } }

const STEPS = [
  ['Your firm', 'Confirm your name and website.'],
  ['Your look', 'Add your logo, color and font so candidates see your brand.'],
  ['Your website', 'Copy one button and one link onto your site.'],
  ['Your tools', 'Send new resumes to your ATS, CRM or Zapier.'],
  ['Your team', 'Invite your recruiters.'],
] as const

export default async function StartFirmPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const firm = await findClaimableFirm(token)

  if (!firm) {
    const used = await prisma.recruiterFirm.findUnique({ where: { onboardingToken: token }, select: { name: true } })
    return (
      <main className="mx-auto max-w-lg space-y-4 px-6 py-16">
        <p className="text-sm font-medium text-muted-foreground">NextChapter for Recruiters</p>
        <h1 className="text-2xl font-semibold tracking-tight">{used ? `${used.name} is already set up` : 'This link is no longer active'}</h1>
        <p className="text-muted-foreground">
          {used ? 'Someone has registered this firm. Ask them to invite you, or log in.' : 'Ask the person who sent it for a new one.'}
        </p>
        <Link href="/recruiters/login" className="text-sm font-medium text-primary underline underline-offset-4">Log in</Link>
      </main>
    )
  }

  const supabase = await createClient('recruiter')
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const recruiter = user ? await prisma.recruiter.findUnique({ where: { userId: user.id }, select: { id: true, firmRole: true } }) : null
  const signedIn = !!recruiter && !recruiter.firmRole

  return (
    <main className="mx-auto max-w-lg space-y-6 px-6 py-16">
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">NextChapter for Recruiters</p>
        <h1 className="text-3xl font-semibold tracking-tight">Set up {firm.name}</h1>
        <p className="text-muted-foreground">
          A page on your website where candidates send you resumes, in your brand, with every resume routed to the right
          recruiter. About 10 minutes.
        </p>
      </div>
      <ol className="space-y-2 rounded-lg border border-border p-4 text-sm">
        {STEPS.map(([title, text], i) => (
          <li key={title} className="flex gap-3">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">{i + 1}</span>
            <span><span className="font-medium">{title}.</span> <span className="text-muted-foreground">{text}</span></span>
          </li>
        ))}
      </ol>
      {signedIn ? (
        <form action={claimFirmAction.bind(null, token)}>
          <SubmitButton pendingLabel="Setting up…">Start setting up {firm.name}</SubmitButton>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href={`/recruiters/signup?firm=${encodeURIComponent(token)}`}
            className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground"
          >
            Create my login
          </Link>
          <Link href={`/recruiters/login?next=${encodeURIComponent(`/recruiters/start/${token}`)}`} className="text-sm text-primary underline underline-offset-4">
            I already have a login
          </Link>
        </div>
      )}
    </main>
  )
}
