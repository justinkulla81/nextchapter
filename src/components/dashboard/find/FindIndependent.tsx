import type { ReactNode } from 'react'
import Link from 'next/link'
import { Check } from 'lucide-react'
import type { WorkHistoryEntry } from '@prisma/client'
import { ActionLink } from '@/components/candidate/ActionLink'
import { ShowMore } from '@/components/candidate/ShowMore'
import { Section } from '@/components/candidate/ui'
import { DisclosureCard } from '@/components/dashboard/find/DisclosureCard'
import { InterimLaunchPlanTracker } from '@/components/dashboard/InterimLaunchPlanTracker'
import { InterimListingGrid } from '@/components/dashboard/InterimListingGrid'
import { InterimListingCarousel } from '@/components/dashboard/InterimListingCarousel'
import { InterimOfferDefinitionForm } from '@/components/dashboard/InterimOfferDefinitionForm'
import { GigDirectoryUnlockForm } from '@/components/dashboard/GigDirectoryUnlockForm'
import { WorkHistoryForm } from '@/components/dashboard/WorkHistoryForm'
import { WorkHistoryList } from '@/components/dashboard/WorkHistoryList'
import { TierSummaryCard } from '@/components/dashboard/TierSummaryCard'
import { PlatformActivityPanel } from '@/components/dashboard/platforms/PlatformActivityPanel'
import { SubmitButton } from '@/components/ui/submit-button'
import { setBoardDiversityListingsOptIn, markInterimMarketplaceSignup, answerBoardAdvisoryWillingness, markInterimOutreachStarted } from '@/app/dashboard/interim-work/actions'
import { signupCountToTier } from '@/lib/interim-work/signup-count-tier'
import { launchProgressLine, launchSteps, nextLaunchPhase, sourceCards, summarizeSignups } from '@/lib/jobs/find-independent'
import type { IndependentWorkData } from '@/lib/interim-work/independent-work-data'
import { cn } from '@/lib/utils'

// "Independent work" in the redesign (mockup: dev-preview/_mockups/jobs-more.tsx FindIndependent). First view: the
// launch plan with its ONE next step, where independent work comes from, and where the member has signed up. The full
// launch plan, work log, platform activity from email and the rest sit behind "Show more". Nothing from the live
// toolkit is removed. Data is loaded on the server (loadIndependentWork) and passed in.

function SignupBreakdown({ names }: { names: string[] }) {
  return (
    <ul className="space-y-1 text-sm text-foreground">
      {names.map((n) => (
        <li key={n}>{n}</li>
      ))}
    </ul>
  )
}

function ListingsEmpty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>
}

