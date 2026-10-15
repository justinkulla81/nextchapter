import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BadgeCheck } from 'lucide-react'
import { credentialById } from '@/lib/higher-ed/programs'

export const metadata: Metadata = { robots: { index: false, follow: false } }

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

// The public verification page for a program credential. Anyone with the
// link (an employer, LinkedIn) can confirm it's real; the machine-readable
// Open Badges assertion is at /api/credentials/<id>.
export default async function CredentialPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const c = await credentialById(id)
  if (!c || c.status !== 'COMPLETED' || !c.completedAt) notFound()
  const program = c.cohort.program
  const college = program.institution
  const name = [c.member.firstName, c.member.lastName].filter(Boolean).join(' ')
  const issued = c.completedAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
  const linkedIn = new URL('https://www.linkedin.com/profile/add')
  linkedIn.searchParams.set('startTask', 'CERTIFICATION_NAME')
  linkedIn.searchParams.set('name', c.credentialName ?? program.name)
  linkedIn.searchParams.set('organizationName', college.name)
  linkedIn.searchParams.set('issueYear', String(c.completedAt.getUTCFullYear()))
  linkedIn.searchParams.set('issueMonth', String(c.completedAt.getUTCMonth() + 1))
  linkedIn.searchParams.set('certUrl', `${appUrl()}/credentials/${id}`)
  linkedIn.searchParams.set('certId', id)
  return (
    <main className="mx-auto max-w-xl space-y-6 bg-background px-4 py-12">
      <div className="space-y-4 rounded-xl border border-border bg-card p-8 text-center">
        <BadgeCheck className="mx-auto size-12 text-primary" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">Verified credential</p>
        <h1 className="text-2xl font-semibold tracking-tight">{c.credentialName ?? program.name}</h1>
        <p>
          Awarded to <span className="font-medium">{name || 'the holder'}</span> by {college.name}
        </p>
        <p className="text-sm text-muted-foreground">
          Completed {program.name} ({c.cohort.name}) on {issued}
        </p>
        {program.skills.length > 0 && <p className="text-sm text-muted-foreground">Skills: {program.skills.join(', ')}</p>}
      </div>
      <div className="flex flex-wrap justify-center gap-3 text-sm">
        <a href={linkedIn.toString()} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
          Add to LinkedIn
        </a>
        <a href={`/api/credentials/${id}`} className="text-muted-foreground hover:underline">
          Open Badges data
        </a>
      </div>
      <p className="text-center text-xs text-muted-foreground">Credential ID {id} · powered by NextChapter</p>
    </main>
  )
}
