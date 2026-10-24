import { ActionSubmit } from '@/components/candidate/ActionSubmit'
import { ShowMore } from '@/components/candidate/ShowMore'
import { TrackedAction } from '@/components/candidate/TrackedAction'
import { Chip, H2 } from '@/components/candidate/ui'
import { BuyLink } from '@/components/dashboard/buy/BuyLink'
import { StartIntakeField } from '@/components/dashboard/start/StartIntakeField'
import {
  HELP_GROUP_LABEL,
  SCHOOL_ASKS,
  START_FIELDS,
  START_STAGES,
  getStartStage,
  missingStartFields,
  rankHelp,
  schoolCenterSearch,
  type HelpGroup,
  type HelpItem,
  type StartDetails,
  type StartStageKey,
} from '@/lib/journey/start-business'
import { saveStartIntake, setStartStage } from '@/app/dashboard/start-a-business/actions'

// The tabs of the Start a business page. The page loads the member's data and picks the tab; the dev preview renders the same
// components with sample data.

export function StartPlanTab({
  details,
  stage,
  started,
  schoolName,
  venture,
  runwayMonths,
}: {
  details: StartDetails
  stage: StartStageKey
  started: boolean
  schoolName: string | null
  venture: string | null
  runwayMonths: number | null
}) {
  const s = getStartStage(stage)
  const next = missingStartFields(details).slice(0, 2)
  const search = schoolCenterSearch(schoolName)
  return (
    <div className="space-y-10">
      {!started && (
        <section className="space-y-3 rounded-2xl bg-muted p-5 text-sm text-ink" aria-labelledby="start-what">
          <p id="start-what" className="font-semibold">
            What you get
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Five steps from idea to growth, with one thing to do this week at each.</li>
            <li>Where to get help at each step: your school, free local advisors, incubators and accelerators, and programs for owners.</li>
            <li>Funding that fits a business your size.</li>
          </ul>
          <p className="text-muted-foreground">It runs next to a job or a job search, so you keep your career moving while you build.</p>
        </section>
      )}

      {started && (
        <section className="space-y-4" aria-labelledby="start-week">
          <div className="flex flex-wrap items-center gap-2">
            <H2 id="start-week">Start here</H2>
            <Chip tone="ink">{s.label}</Chip>
          </div>
          <p className="text-sm text-muted-foreground">{s.goal}</p>
          <ol className="space-y-2">
            {s.firstWeek.map((i) => (
              <li key={i.text} className="flex gap-3 rounded-2xl border border-border p-4 text-sm text-ink">
                <span aria-hidden className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  •
                </span>
                <span>{i.text}</span>
              </li>
            ))}
          </ol>
          <TrackedAction href="/dashboard/start-a-business?tab=help" variant="secondary" event="start_business_tab_opened" properties={{ tab: 'help', from: 'plan', stage }}>
            Where to get help at this step
          </TrackedAction>
        </section>
      )}

      <section className="space-y-4" aria-labelledby="start-profile" id="profile">
        <H2 id="start-profile">What you are building</H2>
        {(venture || runwayMonths !== null) && (
          <ul className="space-y-1 text-sm text-ink">
            {venture && (
              <li>
                <span className="font-semibold">Your venture:</span> {venture} <span className="text-muted-foreground">We already have this.</span>
              </li>
            )}
            {runwayMonths !== null && (
              <li>
                <span className="font-semibold">Runway:</span> about {runwayMonths} months <span className="text-muted-foreground">We already have this.</span>
              </li>
            )}
          </ul>
        )}
        {next.length > 0 ? (
          <form action={saveStartIntake} className="space-y-5">
            <p className="text-sm text-muted-foreground">Private to you: never shown to employers, recruiters, schools or coaches.</p>
            {next.map((f) => (
              <StartIntakeField key={f.key} field={f} current={details} />
            ))}
            <ActionSubmit pendingLabel="Saving…" event="start_business_intake_submit_pressed" props={{ stage, questions: next.map((f) => f.key) }}>
              Save my answers
            </ActionSubmit>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">You have answered everything. Help and funding are ordered for you.</p>
        )}
        <ShowMore label="Change an answer" event="start_business_intake_opened" properties={{ stage }}>
          <form action={saveStartIntake} className="space-y-6">
            {START_FIELDS.map((f) => (
              <StartIntakeField key={f.key} field={f} current={details} />
            ))}
            <ActionSubmit pendingLabel="Saving…" event="start_business_intake_submit_pressed" props={{ stage, questions: 'all' }}>
              Save my answers
            </ActionSubmit>
          </form>
        </ShowMore>
      </section>

      <section className="space-y-3" aria-labelledby="start-school">
        <H2 id="start-school">Start with your school</H2>
        <p className="text-sm text-muted-foreground">
          Many schools run an entrepreneurship center, an incubator or a pitch competition, and some open them to alumni. It is often the cheapest help you can get.
        </p>
        <ul className="space-y-2">
          {SCHOOL_ASKS.map((a) => (
            <li key={a.who} className="rounded-2xl border border-border p-4 text-sm">
              <p className="font-semibold text-ink">{a.who}</p>
              <p className="text-muted-foreground">{a.ask}</p>
            </li>
          ))}
        </ul>
        {search ? (
          <BuyLink href={search} kind="start_school" id="school-search" stage={stage}>
            Search for {schoolName}’s entrepreneurship center
          </BuyLink>
        ) : (
          <p className="text-sm text-muted-foreground">
            Add your school and we will build the search for you.{' '}
            <TrackedAction href="/dashboard/early-career#education" variant="text" event="start_business_add_school_clicked" properties={{ stage }}>
              Add your school
            </TrackedAction>
          </p>
        )}
      </section>

      <ShowMore label="All five steps" event="start_business_path_opened" properties={{ stage }}>
        <section className="space-y-3" aria-labelledby="start-path">
          <H2 id="start-path">From idea to growth</H2>
          <ol className="space-y-2">
            {START_STAGES.map((st, i) => (
              <li key={st.key} className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 text-sm ${st.key === stage ? 'border-ink' : 'border-border'}`}>
                <span className="max-w-xl text-ink">
                  <span className="font-semibold">
                    {i + 1}. {st.label}
                  </span>
                  : {st.goal}
                </span>
                {st.key === stage ? (
                  <Chip tone="ink">You are here</Chip>
                ) : (
                  <form action={setStartStage}>
                    <input type="hidden" name="stage" value={st.key} />
                    <ActionSubmit variant="secondary" pendingLabel="Moving…" event="start_business_stage_pressed" props={{ from: stage, to: st.key }}>
                      Move here
                    </ActionSubmit>
                  </form>
                )}
              </li>
            ))}
          </ol>
        </section>
      </ShowMore>
    </div>
  )
}

function HelpRow({ h, stage }: { h: HelpItem; stage: StartStageKey }) {
  const internal = h.href.startsWith('/')
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border p-4">
      <div className="max-w-xl space-y-1">
        <p className="flex flex-wrap items-center gap-2 text-base font-semibold text-ink">
          {h.name}
          {h.stages.includes(stage) && <Chip tone="warm">Good for now</Chip>}
        </p>
        <p className="text-sm text-muted-foreground">{h.summary}</p>
      </div>
      {internal ? (
        <TrackedAction href={h.href} variant="text" event="start_business_resource_clicked" properties={{ kind: `start_${h.group}`, id: h.id, stage }}>
          Open
        </TrackedAction>
      ) : (
        <BuyLink href={h.href} kind={`start_${h.group}`} id={h.id} stage={stage}>
          Open
        </BuyLink>
      )}
    </li>
  )
}

const GROUPS: HelpGroup[] = ['school', 'local', 'accelerators', 'owners']

export function StartHelpTab({ details, stage }: { details: StartDetails; stage: StartStageKey }) {
  const ranked = rankHelp(details)
  const group = (g: HelpGroup) => ranked.filter((h) => h.group === g)
  const [first, ...rest] = GROUPS
  return (
    <div className="space-y-10">
      <section className="space-y-3" aria-labelledby="help-first">
        <H2 id="help-first">{HELP_GROUP_LABEL.local}</H2>
        <p className="text-sm text-muted-foreground">Start here. It costs little or nothing, and the people have helped hundreds of founders. Public programs we link to; we are not affiliated with any of them.</p>
        <ul className="space-y-3">
          {group('local').map((h) => (
            <HelpRow key={h.id} h={h} stage={stage} />
          ))}
        </ul>
      </section>
      <section className="space-y-3" aria-labelledby="help-school">
        <H2 id="help-school">{HELP_GROUP_LABEL[first]}</H2>
        <ul className="space-y-3">
          {group(first).map((h) => (
            <HelpRow key={h.id} h={h} stage={stage} />
          ))}
        </ul>
        <TrackedAction href="/dashboard/start-a-business" variant="text" event="start_business_tab_opened" properties={{ tab: 'plan', from: 'help', stage }}>
          How to ask your school
        </TrackedAction>
      </section>
      <ShowMore label="Incubators, accelerators and programs for owners" event="start_business_help_more_opened" properties={{ stage }}>
        {rest
          .filter((g) => g !== 'local')
          .map((g) => (
            <section key={g} className="space-y-3" aria-labelledby={`help-${g}`}>
              <H2 id={`help-${g}`}>{HELP_GROUP_LABEL[g]}</H2>
              <ul className="space-y-3">
                {group(g).map((h) => (
                  <HelpRow key={h.id} h={h} stage={stage} />
                ))}
              </ul>
            </section>
          ))}
      </ShowMore>
    </div>
  )
}

export function StartFundingTab({ details, stage }: { details: StartDetails; stage: StartStageKey }) {
  const items = rankHelp(details).filter((h) => h.group === 'funding')
  return (
    <div className="space-y-10">
      <section className="space-y-3" aria-labelledby="fund-main">
        <H2 id="fund-main">{HELP_GROUP_LABEL.funding}</H2>
        <p className="text-sm text-muted-foreground">
          Most new businesses start with savings and first customers, not outside money. Investors and accelerators suit fast-growth technology companies; for most others, a small loan, a grant or a competition fits better.
        </p>
        <ul className="space-y-3">
          {items.map((h) => (
            <HelpRow key={h.id} h={h} stage={stage} />
          ))}
        </ul>
      </section>
      <section className="space-y-2 rounded-2xl bg-muted p-5 text-sm text-ink" aria-labelledby="fund-why">
        <p id="fund-why" className="font-semibold">
          Check the rules before you rely on any of this.
        </p>
        <p className="text-muted-foreground">Programs change and each has its own eligibility. Confirm with the program and with a free SBDC advisor.</p>
      </section>
    </div>
  )
}
