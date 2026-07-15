import { prisma } from '@/lib/prisma'
import { getCoachClientSummaries } from '@/lib/coach/client-summary'
import { GRADE_LABEL } from '@/lib/scoring/grade'

const TREND_LABEL: Record<string, string> = {
  up: '↑ improving',
  down: '↓ declining',
  flat: '→ steady',
}

export default async function CoachClientsPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const coach = await prisma.coach.findUnique({ where: { accessToken: token } })

  if (!coach) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="text-xl font-semibold tracking-tight">This link isn&apos;t valid</h1>
        <p className="mt-2 text-muted-foreground">Double check the link you were sent.</p>
      </div>
    )
  }

  const clients = await getCoachClientSummaries(coach.id)
  const clientProfiles = await prisma.candidateProfile.findMany({
    where: { coachId: coach.id },
    select: {
      id: true,
      targetRoleType: true,
      primaryFunction: true,
      highestLevelReached: true,
      targetIndustries: true,
    },
  })
  const profileById = new Map(clientProfiles.map((p) => [p.id, p]))

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-8 space-y-2">
        <p className="text-sm font-medium text-muted-foreground">NextChapter for Coaches</p>
        <h1 className="text-2xl font-semibold tracking-tight">Your clients</h1>
        <p className="text-muted-foreground">
          {clients.length === 0
            ? 'No clients yet — share your invite link to get started.'
            : `${clients.length} client${clients.length === 1 ? '' : 's'} on NextChapter.`}
        </p>
      </div>

      <div className="space-y-3">
        {clients.map((client) => {
          const detail = profileById.get(client.id)
          return (
            <details key={client.id} className="rounded-lg border border-border p-4">
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">{client.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {client.weekNumber !== null ? `Week ${client.weekNumber}` : 'Not yet registered'}
                    {client.lastActiveAt && ` · Last active ${client.lastActiveAt.toLocaleDateString()}`}
                  </p>
                </div>
                <div className="text-right text-sm">
                  {client.executionGrade ? (
                    <p className="font-medium text-foreground">
                      {client.executionGrade}{' '}
                      <span className="text-muted-foreground">
                        ({GRADE_LABEL[client.executionGrade]})
                      </span>
                    </p>
                  ) : (
                    <p className="text-muted-foreground">No grade yet</p>
                  )}
                  {client.trend && (
                    <p className="text-xs text-muted-foreground">{TREND_LABEL[client.trend]}</p>
                  )}
                </div>
              </summary>
              <div className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">
                {detail?.targetRoleType && <p>Targeting: {detail.targetRoleType}</p>}
                {detail?.primaryFunction && <p>Function: {detail.primaryFunction}</p>}
                {detail?.highestLevelReached && <p>Level: {detail.highestLevelReached}</p>}
                {detail && detail.targetIndustries.length > 0 && (
                  <p>Industries: {detail.targetIndustries.join(', ')}</p>
                )}
                {!detail?.targetRoleType && !detail?.primaryFunction && !detail?.highestLevelReached && (
                  <p>Profile still being built out.</p>
                )}
              </div>
            </details>
          )
        })}
      </div>
    </div>
  )
}
