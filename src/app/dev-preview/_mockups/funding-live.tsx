import { FundingSections } from '@/components/dashboard/FundingList'
import { FundingSharpenForm } from '@/components/dashboard/FundingSharpenForm'
import { PageHeader } from '@/components/candidate/PageHeader'
import { goalOrderFor, type Match } from '@/lib/benefits/match'
import type { BenefitProgramRow } from '@/lib/benefits/types'

// The member funding page (dashboard/funding), the code that ships, fed sample matches. Shows the Apply now button,
// a program written for a community (only shown to a member who turned on self-ID matching), and the sharpen form
// with the opt-in toggle open to a member who already answered the voluntary survey.
const row = (o: Partial<BenefitProgramRow> & Pick<BenefitProgramRow, 'id' | 'category' | 'name'>): BenefitProgramRow => ({
  provider: null, scope: 'NATIONAL', state: null, locality: null, amount: null, eligibility: null, status: 'OPEN', statusNote: null,
  url: 'https://example.org/program', segments: [], verified: true, checkedAt: new Date('2026-10-22T00:00:00Z'), source: 'sample',
  city: null, employer: null, employerKey: null, geoAreaId: null, applyUrl: null, affinity: [], ...o,
})
const m = (program: BenefitProgramRow, goal: Match['goal'], score: number, why: string, amount: number | null): Match => ({ program, goal, score, why, amount })

const byGoal = {
  support: [m(row({ id: 's1', category: 'SUPPORT', name: 'Marketplace health coverage after a job loss', amount: 'Coverage starts within 60 days of losing a job', eligibility: 'Anyone who lost job-based coverage' }), 'support', 70, 'Anyone can use it, in any state', null)],
  move: [m(row({ id: 'm1', category: 'RELOCATION', name: 'Tulsa Remote', scope: 'LOCAL', state: 'OK', locality: 'Tulsa', amount: '$10,000 grant', eligibility: 'Full-time remote workers who move to Tulsa', applyUrl: 'https://tulsaremote.com/apply' }), 'move', 88, 'You said you would move anywhere, and OK pays', 10000)],
  retrain: [
    m(row({ id: 'r1', category: 'SEGMENT', name: 'Hispanic Scholarship Fund scholarships', amount: 'Scholarships for students of Hispanic heritage', eligibility: 'Students of Hispanic heritage', segments: ['Hispanic or Latino'], affinity: ['Hispanic or Latino'], applyUrl: 'https://www.hsf.net/scholarship', url: 'https://www.hsf.net' }), 'retrain', 90, 'Built for people like you. Anyone can use it, in any state. Written with the Hispanic or Latino community in mind.', null),
    m(row({ id: 'r2', category: 'STATE_TRAINING', name: 'Kentucky Work Ready Scholarship', scope: 'STATE', state: 'KY', amount: 'Up to 60 credit hours tuition-free', eligibility: 'Kentucky adults without an associate degree' }), 'retrain', 80, 'You live in KY', null),
  ],
  tax: [m(row({ id: 't1', category: 'TAX', name: 'Lifetime Learning Credit', amount: 'Credit up to $2,000 per return', eligibility: 'Tuition and fees for job-skills courses' }), 'tax', 60, 'Anyone can use it, in any state', 2000)],
  learn: [m(row({ id: 'l1', category: 'COURSES', name: 'Google AI Essentials via Goodwill', amount: 'Free seat', eligibility: 'US adults' }), 'learn', 50, 'Anyone can use it, in any state', null)],
} as unknown as Parameters<typeof FundingSections>[0]['byGoal']

export function FundingLive() {
  return (
    <div className="mx-auto max-w-3xl space-y-10 p-6">
      <PageHeader title="6 funding programs fit you" intro="Real dollars first: moving money, tuition and training money, and tax credits, then free courses. Ranked by how well each fits where you live, where you would go and your situation. Programs that do not apply to you are left out." />
      <FundingSections byGoal={byGoal} order={goalOrderFor(true)} />
      <FundingSharpenForm held={['age50']} hasSelfId useSelfId />
    </div>
  )
}
