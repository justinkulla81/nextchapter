import Link from 'next/link'
import {
  BUY_BOOKS,
  BUY_FIELDS,
  BUY_STAGES,
  BUY_TRAINING,
  DILIGENCE_CHECKS,
  MARKETPLACE_KINDS,
  RUN_TRAINING,
  TYPICAL_MULTIPLE_NOTE,
  buyReach,
  hardPartsToPlanFor,
  mediaForStage,
  whyNote,
  getBuyStage,
  missingBuyFields,
  rankFinancing,
  rankMarketplaces,
  type BuyDetails,
  type BuyStageKey,
  type FinancingOption,
  type MediaItem,
  type Marketplace,
  type MarketplaceKind,
  type TrainingItem,
} from '@/lib/journey/buy-business'
import { ShowMore } from '@/components/candidate/ShowMore'
import { ActionSubmit } from '@/components/candidate/ActionSubmit'
import { TrackedAction } from '@/components/candidate/TrackedAction'
import { Chip, H2 } from '@/components/candidate/ui'
import { BuyLink } from '@/components/dashboard/buy/BuyLink'
import { BuyIntakeField } from '@/components/dashboard/buy/BuyIntakeFields'
import { makeBuyMainJourney, saveBuyIntake, setBuyStage } from '@/app/dashboard/buy-a-business/actions'

// The four tabs of the Buy a business page. The page (src/app/dashboard/buy-a-business/page.tsx) loads the member's
// data and picks the tab; the dev preview renders the same components with sample data.

const KIND_ORDER: MarketplaceKind[] = ['marketplace', 'aggregator', 'brokers', 'online', 'community', 'bigger']

// ── Your plan ────────────────────────────────────────────────────────────────

