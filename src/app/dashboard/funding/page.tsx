import type { Metadata } from 'next'
import Link from 'next/link'
import { after } from 'next/server'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { fundingFor, usesSelfId } from '@/lib/benefits/member'
import { goalOrderFor } from '@/lib/benefits/match'
import { captureServerEvent } from '@/lib/posthog/server'
import { PageHeader } from '@/components/candidate/PageHeader'
import { FundingSections } from '@/components/dashboard/FundingList'
import { FundingSharpenForm } from '@/components/dashboard/FundingSharpenForm'

export const metadata: Metadata = { title: 'Funding you qualify for' }

export default async function FundingPage() {
  const profile = await getDashboardData()
  const f = await fundingFor(profile)
  const counts = { move: f.byGoal.move.length, retrain: f.byGoal.retrain.length, support: f.byGoal.support.length, tax: f.byGoal.tax.length, learn: f.byGoal.learn.length }
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
  const hasSelfId = [profile.eeocRaceEthnicity, profile.eeocGenderIdentity, profile.eeocVeteranStatus, profile.eeocDisabilityStatus].some((v) => v && v !== 'PREFER_NOT_TO_ANSWER')
  const useSelfId = usesSelfId(profile.journeyDetails)
  const needsState = !f.facts.state
  const needsMove = !f.relocationAnswered || f.facts.relocation.scope === 'LOCAL'

  return (
    <div className="space-y-10">
      <PageHeader
        title={`${f.matches.length} funding programs fit you`}
        intro="Real dollars first: moving money, tuition and training money, and tax credits, then free courses. Ranked by how well each fits where you live, where you would go and your situation. Programs that do not apply to you are left out."
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

      <FundingSections byGoal={f.byGoal} order={goalOrderFor(f.facts.laidOff)} />

      <FundingSharpenForm held={[...held]} hasSelfId={hasSelfId} useSelfId={useSelfId} />

      <p className="text-xs text-muted-foreground">
        Each program links to its official page and was checked against it. Amounts and deadlines change, so confirm there before you apply. We rank; we do not decide
        eligibility.
      </p>
    </div>
  )
}
