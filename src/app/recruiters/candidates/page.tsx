import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { AddSourcedCandidateForm } from '@/components/recruiter/AddSourcedCandidateForm'

const STATUS_LABEL = {
  ADDED: 'Not yet invited',
  INVITED: 'Invite pending',
  SIGNED_UP: 'Joined NextChapter',
  ALREADY_HAD_ACCOUNT: 'Already has an account',
} as const

export default async function RecruiterCandidatesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const recruiter = await prisma.recruiter.findUnique({ where: { userId: user.id } })
  if (!recruiter) redirect('/recruiters/signup')

  const sourced = await prisma.sourcedCandidate.findMany({
    where: { recruiterId: recruiter.id },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-6 py-16">
      <div>
        <Link href="/recruiters/dashboard" className="text-sm text-muted-foreground underline underline-offset-4">
          ← Back home
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">My candidates</h1>
        <p className="mt-1 text-muted-foreground">
          Add people from your own network who aren&apos;t on NextChapter yet. Once you invite them and they
          sign up, they get the full onboarding experience and join the general candidate pool — you&apos;ll
          just be recorded as who sourced them.
        </p>
      </div>

      <AddSourcedCandidateForm />

      <div className="divide-y divide-border rounded-lg border border-border">
        {sourced.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No candidates added yet.</p>
        ) : (
          sourced.map((candidate) => (
            <Link
              key={candidate.id}
              href={`/recruiters/candidates/${candidate.id}`}
              className="flex items-center justify-between gap-4 p-4 hover:bg-muted"
            >
              <div>
                <p className="font-medium text-foreground">{candidate.name}</p>
                <p className="text-sm text-muted-foreground">{candidate.email}</p>
              </div>
              <span className="text-xs text-muted-foreground">{STATUS_LABEL[candidate.status]}</span>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
