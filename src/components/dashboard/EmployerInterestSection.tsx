import { prisma } from '@/lib/prisma'
import { SubmitButton } from '@/components/ui/submit-button'
import { approveEmployerInterest, declineEmployerInterest } from '@/app/dashboard/actions-employer-interest'

export async function EmployerInterestSection({ candidateId }: { candidateId: string }) {
  const interactions = await prisma.candidateInteraction.findMany({
    where: { candidateId, status: 'INTEREST_EXPRESSED' },
    include: { employer: { select: { companyName: true } } },
    orderBy: { updatedAt: 'desc' },
  })

  if (interactions.length === 0) return null

  return (
    <div className="space-y-3 rounded-lg border border-brand/30 bg-brand/5 p-4">
      <h2 className="text-sm font-medium text-foreground">Employer interest</h2>
      {interactions.map((interaction) => (
        <div key={interaction.id} className="space-y-2 rounded-md border border-border bg-background p-3">
          <p className="text-sm text-foreground">
            <span className="font-medium">{interaction.employer.companyName}</span> is interested in
            your profile.
          </p>
          <p className="text-xs text-muted-foreground">
            This lets {interaction.employer.companyName} see your name and full work history.
          </p>
          <div className="flex gap-2">
            <form action={approveEmployerInterest.bind(null, interaction.id)}>
              <SubmitButton size="sm">Approve</SubmitButton>
            </form>
            <form action={declineEmployerInterest.bind(null, interaction.id)}>
              <SubmitButton size="sm" variant="ghost">
                Decline
              </SubmitButton>
            </form>
          </div>
        </div>
      ))}
    </div>
  )
}
