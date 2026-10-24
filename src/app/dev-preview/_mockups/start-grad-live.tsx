import { PreviewShell } from '@/components/candidate/PreviewShell'
import { PageHeader } from '@/components/candidate/PageHeader'
import { GraduationPlan } from '@/components/dashboard/early-career/GraduationPlan'
import { StartHelpTab, StartPlanTab } from '@/components/dashboard/start/StartTabs'
import { StalledReaskCard } from '@/components/dashboard/StalledReaskCard'
import { OtherPathsView } from '@/components/dashboard/paths/OtherPathsView'
import { reaskOptions } from '@/lib/journey/stalled-reask'

// Start a business, the about-to-graduate plan, the stalled-search re-ask and the school form, fed sample data.

function Shell({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <PreviewShell place="learn" entry="learn" part="skills">
      <div className="space-y-8">
        <PageHeader title={title} intro={intro} />
        {children}
      </div>
    </PreviewShell>
  )
}

const START = { stage: 'validate' as const, kind: 'services', customers: 'talked' }

export function StartPlanLive() {
  return (
    <Shell title="Ask three people to pay, pre-order or sign up for the smallest version of it." intro="Prove someone will pay before you build much.">
      <StartPlanTab details={START} stage="validate" started schoolName="University of Louisville" venture="Fractional finance for small clinics" runwayMonths={5} />
    </Shell>
  )
}

export function StartHelpLive() {
  return (
    <Shell title="Start a business" intro="Five steps from idea to growth, with the free and public help at each one.">
      <StartHelpTab details={START} stage="validate" />
    </Shell>
  )
}

export function GraduationLive() {
  return (
    <Shell title="Your first job plan" intro="No full-time experience yet is normal: internships, projects and coursework count.">
      <GraduationPlan graduation={new Date(Date.UTC(2027, 4, 15))} schoolName="University of Louisville" now={new Date('2026-10-23T12:00:00Z')} />
    </Shell>
  )
}

export function ReaskLive() {
  const options = reaskOptions({
    journey: 'LAID_OFF', stage: 'APPLYING', weeksInStage: 8, casual: false, interviews: 0, offers: 0,
    journeyDetails: { incomeNeed: 'under_3' }, hasCoach: false, pivotKnown: true, activePaths: 0, earning: false, senior: true,
  })
  return (
    <Shell title="Your week" intro="Home shows one note.">
      <StalledReaskCard weeks={8} options={options} />
    </Shell>
  )
}

export function OtherPathsSchoolLive() {
  const details = { paths: { school: { level: 'doing', program: 'Part-time MBA', mode: 'full', ends: '2027-05', funding: 'loans' }, job: { level: 'curious' } } }
  return (
    <Shell title="Your other paths" intro="Side work, buying a business, going back to school. Your main focus keeps your weekly plan.">
      <OtherPathsView main="GROWING" journeyDetails={details} kinds={['TRAINING']} buyStarted={false} />
    </Shell>
  )
}