export function FindIndependent({
  data,
  unlocked,
  boardAdvisoryWillingness,
  boardDiversityOptIn,
  workHistory,
  headerBoxes,
}: {
  data: IndependentWorkData
  /** The member has set a rate target, which opens the directories. */
  unlocked: boolean
  boardAdvisoryWillingness: boolean | null
  boardDiversityOptIn: boolean | null
  workHistory: WorkHistoryEntry[]
  /** Admin-edited header boxes from the old Interim Work page (server-rendered by the caller). */
  headerBoxes?: ReactNode
}) {
  const {
    showIndependent, showAdvisory, boardReady, phases, marketplaceListings, expertNetworkListings, boardListings, signedUpIds, interimSignups,
    interimSignupMix, isMember, platformRows, platformStatuses, gmailConnected, clickedNotRegistered, hasWomenFocusedListings,
  } = data
  const steps = launchSteps(phases)
  const next = nextLaunchPhase(phases)
  const cards = sourceCards({
    showIndependent,
    showAdvisory,
    signups: interimSignups.map((s) => ({ category: s.listing.category })),
    marketplaceCount: marketplaceListings.length,
    expertCount: expertNetworkListings.length,
    boardCount: boardListings.length,
  })
  const signups = summarizeSignups(
    interimSignups.map((s) => ({ name: s.listing.name })),
    platformRows
  )

  return (
    <div className="space-y-10">
      {/* 1. The launch plan: one next step. Navy is the one next-level block on the page. */}
      <section aria-labelledby="launch" className="space-y-5 rounded-2xl bg-ink p-7 text-white">
        <div className="space-y-1.5">
          <h2 id="launch" className="font-display text-2xl font-semibold">Set up your own consultancy</h2>
          <p className="max-w-2xl text-base text-white/85">
            Most interim work comes through a warm introduction, so the fastest route is to package what you already do as an offer and take it to your network.
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-sm text-white/85">{launchProgressLine(phases)}</p>
          <ol className="grid gap-2 sm:grid-cols-3" aria-label="Launch steps">
            {steps.map((s) => (
              <li key={s.number} className={cn('flex items-center gap-2 rounded-lg p-3 text-sm', s.done ? 'bg-white/15' : s.number === next?.number ? 'bg-white/10 ring-1 ring-white/40' : 'bg-white/5 text-white/80')}>
                {s.done ? <Check className="size-4 shrink-0" aria-label="Done" /> : <span className="w-4 shrink-0 text-center text-xs tabular-nums" aria-hidden>{s.number}</span>}
                <span>{s.label}</span>
              </li>
            ))}
          </ol>
        </div>
        {next ? (
          <div className="space-y-3 rounded-xl bg-white p-5 text-ink">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Next step</p>
              <h3 className="text-lg font-semibold">{next.label}</h3>
              <p className="text-sm text-muted-foreground">{next.description}</p>
            </div>
            {next.number === 1 && <GigDirectoryUnlockForm />}
            {next.number === 2 && <InterimOfferDefinitionForm />}
            {next.number === 6 && (
              <form action={markInterimOutreachStarted}>
                <SubmitButton pendingLabel="Saving…">I have started reaching out</SubmitButton>
              </form>
            )}
            {next.cta && (
              <ActionLink kind="primary" href={next.cta.href} event="independent_next_step_opened" props={{ phase: next.number, step: next.label }}>
                {next.cta.label}
              </ActionLink>
            )}
          </div>
        ) : (
          <div className="space-y-3 rounded-xl bg-white p-5 text-ink">
            <p className="text-base">Your offer is out. Look through the places below for the first engagement.</p>
            <ActionLink kind="primary" href="#where-work-comes-from" event="independent_next_step_opened" props={{ phase: null, step: 'browse_sources' }}>
              See where work comes from
            </ActionLink>
          </div>
        )}
      </section>

      {/* 2. Where independent work comes from. */}
      <Section id="where-work-comes-from" title="Where independent work comes from">
        {!unlocked ? (
          <p className="text-base text-muted-foreground">Marketplaces, expert networks and advisory directories open together once you set your rate target in the step above.</p>
        ) : (
          <div className="space-y-3">
            {cards.map((c) => (
              <DisclosureCard key={c.key} title={c.title} blurb={c.blurb} status={c.status} event="independent_source_opened" properties={{ source: c.key, status: c.status }}>
                {c.key === 'marketplaces' && (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Tailored to your background. Partner means we have a confirmed relationship with the platform; Included for quality means it is a real, relevant option with no revenue arrangement.
                    </p>
                    {marketplaceListings.length === 0 ? (
                      <ListingsEmpty>No marketplaces match your background yet. Check back soon.</ListingsEmpty>
                    ) : (
                      <InterimListingCarousel listings={marketplaceListings} signedUpIds={signedUpIds} showSignupCheckbox platformStatuses={platformStatuses} />
                    )}
                  </>
                )}
                {c.key === 'experts' && (
                  <>
                    <p className="text-sm text-muted-foreground">Expert networks pay for one-hour calls. Sign up with two or three, then wait for requests that match your experience.</p>
                    {expertNetworkListings.length === 0 ? (
                      <ListingsEmpty>No expert networks are listed yet. Check back soon.</ListingsEmpty>
                    ) : (
                      <InterimListingGrid listings={expertNetworkListings} signedUpIds={signedUpIds} showSignupCheckbox platformStatuses={platformStatuses} />
                    )}
                  </>
                )}
                {c.key === 'advisory' && (
                  <>
                    {showAdvisory && (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          {boardReady
                            ? 'Based on your level and years of experience, formal board and advisory positions are a realistic option worth pursuing.'
                            : 'Formal corporate board seats usually fit later in a career. Nonprofit board and advisory roles are a strong, realistic start and a real credential-builder.'}
                        </p>
                        {!isMember ? (
                          <p className="text-sm text-ink">
                            {boardListings.length} listing{boardListings.length === 1 ? '' : 's'} ready to view once you are a{' '}
                            <Link href="/dashboard/membership" className="font-medium text-brand underline underline-offset-4">NextChapter member</Link>.
                          </p>
                        ) : (
                          <>
                            {hasWomenFocusedListings && boardDiversityOptIn === null && (
                              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/60 p-4">
                                <p className="text-sm text-ink">A couple of platforms focus on supporting women or underrepresented leaders. Include them in your list?</p>
                                <div className="flex shrink-0 gap-2" role="group" aria-label="Include those platforms">
                                  <form action={setBoardDiversityListingsOptIn.bind(null, true)}>
                                    <SubmitButton variant="outline" size="sm" pendingLabel="Saving…">Yes, include them</SubmitButton>
                                  </form>
                                  <form action={setBoardDiversityListingsOptIn.bind(null, false)}>
                                    <SubmitButton variant="outline" size="sm" pendingLabel="Saving…">No, skip those</SubmitButton>
                                  </form>
                                </div>
                              </div>
                            )}
                            {boardListings.length === 0 ? (
                              <ListingsEmpty>No board or advisory directories are listed for your level yet. Check back soon.</ListingsEmpty>
                            ) : (
                              <InterimListingGrid listings={boardListings} signedUpIds={signedUpIds} platformStatuses={platformStatuses} />
                            )}
                          </>
                        )}
                      </div>
                    )}
                    <div className="space-y-3 text-sm text-muted-foreground">
                      <p>
                        <span className="font-semibold text-ink">Guest lecturing and teaching.</span> Sharing what you know in public is also how board seats and fractional clients find you. Build the content with the{' '}
                        <Link href="/dashboard/marketing-plan" className="font-medium text-brand underline underline-offset-4">My Marketing Plan</Link>.
                      </p>
                      <p>
                        <span className="font-semibold text-ink">Light advisory and angel work.</span> A few hours a month for a founder or small team is a real step toward a formal board seat. It comes from the same network outreach as your launch plan, so there is no directory to apply to.
                      </p>
                    </div>
                  </>
                )}
              </DisclosureCard>
            ))}
          </div>
        )}
      </Section>

      {/* 3. Where you have signed up. */}
      <Section id="signed-up" title="Where you have signed up">
        {signups.count === 0 ? (
          <p className="text-base text-muted-foreground">
            No sign-ups yet.{' '}
            {unlocked ? <>When you join a platform, tick &ldquo;I signed up&rdquo; on its card above</> : <>Once the directories open, tick &ldquo;I signed up&rdquo; on a platform&apos;s card when you join</>}
            {gmailConnected ? ', or we will find it in your email.' : '. Connect Gmail and we find them from your email.'}
          </p>
        ) : (
          <div className="space-y-1.5">
            <p className="text-base text-ink">
              {signups.count} place{signups.count === 1 ? '' : 's'}: {signups.names.join(', ')}.
            </p>
            {signups.emailNotes.length > 0 && (
              <p className="text-sm text-muted-foreground">We found these in your email. {signups.emailNotes.join('. ')}.</p>
            )}
          </div>
        )}
      </Section>

      {/* Everything else the toolkit offered. */}
      <ShowMore label="Show the full launch plan, work log and platform activity" event="find_more_options_opened" properties={{ part: 'independent', section: 'toolkit' }}>
        {headerBoxes}
        <PlatformActivityPanel kind="WORK" rows={platformRows} gmailConnected={gmailConnected} />

        {showAdvisory && boardAdvisoryWillingness !== true && (
          <div className="space-y-3 rounded-xl bg-muted/60 p-5">
            <p className="text-base font-medium text-ink">Are you willing to take unpaid board positions to fill resume gaps, keep skills current and build new experience?</p>
            <div className="flex gap-2" role="group" aria-label="Willing to take unpaid board positions">
              <form action={answerBoardAdvisoryWillingness.bind(null, true)}>
                <SubmitButton size="sm" pendingLabel="Saving…">Yes</SubmitButton>
              </form>
              <form action={answerBoardAdvisoryWillingness.bind(null, false)}>
                <SubmitButton variant="outline" size="sm" pendingLabel="Saving…">No</SubmitButton>
              </form>
            </div>
          </div>
        )}

        {unlocked && clickedNotRegistered.length > 0 && (
          <div className="rounded-xl border border-dashed border-brand/40 bg-brand/5 p-5">
            <p className="text-base font-medium text-ink">You looked at {clickedNotRegistered.length === 1 ? 'this one' : 'these'} but have not marked a sign-up yet</p>
            <ul className="mt-2 space-y-2">
              {clickedNotRegistered.map((listing) => (
                <li key={listing.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-ink">{listing.name}</span>
                  <form action={markInterimMarketplaceSignup.bind(null, listing.id)}>
                    <SubmitButton variant="outline" size="sm" pendingLabel="Saving…">I signed up</SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        )}

        {unlocked && interimSignups.length > 0 && (
          <TierSummaryCard
            title="Interim work sign-ups"
            count={interimSignups.length}
            unitLabel="signup"
            tier={signupCountToTier(interimSignups.length)}
            buildingAt={3}
            highAt={5}
            unlockedContent={<SignupBreakdown names={interimSignups.map((s) => s.listing.name)} />}
            mixTitle="A well-rounded pursuit"
            mixItems={[
              { label: 'A fractional or talent marketplace', done: interimSignupMix.hasMarketplaceSignup },
              { label: 'An expert network', done: interimSignupMix.hasExpertNetworkSignup },
              { label: 'A board or advisory listing', done: interimSignupMix.hasBoardSignup },
            ]}
          />
        )}

        {showIndependent && (
          <div id="launch-phase-1" className="scroll-mt-4 space-y-6">
            <h3 className="font-display text-xl font-semibold text-ink">Your launch plan, step by step</h3>
            {/* The step in the navy block above holds its own form; the tracker shows the other steps. */}
            <InterimLaunchPlanTracker phases={phases.map((p) => (p.number === next?.number ? { ...p, cta: null } : p))} skipFormsFor={next?.number} />
            {unlocked && (
              <div className="space-y-6 rounded-2xl border border-border p-5">
                <div className="space-y-2">
                  <h3 className="text-base font-semibold text-ink">Tell your network you are available</h3>
                  <p className="text-sm text-muted-foreground">
                    Most interim work comes through a warm introduction, not a cold application. Use{' '}
                    <Link href="/dashboard/network" className="font-medium text-brand underline underline-offset-4">Activate My Network</Link>{' '}
                    and its &ldquo;checking in&rdquo; email script, written for telling a contact you are open to interim or contract work.
                  </p>
                </div>
                <div className="space-y-2">
                  <h3 className="text-base font-semibold text-ink">Log your interim or fractional work</h3>
                  <p className="text-sm text-muted-foreground">
                    Once you land your first client, log it here. We help you show it on your resume as a real role, track it toward your Landed an Interim Role badge, and keep it current with a monthly check-in.
                  </p>
                  <WorkHistoryForm />
                  <WorkHistoryList entries={workHistory} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-base font-semibold text-ink">Handle the business basics</h3>
                  <p className="text-sm text-muted-foreground">Two things worth setting up before your first invoice is overdue:</p>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    <li>
                      Forming an LLC or sole proprietorship. The{' '}
                      <a href="https://www.sba.gov/business-guide/launch-your-business/choose-business-structure" target="_blank" rel="noopener noreferrer" className="font-medium text-brand underline underline-offset-4">SBA business-structure guide</a>{' '}
                      is a neutral starting point, not a vendor recommendation.
                    </li>
                    <li>
                      Invoicing and getting paid.{' '}
                      <a href="https://stripe.com/invoicing" target="_blank" rel="noopener noreferrer" className="font-medium text-brand underline underline-offset-4">Stripe Invoicing</a>{' '}
                      is a straightforward option if you do not already have one.
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </ShowMore>
    </div>
  )
}
