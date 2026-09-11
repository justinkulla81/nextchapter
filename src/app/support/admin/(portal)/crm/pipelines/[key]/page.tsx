import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { CrmStageSelect } from '@/components/admin/CrmStageSelect'
import { qualityClass, formatDate, ELIGIBILITY_LABELS } from '@/lib/crm/labels'

export const maxDuration = 30

function money(min: number | null, max: number | null): string | null {
  const fmt = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M` : `$${Math.round(n / 1000)}K`)
  if (min && max && min !== max) return `${fmt(min)}–${fmt(max)}`
  if (max) return `up to ${fmt(max)}`
  if (min) return fmt(min)
  return null
}

export default async function CrmPipelineBoardPage({ params }: { params: Promise<{ key: string }> }) {
  await requireAdmin()
  const { key } = await params

  const pipeline = await prisma.crmPipeline.findUnique({
    where: { key },
    include: { stages: { orderBy: { sortOrder: 'asc' } } },
  })
  if (!pipeline) notFound()

  const opps = await prisma.crmOpportunity.findMany({
    where: { pipelineId: pipeline.id },
    orderBy: [{ priorityScore: 'desc' }],
    select: {
      id: true, title: true, stageId: true, leadQuality: true, eligibility: true,
      priorityScore: true, priorityOverride: true, amountUsdMin: true, amountUsdMax: true,
      nextStep: true, nextStepDueAt: true, committedFollowUpAt: true,
      org: { select: { id: true, name: true } },
    },
  })

  const stageOptions = pipeline.stages.map((s) => ({ id: s.id, label: s.label }))
  const byStage = new Map(pipeline.stages.map((s) => [s.id, opps.filter((o) => o.stageId === s.id)]))
  const totalOpen = opps.filter((o) => !pipeline.stages.find((s) => s.id === o.stageId)?.isLost).length

  return (
    <div className="space-y-6">
      <nav className="text-sm">
        <Link href="/support/admin/crm/pipelines" className="text-muted-foreground hover:underline">← All pipelines</Link>
      </nav>

      <header>
        <h1 className="text-2xl font-semibold">{pipeline.label}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {totalOpen} open of {opps.length}. Cards are ordered by priority score; change a stage with its dropdown.
        </p>
      </header>

      {opps.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="font-medium">Nothing in this pipeline yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Opportunities arrive from the source import, or you can add one from an organization page.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-3" style={{ minWidth: `${pipeline.stages.length * 260}px` }}>
            {pipeline.stages.map((stage) => {
              const cards = byStage.get(stage.id) ?? []
              return (
                <section key={stage.id} className="w-64 shrink-0">
                  <h2 className="mb-2 flex items-baseline justify-between gap-2 text-sm font-medium">
                    <span className={stage.isWon ? 'text-brand' : stage.isLost ? 'text-muted-foreground' : ''}>
                      {stage.label}
                    </span>
                    <span className="text-xs text-muted-foreground">{cards.length}</span>
                  </h2>
                  <div className="space-y-2">
                    {cards.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                        Empty
                      </p>
                    ) : (
                      cards.map((o) => {
                        const amount = money(o.amountUsdMin, o.amountUsdMax)
                        const score = o.priorityOverride ?? o.priorityScore
                        return (
                          <article key={o.id} className="rounded-lg border border-border p-3">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium leading-snug">
                                {o.org ? (
                                  <Link href={`/support/admin/crm/organizations/${o.org.id}`} className="hover:underline">
                                    {o.org.name}
                                  </Link>
                                ) : o.title}
                              </p>
                              <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-semibold tabular-nums">
                                {Math.round(score)}
                                {o.priorityOverride !== null && <span className="ml-0.5 text-brand">*</span>}
                              </span>
                            </div>
                            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                              <span className={`rounded px-1 py-0.5 font-semibold ${qualityClass(o.leadQuality)}`}>
                                {o.leadQuality === 'UNGRADED' ? '—' : o.leadQuality}
                              </span>
                              {amount && <span className="text-muted-foreground">{amount}</span>}
                              {o.eligibility === 'NONPROFIT_ONLY' && (
                                <span className="text-muted-foreground">{ELIGIBILITY_LABELS.NONPROFIT_ONLY}</span>
                              )}
                            </p>
                            {o.committedFollowUpAt && (
                              <p className="mt-1.5 text-xs font-medium text-orange">
                                Promised by {formatDate(o.committedFollowUpAt)}
                              </p>
                            )}
                            {o.nextStep && (
                              <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{o.nextStep}</p>
                            )}
                            <div className="mt-2">
                              <CrmStageSelect
                                opportunityId={o.id} stageId={o.stageId} stages={stageOptions}
                                label={`Stage for ${o.org?.name ?? o.title}`}
                              />
                            </div>
                          </article>
                        )
                      })
                    )}
                  </div>
                </section>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
