import { prisma } from '@/lib/prisma'
import { CreateShareForm } from '@/components/dashboard/CreateShareForm'
import { CopyLinkButton } from '@/components/dashboard/CopyLinkButton'
import { SubmitButton } from '@/components/ui/submit-button'
import { revokeProfileShare } from '@/app/dashboard/privacy/share-actions'

const RECIPIENT_LABEL: Record<string, string> = {
  HIRING_MANAGER: 'Hiring manager',
  RECRUITER: 'Recruiter',
  COACH: 'Coach',
}

export async function WhatTheySeeSection({ candidateId }: { candidateId: string }) {
  const shares = await prisma.profileShare.findMany({
    where: { candidateId },
    orderBy: { createdAt: 'desc' },
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  return (
    <div className="space-y-4 border-t border-border pt-8">
      <div>
        <h2 className="text-lg font-semibold">What they see</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate a link for a specific hiring manager, recruiter, or coach — you choose exactly
          what it shows, and can revoke it any time. Nothing is visible to anyone until you create
          a link.
        </p>
      </div>

      <CreateShareForm />

      {shares.length > 0 && (
        <div className="space-y-3">
          {shares.map((share) => {
            const isRevoked = !!share.revokedAt
            const isExpired = !isRevoked && share.expiresAt !== null && share.expiresAt < new Date()
            const isActive = !isRevoked && !isExpired
            const url = `${appUrl}/share/${share.token}`

            return (
              <div
                key={share.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">
                    {RECIPIENT_LABEL[share.recipientType]}
                    {share.label && <span className="text-muted-foreground"> — {share.label}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isRevoked
                      ? 'Revoked'
                      : isExpired
                        ? 'Expired'
                        : share.expiresAt
                          ? `Active until ${share.expiresAt.toLocaleDateString()}`
                          : 'Active, no expiration'}
                    {' · '}
                    {share.viewCount === 0
                      ? 'Never viewed'
                      : `Viewed ${share.viewCount} time${share.viewCount === 1 ? '' : 's'}${
                          share.lastViewedAt ? `, last on ${share.lastViewedAt.toLocaleDateString()}` : ''
                        }`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {isActive && (
                    <>
                      <CopyLinkButton url={url} />
                      <form action={revokeProfileShare.bind(null, share.id)}>
                        <SubmitButton variant="ghost" size="sm">
                          Revoke
                        </SubmitButton>
                      </form>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
