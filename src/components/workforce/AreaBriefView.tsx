import { showCount } from '@/lib/workforce/area-brief'
import type { AreaBrief } from '@/lib/workforce/area-brief-data'
import { ShowMore } from '@/components/candidate/ShowMore'
import { EmptyNote, FactList, PlainNote, SectionBlock, SourceLine } from '@/components/candidate/Blocks'

function money(n: number): string {
  return n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`
}
function day(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold">{title}</h2>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
      {children}
    </section>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">{children}</p>
}

// The area brief: the anonymous picture of NextChapter members, layoffs, hiring,
// news and (for boards) funding. Members never see funding, which is for
// organizations. Used on the member's local-market page and in the admin preview
// of what a board receives.
export function AreaBriefView({ brief, audience, redesign = false }: { brief: AreaBrief; audience: 'member' | 'board'; redesign?: boolean }) {
  const c = brief.candidates
  const members = (
    <>
      <Section
        title={`NextChapter members in ${brief.candidatesScope === 'area' ? brief.area.name : brief.area.stateName}`}
        note="Counts only, never names. A group smaller than 10 is not shown. People in Confidential Search Mode are not counted at all."
      >
        {c.total === null ? (
          <Empty>Too few members here yet to show anything without pointing at a person.</Empty>
        ) : (
          <>
            <p className="text-sm">
              <span className="font-semibold tabular-nums">{c.total.toLocaleString()}</span> members, and{' '}
              <span className="font-semibold">{showCount(c.landedRecently)}</span> started a new job in the last {c.windowDays} days.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className="text-sm font-medium">Why they are moving</h3>
                <ul className="mt-1 space-y-0.5 text-sm">
                  {c.byJourney.map((x) => (
                    <li key={x.key} className="flex justify-between gap-3">
                      <span>{x.label}</span>
                      <span className="tabular-nums text-muted-foreground">{showCount(x.count)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-medium">Where they are</h3>
                <ul className="mt-1 space-y-0.5 text-sm">
                  {c.byStage.map((x) => (
                    <li key={x.key} className="flex justify-between gap-3">
                      <span>{x.label}</span>
                      <span className="tabular-nums text-muted-foreground">{showCount(x.count)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}
        {audience === 'board' && brief.boardMembers && (
          <p className="text-sm text-muted-foreground">
            Members who told us they work with this board: <span className="font-medium text-foreground">{showCount(brief.boardMembers.connected)}</span>. Of those
            who chose to share it, <span className="font-medium text-foreground">{showCount(brief.boardMembers.foundWork)}</span> found work in the last 90 days.
          </p>
        )}
      </Section>
    </>
  )

  const layoffs = (
    <>
      <Section title="Layoffs filed" note={`Public WARN notices in ${brief.area.stateName}${brief.area.boardId ? ' for this board’s area' : ''}, last ${brief.layoffs.windowDays} days.`}>
        {brief.layoffs.companies.length === 0 ? (
          <Empty>No layoff notices on file for this period.</Empty>
        ) : (
          <>
            <p className="text-sm">
              <span className="font-semibold tabular-nums">{brief.layoffs.totalWorkers.toLocaleString()}</span> workers named across {brief.layoffs.companies.length}{' '}
              {brief.layoffs.companies.length === 1 ? 'employer' : 'employers'}.
            </p>
            <ul className="space-y-0.5 text-sm">
              {brief.layoffs.companies.map((l) => (
                <li key={l.employer} className="flex justify-between gap-3">
                  <span>{l.employer}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {l.workers === null ? 'headcount not given' : `${l.workers.toLocaleString()} workers`} · filed {day(l.latestFiled)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>
    </>
  )

  const hiring = (
    <>
      <Section title="Companies hiring" note="Open roles on the NextChapter job board in this state. Not the whole market.">
        {brief.hiring.openRoles === 0 ? (
          <Empty>No open roles on the NextChapter job board here right now.</Empty>
        ) : (
          <>
            <p className="text-sm">
              <span className="font-semibold tabular-nums">{brief.hiring.openRoles.toLocaleString()}</span> open roles.
            </p>
            <ul className="space-y-0.5 text-sm">
              {brief.hiring.companies.map((h) => (
                <li key={h.name} className="flex justify-between gap-3">
                  <span>{h.name}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {h.roles} {h.roles === 1 ? 'role' : 'roles'}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>
    </>
  )

  const news = (
    <>
      <Section title="News" note="Local articles on layoffs and AI at work.">
        {brief.news.length === 0 ? (
          <Empty>No local articles found yet.</Empty>
        ) : (
          <ul className="space-y-1 text-sm">
            {brief.news.map((n) => (
              <li key={n.url}>
                <a href={n.url} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
                  {n.title}
                </a>
                <span className="text-muted-foreground">
                  {n.publisher ? ` · ${n.publisher}` : ''}
                  {n.publishedAt ? ` · ${day(n.publishedAt)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  )

  if (redesign) {
    // Three short sections: who is hiring, who is cutting, and how other members are doing. Each says what it rests on.
    return (
      <div className="space-y-8">
        <SectionBlock id="area-hiring" title="Companies hiring" why="Open roles on the NextChapter job board in this state. Not the whole market.">
          {brief.hiring.openRoles === 0 ? (
            <EmptyNote>No open roles on the NextChapter job board here right now. Check back, or widen your search on Your market.</EmptyNote>
          ) : (
            <>
              <PlainNote>
                <span className="font-semibold tabular-nums">{brief.hiring.openRoles.toLocaleString()}</span> open roles. These companies have the most.
              </PlainNote>
              <FactList label="Companies hiring" items={brief.hiring.companies.slice(0, 5).map((h) => ({ key: h.name, name: h.name, fact: `${h.roles} ${h.roles === 1 ? 'role' : 'roles'}` }))} />
            </>
          )}
        </SectionBlock>
        <SectionBlock id="area-layoffs" title="Layoffs filed" why={`Public WARN notices in ${brief.area.stateName}${brief.area.boardId ? ' for this board’s area' : ''}, last ${brief.layoffs.windowDays} days. Worth knowing before you apply.`}>
          {brief.layoffs.companies.length === 0 ? (
            <EmptyNote>No layoff notices on file for this period.</EmptyNote>
          ) : (
            <>
              <PlainNote>
                <span className="font-semibold tabular-nums">{brief.layoffs.totalWorkers.toLocaleString()}</span> workers named across {brief.layoffs.companies.length}{' '}
                {brief.layoffs.companies.length === 1 ? 'employer' : 'employers'}.
              </PlainNote>
              <FactList
                label="Layoffs filed"
                items={brief.layoffs.companies.slice(0, 5).map((l) => ({
                  key: l.employer,
                  name: l.employer,
                  fact: `${l.workers === null ? 'headcount not given' : `${l.workers.toLocaleString()} workers`}, filed ${day(l.latestFiled)}`,
                }))}
              />
            </>
          )}
        </SectionBlock>
        <SectionBlock id="area-members" title={`Other members in ${brief.candidatesScope === 'area' ? brief.area.name : brief.area.stateName}`} why="Counts only, never names. A group smaller than 10 is not shown, and people in Confidential Search Mode are not counted.">
          {c.total === null ? (
            <EmptyNote>Too few members here yet to show anything without pointing at a person.</EmptyNote>
          ) : (
            <>
              <PlainNote>
                <span className="font-semibold tabular-nums">{c.total.toLocaleString()}</span> members, and <span className="font-semibold">{showCount(c.landedRecently)}</span> started a new job in the last{' '}
                {c.windowDays} days.
              </PlainNote>
            </>
          )}
        </SectionBlock>
        <ShowMore page="local_market_news" label="Show more about members and local news">
          {c.total !== null && (
            <SectionBlock id="area-members-detail" title="Why members are moving, and where they are">
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-ink">Why they are moving</h3>
                  <FactList label="Why members are moving" items={c.byJourney.map((x) => ({ key: x.key, name: x.label, fact: showCount(x.count) }))} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-ink">Where they are</h3>
                  <FactList label="Where members are" items={c.byStage.map((x) => ({ key: x.key, name: x.label, fact: showCount(x.count) }))} />
                </div>
              </div>
            </SectionBlock>
          )}
          <SectionBlock id="area-news" title="News" why="Local articles on layoffs and AI at work.">
            {brief.news.length === 0 ? (
              <EmptyNote>No local articles found yet.</EmptyNote>
            ) : (
              <ul className="divide-y divide-border">
                {brief.news.map((n) => (
                  <li key={n.url} className="py-3">
                    <a href={n.url} target="_blank" rel="noopener noreferrer" className="text-base font-medium text-brand underline underline-offset-4">
                      {n.title}
                    </a>
                    <SourceLine>
                      {[n.publisher, n.publishedAt ? day(n.publishedAt) : null].filter(Boolean).join(' · ')}
                    </SourceLine>
                  </li>
                ))}
              </ul>
            )}
          </SectionBlock>
        </ShowMore>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {members}
      {layoffs}
      {hiring}
      {news}
      {audience === 'board' && (
        <Section title="Funding a board could apply for" note="Open federal opportunities open to state and local government in this state.">
          {brief.funding.length === 0 ? (
            <Empty>No open opportunities found for this state.</Empty>
          ) : (
            <ul className="space-y-1 text-sm">
              {brief.funding.map((f) => (
                <li key={f.id}>
                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
                    {f.title}
                  </a>
                  <span className="text-muted-foreground">
                    {` · ${f.agency}`}
                    {f.awardCeiling ? ` · up to ${money(f.awardCeiling)}` : ''}
                    {f.closesAt ? ` · closes ${day(f.closesAt)}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}
    </div>
  )
}
