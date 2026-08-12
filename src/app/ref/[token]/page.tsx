import { prisma } from '@/lib/prisma'
import { ReferenceSubmissionForm } from '@/components/references/ReferenceSubmissionForm'
import { submitReference, saveReferenceDraft } from './actions'
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
  const dimensionGroups = ASSESSMENT_DIMENSIONS.map((dim) => {
    // Some dimensions have more than one active anchor row seeded for the
    // same scalePoint (a content duplication, not intentional) — keep only
    // the first so the rater sees exactly one description per number
    // instead of two competing phrasings.
    const seenScalePoints = new Set<number>()
    const anchors = barsAnchors
      .filter((a) => a.dimension === dim.key)
      .filter((a) => {
        if (seenScalePoints.has(a.scalePoint)) return false
        seenScalePoints.add(a.scalePoint)
        return true
      })
      .map((a) => ({ scalePoint: a.scalePoint, anchorText: a.anchorText }))
    return { dimension: dim.key, dimensionLabel: dim.label, anchors }
  })

  const isManager = reference.relationshipType === 'DIRECT_MANAGER' || reference.relationshipType === 'SKIP_LEVEL_MANAGER'
  const writtenQuestions =
    reference.writtenQuestion1Key && reference.writtenQuestion1Text
      ? [
          { key: reference.writtenQuestion1Key, text: reference.writtenQuestion1Text },
          ...(reference.writtenQuestion2Key && reference.writtenQuestion2Text
            ? [{ key: reference.writtenQuestion2Key, text: reference.writtenQuestion2Text }]
            : []),
        ]
      : undefined

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="mb-8 space-y-2">
        <p className="text-sm font-medium text-muted-foreground">NextChapter</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Leave a reference for {candidateName}
        </h1>
        <p className="text-muted-foreground">
          Thank you for taking the time to do this for {candidateName}
          {' '}— it makes a real difference. This takes about 15 minutes, and your answers save as
          you go, so it&apos;s fine to finish it in more than one sitting. Employers only ever see
          a short written summary — never your raw ratings.
        </p>
      </div>
      <ReferenceSubmissionForm
        token={token}
        candidateName={candidateName}
        dimensionGroups={dimensionGroups}
        action={submitReference}
        isManager={isManager}
        writtenQuestions={writtenQuestions}
        verification={{
          claimedTitle: reference.refereeTitle,
          claimedYearsTogether: reference.yearsWorkedTogether,
        }}
        initialAnswers={(reference.draftAnswers as Record<string, string> | null) ?? undefined}
        initialPage={reference.draftPage ?? undefined}
        onSaveDraft={saveReferenceDraft.bind(null, token)}
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
