import Link from 'next/link'
import { Lock } from 'lucide-react'
import type { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { InterimLaunchPlanTracker } from '@/components/dashboard/InterimLaunchPlanTracker'
import { InterimListingGrid } from '@/components/dashboard/InterimListingGrid'
import { InterimListingCarousel } from '@/components/dashboard/InterimListingCarousel'
import { WorkHistoryForm } from '@/components/dashboard/WorkHistoryForm'
import { WorkHistoryList } from '@/components/dashboard/WorkHistoryList'
import { loadIndependentWork } from '@/lib/interim-work/independent-work-data'
import { setBoardDiversityListingsOptIn, markInterimMarketplaceSignup, answerBoardAdvisoryWillingness } from '@/app/dashboard/interim-work/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { TierSummaryCard } from '@/components/dashboard/TierSummaryCard'
import { signupCountToTier } from '@/lib/interim-work/signup-count-tier'
import { GigDirectoryUnlockForm } from '@/components/dashboard/GigDirectoryUnlockForm'
import { PlatformActivityPanel } from '@/components/dashboard/platforms/PlatformActivityPanel'
import type { WorkType } from '@/lib/jobs/work-type'
import { PageHeaderBoxes } from '@/components/dashboard/PageHeaderBoxes'

// Moved here from the Interim Work page (/dashboard/interim-work, now a redirect
// into the one board): the independent-work toolkit — platform activity from
// Gmail, the consultancy launch plan and work log, fractional marketplaces, the
// board and advisory directory, teaching. Shown on the board whenever part-time,
// contract or advisory work is switched on; each part only for the types it serves.
// Expert networks moved to the top of the Contract view (ExpertNetworkRow), and the
// matched board and consulting roles into the board's employer-matched roles.

function InterimSignupBreakdownContent({ signups }: { signups: { listing: { name: string } }[] }) {
  return (
    <ul className="space-y-1 text-sm text-foreground">
      {signups.map((s) => (
        <li key={s.listing.name}>{s.listing.name}</li>
      ))}
    </ul>
  )
}

export async function IndependentWorkSections({
  profile,
  types,
}: {
  profile: Awaited<ReturnType<typeof getDashboardData>>
  types: WorkType[]
}) {
  const data = await loadIndependentWork(profile, types)
  if (!data) return null
  const {
    showIndependent, showAdvisory, boardReady, phases, marketplaceListings, signedUpIds, interimSignups, isMember, platformRows, platformStatuses,
    gmailConnected, interimSignupMix, clickedNotRegistered, boardListings, hasWomenFocusedListings,
  } = data

  return (
    <div id="independent-work" className="scroll-mt-4 space-y-10 border-t border-border pt-8">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Independent work toolkit</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Platforms, a launch plan and directories for {showIndependent && showAdvisory ? 'fractional, contract and board work' : showAdvisory ? 'board and advisory work' : 'fractional and contract work'}.
        </p>
      </div>
      {/* Admin-edited header boxes from the old Interim Work page. */}
      <PageHeaderBoxes pageKey="interim-work" candidateId={profile.id} />
      <PlatformActivityPanel kind="WORK" rows={platformRows} gmailConnected={gmailConnected} />

      {/* Second chance at the Board Advisory Work willingness question —
          shown only until answered yes here or on Search Strategy (a "no"
          on Search Strategy shouldn't be the final word, since someone
          browsing Interim Work has already shown some interest). */}
      {showAdvisory && profile.boardAdvisoryWillingness !== true && (
        <div className="rounded-lg border border-border bg-off-white p-4">
          <p className="text-sm font-medium text-foreground">
            Are you willing to take unpaid board positions to fill in resume gaps, keep skills current,
            and build new experience?
          </p>
          <div className="mt-3 flex gap-2">
            <form action={answerBoardAdvisoryWillingness.bind(null, true)}>
              <SubmitButton size="sm" pendingLabel="Saving…">
                Yes
              </SubmitButton>
            </form>
            <form action={answerBoardAdvisoryWillingness.bind(null, false)}>
              <SubmitButton variant="outline" size="sm" pendingLabel="Saving…">
                No
              </SubmitButton>
            </form>
          </div>
        </div>
      )}

      {/* Section 1 — Set Up Your Own Consultancy — collapsed by default (a
          full phase-by-phase tracker plus three sub-forms is a lot to land
          on before a candidate has even chosen this path); the summary line
          alone carries the "what is this and why" explanation. */}
      {showIndependent && (
      <details id="launch-phase-1" className="group scroll-mt-4 space-y-6 border-b border-border pb-10">
        <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">Set up your own consultancy</h3>
              <p className="text-sm text-muted-foreground">
                The fastest path for most candidates: package what you already do as an independent
                offer and go straight to your network, rather than waiting on a marketplace to match
                you.
              </p>
            </div>
            <span className="mt-1 shrink-0 text-xs font-medium text-muted-foreground underline underline-offset-4 group-open:hidden">
              Show launch plan
            </span>
          </div>
        </summary>

        <InterimLaunchPlanTracker phases={phases} />

        {profile.gigDirectoryUnlockAnswer && (
          <div className="space-y-6 rounded-lg border border-border p-4">
            <div className="space-y-2">
              <h3 className="font-medium text-foreground">Tell your network you&apos;re available</h3>
              <p className="text-sm text-muted-foreground">
                Most interim work comes through a warm introduction, not a cold application. Use{' '}
                <Link href="/dashboard/network" className="text-primary underline underline-offset-4">
                  Activate My Network
                </Link>{' '}
                and its &ldquo;checking in&rdquo; email script — it&apos;s written specifically for
                telling a contact you&apos;re now open to interim or contract work, not just
                full-time.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="font-medium text-foreground">Log your interim or fractional work</h3>
              <p className="text-sm text-muted-foreground">
                Once you land your first client, log it here — we&apos;ll help you show it on your
                resume the right way (as a real role, not a gap-filler), track it toward your Landed
                an Interim Role badge, and keep it current with a quick monthly check-in.
              </p>
              <WorkHistoryForm />
              <WorkHistoryList entries={profile.workHistory} />
            </div>

            <div className="space-y-2">
              <h3 className="font-medium text-foreground">Handle the business basics</h3>
              <p className="text-sm text-muted-foreground">
                Two things worth setting up early rather than after your first invoice is overdue:
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>
                  Forming an LLC or sole proprietorship — the{' '}
                  <a
                    href="https://www.sba.gov/business-guide/launch-your-business/choose-business-structure"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-4"
                  >
                    SBA&apos;s business-structure guide
                  </a>{' '}
                  is a neutral starting point, not a specific vendor recommendation.
                </li>
                <li>
                  Invoicing and getting paid —{' '}
                  <a
                    href="https://stripe.com/invoicing"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-4"
                  >
                    Stripe Invoicing
                  </a>{' '}
                  is a straightforward option if you don&apos;t already have one.
                </li>
              </ul>
            </div>
          </div>
        )}
      </details>
      )}

      {!profile.gigDirectoryUnlockAnswer ? (
        <div id="gig-directory-unlock" className="scroll-mt-4 space-y-3 rounded-lg border border-dashed border-light-gray bg-off-white p-4">
          <div className="flex items-center gap-2">
            <Lock className="size-4 text-orange" />
            <p className="text-sm font-medium text-orange">Directory — locked</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Fractional & talent marketplaces, expert networks, board & advisory roles, and teaching
            opportunities all unlock together — answer this to see them:
          </p>
          <GigDirectoryUnlockForm />
        </div>
      ) : (
        <>
          {clickedNotRegistered.length > 0 && (
            <div className="rounded-lg border border-dashed border-brand/40 bg-brand/5 p-4">
              <p className="text-sm font-medium text-foreground">
                You looked at {clickedNotRegistered.length === 1 ? 'this one' : 'these'} but haven&apos;t registered yet
              </p>
              <ul className="mt-2 space-y-2">
                {clickedNotRegistered.map((listing) => (
                  <li key={listing.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm text-foreground">{listing.name}</span>
                    <form action={markInterimMarketplaceSignup.bind(null, listing.id)}>
                      <SubmitButton variant="outline" size="sm" pendingLabel="Saving…">
                        I signed up
                      </SubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {interimSignups.length > 0 && (
            <TierSummaryCard
              title="Interim Work Signups"
              count={interimSignups.length}
              unitLabel="signup"
              tier={signupCountToTier(interimSignups.length)}
              buildingAt={3}
              highAt={5}
              unlockedContent={<InterimSignupBreakdownContent signups={interimSignups} />}
              mixTitle="A well-rounded pursuit"
              mixItems={[
                { label: 'A fractional or talent marketplace', done: interimSignupMix.hasMarketplaceSignup },
                { label: 'An expert network', done: interimSignupMix.hasExpertNetworkSignup },
                { label: 'A board or advisory listing', done: interimSignupMix.hasBoardSignup },
              ]}
            />
          )}

          {/* Section 2 — Fractional / Talent Marketplaces */}
          {showIndependent && (
          <section className="space-y-3 border-b border-border pb-10">
            <div>
              <h3 className="text-base font-semibold">Fractional & talent marketplaces</h3>
              <p className="text-sm text-muted-foreground">
                Tailored to your background — Partner means we have a confirmed relationship with the
                platform; Included for quality means it&apos;s a real, relevant option with no revenue
                arrangement.
              </p>
            </div>
            <InterimListingCarousel listings={marketplaceListings} signedUpIds={signedUpIds} showSignupCheckbox platformStatuses={platformStatuses} />
          </section>
          )}

          {/* Section 4 — Board & Advisory (Phase 8, §A2.4 — a Membership perk) */}
          {showAdvisory && (
          <section id="launch-phase-4" className="scroll-mt-4 space-y-3 border-b border-border pb-10">
            <div>
              <h3 className="text-base font-semibold">Board & advisory directories</h3>
              <p className="text-sm text-muted-foreground">
                {boardReady
                  ? 'Based on your level and years of experience, formal board and advisory positions are a realistic option worth pursuing.'
                  : 'Formal corporate board seats are typically a fit later in a career — nonprofit board and advisory roles are a strong, realistic starting point and a real credential-builder.'}{' '}
                Partner means we have a confirmed relationship with the platform; Included for
                quality means it&apos;s a real, relevant option with no revenue arrangement.
              </p>
            </div>
            {!isMember ? (
              <div className="rounded-lg border border-dashed border-light-gray bg-off-white p-4">
                <div className="flex items-center gap-2">
                  <Lock className="size-4 text-orange" />
                  <p className="text-sm font-medium text-orange">Board & advisory listings — Membership only</p>
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {boardListings.length} listing{boardListings.length === 1 ? '' : 's'} ready to view once you&apos;re a{' '}
                  <Link href="/dashboard/membership" className="text-primary underline underline-offset-4">
                    NextChapter Member
                  </Link>
                  .
                </p>
              </div>
            ) : (
              <>
                {hasWomenFocusedListings && profile.boardDiversityListingsOptIn === null && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-off-white p-3">
                    <p className="text-sm text-muted-foreground">
                      A couple of platforms below focus specifically on supporting women or
                      underrepresented leaders. Want those included in your list?
                    </p>
                    <div className="flex shrink-0 gap-2">
                      <form action={setBoardDiversityListingsOptIn.bind(null, true)}>
                        <SubmitButton variant="outline" size="sm" pendingLabel="Saving…">
                          Yes, include them
                        </SubmitButton>
                      </form>
                      <form action={setBoardDiversityListingsOptIn.bind(null, false)}>
                        <SubmitButton variant="outline" size="sm" pendingLabel="Saving…">
                          No, skip those
                        </SubmitButton>
                      </form>
                    </div>
                  </div>
                )}
                <InterimListingGrid listings={boardListings} signedUpIds={signedUpIds} platformStatuses={platformStatuses} />
              </>
            )}
          </section>
          )}

          {/* Section 5 — Teaching & light advisory */}
          <section className="space-y-6">
            <div>
              <h3 className="text-base font-semibold">Teaching & light advisory work</h3>
              <p className="text-sm text-muted-foreground">
                Lower-commitment ways to stay visible and put your expertise to use.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium text-foreground">Guest lecturing & teaching</h3>
              <p className="text-sm text-muted-foreground">
                Sharing what you know publicly is also how board seats and fractional clients find
                you. Use the{' '}
                <Link href="/dashboard/marketing-plan" className="text-primary underline underline-offset-4">
                  My Marketing Plan
                </Link>{' '}
                to build the content that leads to these invitations.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium text-foreground">Light advisory & angel work</h3>
              <p className="text-sm text-muted-foreground">
                Informal advising — a few hours a month for a founder or small team — is a real rung
                on the ladder toward a formal board seat, but it&apos;s relationship-driven rather
                than something you apply for. There&apos;s no directory for this one: it comes from
                the same network outreach as the consultancy launch plan, so keep that going.
              </p>
            </div>
          </section>
        </>
      )}

    </div>
  )
}
