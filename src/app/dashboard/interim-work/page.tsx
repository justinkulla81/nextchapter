import Link from 'next/link'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { InterimLaunchPlanTracker } from '@/components/dashboard/InterimLaunchPlanTracker'
import { InterimListingGrid } from '@/components/dashboard/InterimListingGrid'
import { WorkHistoryForm } from '@/components/dashboard/WorkHistoryForm'
import { WorkHistoryList } from '@/components/dashboard/WorkHistoryList'
import { getInterimLaunchPlan } from '@/lib/gig-directory/interim-launch-plan'
import { getRelevantMarketplaceCategories } from '@/lib/interim-work/marketplace-tailoring'
import { isBoardReady } from '@/lib/interim-work/board-readiness'
import { hasLegalRestrictionFlag } from '@/lib/interim-work/expert-network-caution'
import { getActiveListings, getSignedUpListingIds } from '@/lib/interim-work/listings'
import { InterimListingCategory } from '@prisma/client'

export default async function InterimWorkPage() {
  const profile = await getDashboardData()
  const phases = await getInterimLaunchPlan(profile)

  const marketplaceCategories = getRelevantMarketplaceCategories(profile)
  const boardReady = isBoardReady(profile)
  const showLegalCaution = hasLegalRestrictionFlag()

  const [marketplaceListings, expertNetworkListings, boardListings, signedUpIds] = await Promise.all([
    getActiveListings(marketplaceCategories),
    getActiveListings([InterimListingCategory.EXPERT_NETWORK]),
    getActiveListings([
      boardReady ? InterimListingCategory.BOARD_ADVISORY : InterimListingCategory.NONPROFIT_BOARD,
    ]),
    getSignedUpListingIds(profile.id),
  ])

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Interim Work</h1>
        <p className="mt-1 text-muted-foreground">
          Fractional, interim, and consulting work is a real bridge while you search — a source of
          income, a way to keep your resume current, and sometimes a path to a full-time offer in
          its own right. This page covers five ways into it.
        </p>
      </div>

      {/* Section 1 — Set Up Your Own Consultancy */}
      <section className="space-y-6 border-b border-border pb-10">
        <div>
          <h2 className="text-lg font-semibold">1. Set up your own consultancy</h2>
          <p className="text-sm text-muted-foreground">
            The fastest path for most candidates: package what you already do as an independent
            offer and go straight to your network, rather than waiting on a marketplace to match
            you.
          </p>
        </div>

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
      </section>

      {/* Section 2 — Fractional / Talent Marketplaces */}
      {profile.gigDirectoryUnlockAnswer && (
        <section className="space-y-3 border-b border-border pb-10">
          <div>
            <h2 className="text-lg font-semibold">2. Fractional & talent marketplaces</h2>
            <p className="text-sm text-muted-foreground">
              Tailored to your background — Partner means we have a confirmed relationship with the
              platform; Included for quality means it&apos;s a real, relevant option with no revenue
              arrangement.
            </p>
          </div>
          <InterimListingGrid listings={marketplaceListings} signedUpIds={signedUpIds} showSignupCheckbox />
        </section>
      )}

      {/* Section 3 — Expert Networks */}
      {profile.gigDirectoryUnlockAnswer && (
        <section className="space-y-3 border-b border-border pb-10">
          <div>
            <h2 className="text-lg font-semibold">3. Expert networks</h2>
            <p className="text-sm text-muted-foreground">
              Paid consulting calls with investors and consulting firms who need your specific
              industry expertise — usually flexible, project-based, and a good fit alongside a
              search.
            </p>
          </div>
          {showLegalCaution && (
            <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
              A restriction flagged on your account may limit paid consulting work like this — check
              with your coach before signing up.
            </p>
          )}
          <InterimListingGrid listings={expertNetworkListings} signedUpIds={signedUpIds} />
        </section>
      )}

      {/* Section 4 — Board & Advisory */}
      {profile.gigDirectoryUnlockAnswer && (
        <section className="space-y-3 border-b border-border pb-10">
          <div>
            <h2 className="text-lg font-semibold">4. Board & advisory roles</h2>
            <p className="text-sm text-muted-foreground">
              {boardReady
                ? 'Based on your level and years of experience, formal board and advisory positions are a realistic option worth pursuing.'
                : 'Formal corporate board seats are typically a fit later in a career — nonprofit board and advisory roles are a strong, realistic starting point and a real credential-builder.'}
            </p>
          </div>
          <InterimListingGrid listings={boardListings} signedUpIds={signedUpIds} />
        </section>
      )}

      {/* Section 5 — Teaching & light advisory */}
      {profile.gigDirectoryUnlockAnswer && (
        <section className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold">5. Teaching & light advisory work</h2>
            <p className="text-sm text-muted-foreground">
              Lower-commitment ways to stay visible and put your expertise to use.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-medium text-foreground">Guest lecturing & teaching</h3>
            <p className="text-sm text-muted-foreground">
              Sharing what you know publicly is also how board seats and fractional clients find you.
              Use the{' '}
              <Link href="/dashboard/marketing-plan" className="text-primary underline underline-offset-4">
                My Marketing Plan
              </Link>{' '}
              to build the content that leads to these invitations.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-medium text-foreground">Light advisory & angel work</h3>
            <p className="text-sm text-muted-foreground">
              Informal advising — a few hours a month for a founder or small team — is a real rung on
              the ladder toward a formal board seat, but it&apos;s relationship-driven rather than
              something you apply for. There&apos;s no directory for this one: it comes from the same
              network activation as Section 1, so keep that going.
            </p>
          </div>
        </section>
      )}
    </div>
  )
}
