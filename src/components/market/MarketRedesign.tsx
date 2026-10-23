import { stateName } from '@/lib/pivots/scoring'
import { AiAtWorkBlock, AI_AT_WORK_TITLE } from '@/components/candidate/AiAtWork'
import type { AiAtWork } from '@/lib/skills/ai-at-work'
import type { AddressableMarket } from '@/lib/profile/addressable-market'
import { ExpansionToggle } from '@/components/dashboard/ExpansionToggle'
import { marketHeadline } from '@/lib/redesign/jobs-pages'
import { PageHeader } from '@/components/candidate/PageHeader'
import { ShowMore } from '@/components/candidate/ShowMore'
import { ActionLink } from '@/components/candidate/ActionLink'
import { RowList, type RowItem } from '@/components/candidate/RowList'
import { SeeAllLink } from '@/components/candidate/SeeAllLink'
import { EmptyNote, Figures, PlainNote, SectionBlock, VerdictPanel } from '@/components/candidate/Blocks'

const n = (x: number) => x.toLocaleString()

// Your market in the redesign: one verdict that sizes the market and says what it rests on, three ways to widen it,
// one thing worth knowing, and everything else behind "Show more". Used by the page and by the dev-preview.
export function MarketRedesign({ m, aiAtWork = null }: { m: AddressableMarket; aiAtWork?: AiAtWork | null }) {
  const places = m.expansions.filter((e) => e.kind === 'remote' || e.kind === 'state' || e.kind === 'relocate')
  const roles = m.expansions.filter((e) => e.kind === 'role')
  const industries = m.expansions.filter((e) => e.kind === 'industry')
  const { headline, because } = marketHeadline(m)
  // Three ways to widen, best first: each is one switch that adds jobs to the search. Nothing is added unless chosen.
  const widen = [...places.slice(0, 1), ...roles.slice(0, 1), ...industries.slice(0, 1)]
  // The old "AI is reshaping this work" flag is replaced by the measured AI block, so the page never says both.
  const flags = m.flags.filter((f) => f.key !== 'ai')
  // With the AI block on the first view, the first flag moves behind "Show more" so the page stays at three sections.
  const firstFlag = aiAtWork ? undefined : flags[0]
  const moreFlags = aiAtWork ? flags : flags.slice(1)
  const toggleFor = (e: (typeof m.expansions)[number]) => (
    <ExpansionToggle
      quiet
      kind={e.kind}
      value={e.kind === 'state' ? e.state : e.kind === 'role' ? e.role : e.kind === 'industry' ? e.industry : e.kind}
      on={e.kind === 'state' ? m.optedIn.states.includes(e.state) : e.kind === 'remote' ? m.optedIn.remote : e.kind === 'role' ? m.optedIn.roles.includes(e.role) : false}
      label={e.label}
    />
  )
  const expansionRow = (e: (typeof m.expansions)[number]): RowItem => ({
    key: e.kind + e.label,
    title: e.label,
    why: e.open !== null && e.open !== undefined ? `${n(e.open)} more open roles.` : 'More open roles.',
    fact: e.kind === 'role' && e.carry.length > 0 ? `Your ${e.carry.slice(0, 2).join(' and ')} carry over.` : undefined,
    actions: toggleFor(e),
  })
  // Everything else, in plain rows: no card chrome, one reason and one switch per row.
  const everyOption = (
    <>
      {moreFlags.length > 0 && (
        <SectionBlock id="more-flags-h" title="Also worth knowing">
          <ul className="space-y-2">
            {moreFlags.map((f) => (
              <li key={f.key}>
                <PlainNote>
                  <span className="font-semibold">{f.title}.</span> {f.detail}
                </PlainNote>
              </li>
            ))}
          </ul>
        </SectionBlock>
      )}
      {(places.length > 0 || m.optedIn.states.length > 0) && (
        <SectionBlock id="places-h" title="More places" why="Add a place and its jobs show up in Find a job and your daily email.">
          <RowList
            label="More places"
            items={[
              ...places.map(expansionRow),
              ...m.optedIn.states
                .filter((s) => !places.some((p) => p.kind === 'state' && p.state === s))
                .map((s): RowItem => ({ key: `opted-${s}`, title: `Jobs in ${stateName(s)}`, actions: <ExpansionToggle quiet kind="state" value={s} on label={`Jobs in ${stateName(s)}`} /> })),
            ]}
          />
        </SectionBlock>
      )}
      {roles.length > 0 && (
        <SectionBlock id="roles-h" title="Bigger markets for your skills" why="Roles that use what you already do. Add one and its jobs show up in Find a job.">
          <RowList label="Roles" items={roles.map(expansionRow)} />
          <SeeAllLink href="/dashboard/pivot-paths">See every pivot path with its skills</SeeAllLink>
        </SectionBlock>
      )}
      {(industries.length > 0 || m.optedIn.industries.length > 0) && (
        <SectionBlock
          id="ind-h"
          title={`Other industries hiring ${m.role?.label.toLowerCase() ?? 'your role'}`}
          why="Open roles like yours in industries you have not targeted, in the places you are searching."
        >
          <RowList
            label="Industries"
            items={[
              ...industries.map(expansionRow),
              ...m.optedIn.industries.map((i): RowItem => ({ key: `opted-${i}`, title: i, actions: <ExpansionToggle quiet kind="industry" value={i} on label={i} /> })),
            ]}
          />
        </SectionBlock>
      )}
    </>
  )
  return (
    <div className="space-y-8">
      <PageHeader
        title="Your market"
        intro="How many jobs fit you, and the quickest ways to see more. Nothing is added to your search unless you add it."
        action={
          m.role ? (
            <ActionLink href="/dashboard/find-my-job" kind="primary" event="market_see_jobs_clicked" props={{ source: 'market', marketReady: m.marketReady }}>
              See the jobs that fit you
            </ActionLink>
          ) : (
            <ActionLink href="/dashboard/search-strategy" kind="primary" event="market_add_role_clicked" props={{ source: 'market' }}>
              Add your role
            </ActionLink>
          )
        }
      />
      {!m.role ? (
        <EmptyNote>Tell us your current or target role and we will count the jobs that fit you, and say what that number rests on.</EmptyNote>
      ) : (
        <>
          <VerdictPanel id="size-h" title={headline} because={`${m.role.label}, at your level. ${because}`}>
            {m.marketReady && (
              <Figures
                label="Jobs that fit you"
                items={[
                  ...(m.local !== null ? [{ value: n(m.local), label: `Open now in ${m.placeLabel}` }] : []),
                  { value: n(m.remote), label: 'Remote' },
                  { value: n(m.national), label: 'Nationally' },
                ]}
              />
            )}
          </VerdictPanel>

          {widen.length > 0 && (
            <SectionBlock id="widen-h" title="Where you could widen" why="Each switch adds that group of jobs to your search. Turn it off any time.">
              <RowList label="Ways to widen" items={widen.map(expansionRow)} />
            </SectionBlock>
          )}

          {firstFlag && (
            <SectionBlock id="know-h" title="Good to know">
              <PlainNote>
                <span className="font-semibold">{firstFlag.title}.</span> {firstFlag.detail}
              </PlainNote>
            </SectionBlock>
          )}
          {aiAtWork && (
            <SectionBlock id="ai-h" title={AI_AT_WORK_TITLE} why="How much AI is already used for the tasks in your occupation, and in the openings we see for your field.">
              <AiAtWorkBlock data={aiAtWork} surface="market" heading={false} />
            </SectionBlock>
          )}
        </>
      )}
      {m.role && (
        <ShowMore page="market" label="Show every place, role and industry">
          {everyOption}
        </ShowMore>
      )}
    </div>
  )
}
