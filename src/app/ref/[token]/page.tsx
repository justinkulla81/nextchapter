import { prisma } from '@/lib/prisma'
import { ReferenceSubmissionForm } from '@/components/references/ReferenceSubmissionForm'
import { submitReference } from './actions'
import { REFERENCE_TOKEN_EXPIRY_DAYS } from '@/lib/constants/references'
import { ASSESSMENT_DIMENSIONS } from '@/lib/constants/onboarding'

export default async function ReferenceTokenPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const reference = await prisma.reference.findUnique({
    where: { token },
    include: { candidate: true },
  })

  if (!reference) {
    return (
      <StatusMessage title="This link isn't valid">
        Double check the link your contact sent you, or ask them to resend it.
      </StatusMessage>
    )
  }

  if (reference.status === 'COMPLETED') {
    return (
      <StatusMessage title="Already submitted">
        You&apos;ve already left this reference — thank you for taking the time.
      </StatusMessage>
    )
  }

  const expiresAt = new Date(reference.requestedAt)
  expiresAt.setDate(expiresAt.getDate() + REFERENCE_TOKEN_EXPIRY_DAYS)
  if (new Date() > expiresAt) {
    return (
      <StatusMessage title="This link has expired">
        Reference links are valid for {REFERENCE_TOKEN_EXPIRY_DAYS} days. Ask your contact to send
        a new request.
      </StatusMessage>
    )
  }

  const candidateName = reference.candidate.displayName || 'this candidate'

  const barsAnchors = await prisma.bARSAnchor.findMany({
    where: { isActive: true },
    orderBy: { scalePoint: 'asc' },
  })
  const dimensionGroups = ASSESSMENT_DIMENSIONS.map((dim) => ({
    dimension: dim.key,
    dimensionLabel: dim.label,
    anchors: barsAnchors
      .filter((a) => a.dimension === dim.key)
      .map((a) => ({ scalePoint: a.scalePoint, anchorText: a.anchorText })),
  }))

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="mb-8 space-y-2">
        <p className="text-sm font-medium text-muted-foreground">NextChapter</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Leave a reference for {candidateName}
        </h1>
        <p className="text-muted-foreground">
          This takes about 5 minutes. Employers only ever see a short written summary — never
          your raw ratings.
        </p>
      </div>
      <ReferenceSubmissionForm
        token={token}
        candidateName={candidateName}
        dimensionGroups={dimensionGroups}
        action={submitReference}
      />
    </div>
  )
}

function StatusMessage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-muted-foreground">{children}</p>
    </div>
  )
}
