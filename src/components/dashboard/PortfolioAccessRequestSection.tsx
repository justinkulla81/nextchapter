import { prisma } from '@/lib/prisma'
import { SubmitButton } from '@/components/ui/submit-button'
import { approvePortfolioAccessRequest, declinePortfolioAccessRequest } from '@/app/dashboard/actions-portfolio-access'

export async function PortfolioAccessRequestSection({ candidateId }: { candidateId: string }) {
  const requests = await prisma.portfolioAccessRequest.findMany({
    where: { candidateId, status: 'REQUESTED' },
    include: { recruiter: { select: { fullName: true, firmName: true } } },
    orderBy: { requestedAt: 'desc' },
  })

  if (requests.length === 0) return null

  return (
    <div className="space-y-3 rounded-lg border border-brand/30 bg-brand/5 p-4">
      <h2 className="text-sm font-medium text-foreground">Portfolio access requests</h2>
      {requests.map((request) => (
        <div key={request.id} className="space-y-2 rounded-md border border-border bg-background p-3">
          <p className="text-sm text-foreground">
            <span className="font-medium">{request.recruiter.fullName}</span>
            {request.recruiter.firmName ? ` at ${request.recruiter.firmName}` : ''} would like to see
            your Portfolio.
          </p>
          <p className="text-xs text-muted-foreground">
            They can already see your Executive Dossier and resume. This lets them see your work
            samples and narrative too.
          </p>
          <div className="flex gap-2">
            <form action={approvePortfolioAccessRequest.bind(null, request.id)}>
              <SubmitButton size="sm">Approve</SubmitButton>
            </form>
            <form action={declinePortfolioAccessRequest.bind(null, request.id)}>
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