export function PlanTab({ details, stage, started, main, gapsCount }: { details: BuyDetails; stage: BuyStageKey; started: boolean; main: boolean; gapsCount: number }) {
  const s = getBuyStage(stage)
  const reach = buyReach(details)
  const next = missingBuyFields(details).slice(0, 3)
  const why = whyNote(details)
  const hard = hardPartsToPlanFor(details)
  return (
    <div className="space-y-10">
      {!started && (
        <section className="space-y-3 rounded-2xl bg-muted p-5 text-sm text-ink" aria-labelledby="buy-what">
          <p id="buy-what" className="font-semibold">
            What you get
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>The marketplaces, broker networks and communities where small businesses are sold, ordered by what you tell us you want.</li>
            <li>How the financing works (SBA loans, the seller, your retirement money, investors) and what each one needs from you.</li>
            <li>Training for buying well and for running and improving the business after you own it.</li>
          </ul>
          <p className="text-muted-foreground">It runs next to anything else you are doing, including a job search.</p>
        </section>
      )}

      {started && (
        <section className="space-y-4" aria-labelledby="buy-week">
          <div className="flex flex-wrap items-center gap-2">
            <H2 id="buy-week">Start here</H2>
            <Chip tone="ink">{s.label}</Chip>
          </div>
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
          <div className="flex flex-wrap gap-3">
            <TrackedAction href="/dashboard/buy-a-business?tab=find" variant="secondary" event="buy_business_tab_opened" properties={{ tab: 'find', from: 'plan', stage }}>
              Where to find businesses
            </TrackedAction>
            <TrackedAction href="/dashboard/buy-a-business?tab=training" variant="secondary" event="buy_business_tab_opened" properties={{ tab: 'training', from: 'plan', stage }}>
              What to learn first
            </TrackedAction>
          </div>
          {why && (
            <div className="space-y-2 rounded-2xl bg-muted p-5 text-sm text-ink">
              <p className="font-semibold">{why.text}</p>
              <p className="text-muted-foreground">Why you see this: {why.because}</p>
              {why.links.length > 0 && (
                <div className="flex flex-wrap gap-x-5 gap-y-1">
                  {why.links.map((l) => (
                    <TrackedAction key={l.href} href={l.href} variant="text" event="buy_business_resource_clicked" properties={{ kind: 'parallel_income', id: l.href, stage, why: details.why }}>
                      {l.label}
                    </TrackedAction>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <section className="space-y-4" aria-labelledby="buy-profile" id="profile">
        <H2 id="buy-profile">What you are looking for</H2>
        {reach && (
          <div className="space-y-1 rounded-2xl bg-muted p-5 text-sm text-ink">
            <p className="font-semibold">
              Your cash supports a business priced at about ${reach.priceLow.toLocaleString('en-US')} to ${reach.priceHigh.toLocaleString('en-US')}.
            </p>
            <p className="text-muted-foreground">{reach.because}</p>
            <p className="text-muted-foreground">{TYPICAL_MULTIPLE_NOTE}</p>
          </div>
        )}
        {hard.length > 0 && (
          <div className="space-y-3 rounded-2xl border border-border p-5">
            <p className="text-base font-semibold text-ink">Hard parts to plan for</p>
            <p className="text-sm text-muted-foreground">Not a test. Each one you were not sure about gets a reason and a place to learn.</p>
            <ul className="space-y-3">
              {hard.map((h) => (
                <li key={h.key} className="space-y-0.5 text-sm">
                  <p className="font-semibold text-ink">{h.title}</p>
                  <p className="text-muted-foreground">Why: {h.because}</p>
                  {h.learn.href.startsWith('/') ? (
                    <TrackedAction href={h.learn.href} variant="text" event="buy_business_resource_clicked" properties={{ kind: 'hard_part', id: h.key, stage }}>
                      {h.learn.label}
                    </TrackedAction>
                  ) : (
                    <BuyLink href={h.learn.href} kind="training" id={`hard-${h.key}`} stage={stage}>
                      {h.learn.label}
                    </BuyLink>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        {next.length > 0 ? (
          <form action={saveBuyIntake} className="space-y-5">
            <p className="text-sm text-muted-foreground">
              {gapsCount} {gapsCount === 1 ? 'question' : 'questions'} left. Private to you: never shown to employers, recruiters, schools or coaches.
            </p>
            {next.map((f) => (
              <BuyIntakeField key={f.key} field={f} current={details} />
            ))}
            <ActionSubmit pendingLabel="Saving…" event="buy_business_intake_submit_pressed" props={{ stage, questions: next.map((f) => f.key) }}>
              Save my answers
            </ActionSubmit>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">You have answered everything. The marketplaces and financing are ordered for you.</p>
        )}
        <ShowMore label={next.length ? 'Change or add any answer' : 'Change an answer'} event="buy_business_intake_opened" properties={{ stage }}>
          <form action={saveBuyIntake} className="space-y-6">
            {BUY_FIELDS.map((f) => (
              <BuyIntakeField key={f.key} field={f} current={details} />
            ))}
            <ActionSubmit pendingLabel="Saving…" event="buy_business_intake_submit_pressed" props={{ stage, questions: 'all' }}>
              Save my answers
            </ActionSubmit>
          </form>
        </ShowMore>
      </section>

      <ShowMore label="The whole path, and before you sign" event="buy_business_path_opened" properties={{ stage }}>
        <section className="space-y-3" aria-labelledby="buy-path">
          <H2 id="buy-path">From first thought to running it</H2>
          <p className="text-sm text-muted-foreground">Most buyers take six months to a year. Move to another step when you are ready, or go back.</p>
          <ol className="space-y-2">
            {BUY_STAGES.map((st, i) => (
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
                  <form action={setBuyStage}>
                    <input type="hidden" name="stage" value={st.key} />
                    <ActionSubmit variant="secondary" pendingLabel="Moving…" event="buy_business_stage_pressed" props={{ from: stage, to: st.key }}>
                      Move here
                    </ActionSubmit>
                  </form>
                )}
              </li>
            ))}
          </ol>
        </section>
        <section className="space-y-3" aria-labelledby="buy-checks">
          <H2 id="buy-checks">Ask these before you sign anything</H2>
          <ul className="space-y-2">
            {DILIGENCE_CHECKS.map((c) => (
              <li key={c.check} className="rounded-2xl border border-border p-4 text-sm">
                <p className="font-semibold text-ink">{c.check}</p>
                <p className="text-muted-foreground">Why: {c.why}</p>
              </li>
            ))}
          </ul>
        </section>
        {started && !main && (
          <section className="space-y-2 rounded-2xl bg-muted p-5 text-sm text-ink" aria-labelledby="buy-main">
            <p id="buy-main" className="font-semibold">
              Make buying your main plan
            </p>
            <p className="text-muted-foreground">Your weekly plan, menu and emails then follow the steps of the purchase, and the job-search tools wait. You can switch back at any time from Account and privacy.</p>
            <form action={makeBuyMainJourney}>
              <ActionSubmit variant="secondary" pendingLabel="Switching…" event="buy_business_make_main_pressed" props={{ stage }}>
                Make buying my main plan
              </ActionSubmit>
            </form>
          </section>
        )}
      </ShowMore>
    </div>
  )
}

// ── Find businesses ──────────────────────────────────────────────────────────

function fits(m: Marketplace, d: BuyDetails): boolean {
  return !!(m.industries?.some((i) => d.industries?.includes(i)) || (d.size && m.sizes?.includes(d.size)))
}

function MarketRow({ m, d, stage }: { m: Marketplace; d: BuyDetails; stage: BuyStageKey }) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border p-4">
      <div className="max-w-xl space-y-1">
        <p className="flex flex-wrap items-center gap-2 text-base font-semibold text-ink">
          {m.name}
          {fits(m, d) && <Chip tone="good">Fits your answers</Chip>}
        </p>
        <p className="text-sm text-muted-foreground">{m.summary}</p>
      </div>
      <BuyLink href={m.href} kind="marketplace" id={m.id} stage={stage}>
        Open {m.name}
      </BuyLink>
    </li>
  )
}

export function FindTab({ details, stage }: { details: BuyDetails; stage: BuyStageKey }) {
  const ranked = rankMarketplaces(details)
  const top = ranked.slice(0, 4)
  const rest = ranked.slice(4)
  const answered = !!(details.industries?.length || details.size)
  return (
    <div className="space-y-10">
      <section className="space-y-3" aria-labelledby="buy-start">
        <H2 id="buy-start">{answered ? 'Start with these' : 'Start with two marketplaces and a broker'}</H2>
        <p className="text-sm text-muted-foreground">
          {answered ? 'Ordered by the industries and size you chose.' : 'Answer the questions on your plan and we order these for you.'} Set a saved search with alerts, and look at five listings a week.
        </p>
        <ul className="space-y-3">
          {top.map((m) => (
            <MarketRow key={m.id} m={m} d={details} stage={stage} />
          ))}
        </ul>
      </section>
      <section className="space-y-2 rounded-2xl bg-muted p-5 text-sm text-ink" aria-labelledby="buy-direct">
        <p id="buy-direct" className="font-semibold">
          Many of the best businesses are never listed.
        </p>
        <p className="text-muted-foreground">
          Tell two brokers in your area exactly what you want, and write to owners of businesses you would like to own. A short, plain note works. Your free SBDC advisor knows who is selling locally.
        </p>
      </section>
      <ShowMore label="All marketplaces, brokers and communities" event="buy_business_find_all_opened" properties={{ stage }}>
        {KIND_ORDER.map((k) => {
          const rows = rest.filter((m) => m.kind === k)
          if (!rows.length) return null
          return (
            <section key={k} className="space-y-3" aria-labelledby={`buy-kind-${k}`}>
              <H2 id={`buy-kind-${k}`}>{MARKETPLACE_KINDS[k]}</H2>
              <ul className="space-y-3">
                {rows.map((m) => (
                  <MarketRow key={m.id} m={m} d={details} stage={stage} />
                ))}
              </ul>
            </section>
          )
        })}
      </ShowMore>
    </div>
  )
}

// ── Pay for it ───────────────────────────────────────────────────────────────

const PREQUAL_STEPS = [
  'Pull your credit report and fix anything wrong. Lenders look at it first.',
  'Gather your last two to three years of personal tax returns, a list of what you own and owe (SBA lenders use a personal financial statement), and a résumé that shows your experience in the industry.',
  'Talk to two or three SBA lenders, or use the SBA’s lender match. Ask what they would need for a business like the one you want.',
  'When you find a listing, send the lender the numbers before you make an offer.',
]

export function FinancingTab({ details, stage }: { details: BuyDetails; stage: BuyStageKey }) {
  const reach = buyReach(details)
  const options = rankFinancing(details)
  const top = options.slice(0, 3)
  const rest = options.slice(3)
  const picked = (f: FinancingOption) => !!f.intake && !!details.financing?.includes(f.intake)
  return (
    <div className="space-y-10">
      <section className="space-y-3" aria-labelledby="buy-reach">
        <H2 id="buy-reach">What your cash supports</H2>
        {reach ? (
          <div className="space-y-1 rounded-2xl bg-muted p-5 text-sm text-ink">
            <p className="font-semibold">
              About ${reach.priceLow.toLocaleString('en-US')} to ${reach.priceHigh.toLocaleString('en-US')} with an SBA loan.
            </p>
            <p className="text-muted-foreground">{reach.because}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Tell us how much cash you can put in and we show the price range it supports.{' '}
            <Link href="/dashboard/buy-a-business#profile" className="font-medium text-brand underline underline-offset-4">
              Answer the cash question
            </Link>
          </p>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="buy-ways">
        <H2 id="buy-ways">Ways to pay for it</H2>
        <ul className="space-y-3">
          {top.map((f) => (
            <FinancingRow key={f.id} f={f} stage={stage} picked={picked(f)} />
          ))}
        </ul>
      </section>

      <ShowMore label="More ways to pay, and how to get pre-qualified" event="buy_business_financing_more_opened" properties={{ stage }}>
        <ul className="space-y-3">
          {rest.map((f) => (
            <FinancingRow key={f.id} f={f} stage={stage} picked={picked(f)} />
          ))}
        </ul>
        <section className="space-y-3" aria-labelledby="buy-prequal">
          <H2 id="buy-prequal">Get pre-qualified before you make an offer</H2>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-ink">
            {PREQUAL_STEPS.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
          <p className="text-sm text-muted-foreground">Rules change. Confirm every figure with your lender and your CPA before you rely on it.</p>
        </section>
      </ShowMore>
    </div>
  )
}

function FinancingRow({ f, stage, picked }: { f: FinancingOption; stage: BuyStageKey; picked: boolean }) {
  const [first, ...more] = f.facts
  return (
    <li className="space-y-2 rounded-2xl border border-border p-4">
      <p className="flex flex-wrap items-center gap-2 text-base font-semibold text-ink">
        {f.name}
        {picked && <Chip tone="good">You chose this</Chip>}
      </p>
      <p className="text-sm text-ink">{f.summary}</p>
      {first && <p className="text-sm text-muted-foreground">{first}</p>}
      {more.length > 0 && (
        <details className="text-sm text-muted-foreground">
          <summary className="cursor-pointer font-medium text-ink">What to know</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {more.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </details>
      )}
      <div className="flex flex-wrap gap-x-5 gap-y-1">
        {f.links.map((l) => (
          <BuyLink key={l.href} href={l.href} kind="financing" id={f.id} stage={stage}>
            {l.label}
          </BuyLink>
        ))}
      </div>
    </li>
  )
}

// ── Learn ────────────────────────────────────────────────────────────────────

function TrainingRow({ t, now, stage }: { t: TrainingItem; now: boolean; stage: BuyStageKey }) {
  const internal = t.href?.startsWith('/')
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border p-4">
      <div className="max-w-xl space-y-1">
        <p className="flex flex-wrap items-center gap-2 text-base font-semibold text-ink">
          {t.title}
          {now && <Chip tone="warm">Good for now</Chip>}
          {t.free && <Chip>Free</Chip>}
        </p>
        <p className="text-sm text-muted-foreground">{t.summary}</p>
      </div>
      {t.href &&
        (internal ? (
          <TrackedAction href={t.href} variant="text" event="buy_business_resource_clicked" properties={{ kind: 'training', id: t.id, stage }}>
            Open
          </TrackedAction>
        ) : (
          <BuyLink href={t.href} kind="training" id={t.id} stage={stage}>
            Open
          </BuyLink>
        ))}
    </li>
  )
}

export function TrainingTab({ stage }: { stage: BuyStageKey }) {
  return (
    <div className="space-y-10">
      <section className="space-y-3" aria-labelledby="buy-learn-buy">
        <H2 id="buy-learn-buy">Buy it well</H2>
        <p className="text-sm text-muted-foreground">Start with the free help: SBDC advisors and SCORE mentors work with buyers and cost nothing.</p>
        <ul className="space-y-3">
          {BUY_TRAINING.map((t) => (
            <TrainingRow key={t.id} t={t} now={t.stage === stage} stage={stage} />
          ))}
        </ul>
      </section>
      <section className="space-y-3" aria-labelledby="buy-learn-run">
        <H2 id="buy-learn-run">Run it and improve it</H2>
        <ul className="space-y-3">
          {RUN_TRAINING.map((t) => (
            <TrainingRow key={t.id} t={t} now={t.stage === stage} stage={stage} />
          ))}
        </ul>
      </section>
      <section className="space-y-3" aria-labelledby="buy-learn-media">
        <H2 id="buy-learn-media">Podcasts and videos</H2>
        <p className="text-sm text-muted-foreground">Free to listen to. Public shows we link to; we are not affiliated with them. The ones for your stage come first.</p>
        <ul className="space-y-3">
          {mediaForStage(stage).map((m) => (
            <MediaRow key={m.id} m={m} now={m.stage === stage} stage={stage} />
          ))}
        </ul>
      </section>
      <ShowMore label="Books worth reading" event="buy_business_books_opened" properties={{ stage }}>
        <ul className="space-y-3">
          {BUY_BOOKS.map((b) => (
            <li key={b.title} className="rounded-2xl border border-border p-4 text-sm">
              <p className="font-semibold text-ink">
                {b.title} <span className="font-normal text-muted-foreground">by {b.author}</span>
              </p>
              <p className="text-muted-foreground">{b.why}</p>
            </li>
          ))}
        </ul>
        <TrackedAction href="/dashboard/learning" variant="secondary" event="buy_business_resource_clicked" properties={{ kind: 'training', id: 'learn-new-skills', stage }}>
          Learn new skills on NextChapter
        </TrackedAction>
      </ShowMore>
    </div>
  )
}

function MediaRow({ m, now, stage }: { m: MediaItem; now: boolean; stage: BuyStageKey }) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border p-4">
      <div className="max-w-xl space-y-1">
        <p className="flex flex-wrap items-center gap-2 text-base font-semibold text-ink">
          {m.title}
          <Chip>{m.kind === 'podcast' ? 'Podcast' : 'YouTube'}</Chip>
          {now && <Chip tone="warm">Good for now</Chip>}
        </p>
        <p className="text-xs text-muted-foreground">{m.by}</p>
        <p className="text-sm text-muted-foreground">{m.summary}</p>
      </div>
      <BuyLink href={m.href} kind="training" id={m.id} stage={stage}>
        {m.kind === 'podcast' ? 'Listen' : 'Watch'}
      </BuyLink>
    </li>
  )
}
