import type { Metadata } from 'next'
import Link from 'next/link'
import { after } from 'next/server'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { fundingFor } from '@/lib/benefits/member'
import { SELF_TAGS } from '@/lib/benefits/match'
import { captureServerEvent } from '@/lib/posthog/server'
import { PageHeader } from '@/components/candidate/PageHeader'
import { ShowMore } from '@/components/candidate/ShowMore'
import { H2 } from '@/components/candidate/ui'
import { FundingSections } from '@/components/dashboard/FundingList'
import { saveFundingTags } from './actions'

export const metadata: Metadata = { title: 'Funding you qualify for' }

export default async function FundingPage() {
  const profile = await getDashboardData()
  const f = await fundingFor(profile)
  const counts = { move: f.byGoal.move.length, retrain: f.byGoal.retrain.length, learn: f.byGoal.learn.length }
  after(() =>
    captureServerEvent(profile.id, 'funding_page_viewed', {
      matchCount: f.matches.length,
      ...counts,
      hasState: !!f.facts.state,
      relocationScope: f.facts.relocation.scope,
      relocationAnswered: f.relocationAnswered,
      selfTagCount: f.selfTags.length,
    }),
  )
  const held = new Set<string>(f.selfTags)
  const needsState = !f.facts.state
  const needsMove = !f.relocationAnswered || f.facts.relocation.scope === 'LOCAL'

  return (
    <div className="space-y-10">
      <PageHeader
        title={`${f.matches.length} funding programs fit you`}
        intro="Money to move, retrain and learn, ranked by how well each fits where you live, where you would go and your situation. Programs that do not apply to you are left out."
      />

      {(needsState || needsMove) && (
        <div className="space-y-2 rounded-2xl bg-muted p-5 text-sm text-ink">
          <p className="font-semibold">Two answers add more programs.</p>
          <ul className="list-disc space-y-1 pl-5">
            {needsState && (
              <li>
                Your state unlocks the training money your state runs.{' '}
                <Link href="/dashboard/profile" className="font-medium text-brand underline underline-offset-4">
                  Add your state
                </Link>
              </li>
            )}
            {needsMove && (
              <li>
                Where you would move unlocks relocation grants and home-buying help.{' '}
                <Link href="/dashboard/search-strategy" className="font-medium text-brand underline underline-offset-4">
                  Tell us where you would go
                </Link>
              </li>
            )}
          </ul>
        </div>
      )}

      <FundingSections byGoal={f.byGoal} />

      <section className="space-y-3" aria-labelledby="funding-sharpen">
        <ShowMore label="Sharpen your matches" event="funding_sharpen_opened">
          <form action={saveFundingTags} className="space-y-4">
            <div>
              <H2 id="funding-sharpen">Which of these are true for you?</H2>
              <p className="mt-1 text-sm text-muted-foreground">
                Why we ask: some programs are only for veterans, people 50 or older, people with a disability and so on. We show them only if you tell us they apply.
                Private to you: never shown to employers, recruiters, schools or coaches.
              </p>
            </div>
            <div className="space-y-2">
              {SELF_TAGS.filter((t) => t.group !== 'community').map((t) => (
                <label key={t.tag} className="flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" name="tag" value={t.tag} defaultChecked={held.has(t.tag)} />
                  {t.label}
                </label>
              ))}
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-ink">Optional: programs made for your community</legend>
              <p className="text-sm text-muted-foreground">
                Scholarships, fellowships and career programs are often written for a specific community. Leave these blank if you prefer: you will still see everything open to you.
                We use your answers only to rank programs on this page. They are not read from any other form, and they are not sent to analytics.
              </p>
              {SELF_TAGS.filter((t) => t.group === 'community').map((t) => (
                <label key={t.tag} className="flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" name="tag" value={t.tag} defaultChecked={held.has(t.tag)} />
                  {t.label}
                </label>
              ))}
            </fieldset>
            <button type="submit" className="inline-flex h-11 items-center rounded-full bg-action px-7 text-base font-semibold text-action-foreground hover:brightness-95">
              Save and re-rank
            </button>
          </form>
        </ShowMore>
      </section>

      <p className="text-xs text-muted-foreground">
        Each program links to its official page and was checked against it. Amounts and deadlines change, so confirm there before you apply. We rank; we do not decide
        eligibility.
      </p>
    </div>
  )
}
