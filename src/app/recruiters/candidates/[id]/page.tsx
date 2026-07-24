import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { InviteSourcedCandidateButton } from '@/components/recruiter/InviteSourcedCandidateButton'

const STATUS_LABEL = {
  ADDED: 'Not yet invited',
  INVITED: 'Invite pending',
  SIGNED_UP: 'Joined NextChapter',
  ALREADY_HAD_ACCOUNT: 'Already has an account',
} as const

export default async function SourcedCandidateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const recruiter = await prisma.recruiter.findUnique({ where: { userId: user.id } })
  if (!recruiter) redirect('/recruiters/signup')

  const candidate = await prisma.sourcedCandidate.findUnique({ where: { id } })
  if (!candidate || candidate.recruiterId !== recruiter.id) notFound()

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-6 py-16">
      <div>
        <Link href="/recruiters/candidates" className="text-sm text-muted-foreground underline underline-offset-4">
          ← Back to my candidates
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{candidate.name}</h1>
        <p className="mt-1 text-muted-foreground">{candidate.email}</p>
      </div>

      <div className="rounded-lg border border-border p-4">
        <p className="text-sm font-medium text-foreground">Status</p>
        <p className="mt-1 text-sm text-muted-foreground">{STATUS_LABEL[candidate.status]}</p>
      </div>

      {candidate.notes && (
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm font-medium text-foreground">Notes</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{candidate.notes}</p>
        </div>
      )}

      {candidate.status !== 'SIGNED_UP' && candidate.status !== 'ALREADY_HAD_ACCOUNT' && (
        <InviteSourcedCandidateButton candidateId={candidate.id} alreadyInvited={candidate.status === 'INVITED'} />
      )}
    </div>
  )
}
