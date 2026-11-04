import { PreviewShell } from '@/components/candidate/PreviewShell'
import { PremiumOffer } from '@/components/dashboard/PremiumOffer'
import { PersonalInformationView } from '@/components/dashboard/PersonalInformationView'

// The leftover dashboard pages, redesigned to the page contract (docs/candidate-redesign.md). These use the same components the pages ship
// with, fed sample data, so what is reviewed is what ships. Dev only.

const COACH = ['A dedicated human career coach, matched to your background and target role', 'Regular 1:1 video sessions, not a chatbot or a forum', 'Live mock interviews with real-time feedback', 'Direct review of your résumé, LinkedIn and outreach messages']
const RECRUITER = ['A warm introduction to executive search firms and recruiters hiring for roles like yours', 'Priority placement in front of recruiters already searching NextChapter', 'Your Executive Dossier hand-delivered to a curated shortlist', "A recruiter's read on how your background is landing"]
const MARKET = ['Real posted comp bands for your target function, computed from our own job data', 'A target list of companies filtered by hiring trajectory, size, ownership and geography', 'Decision-maker mapping and warm-path contacts at the companies you want', 'A weekly brief on openings, comp movement and warm paths']

export function PremiumShort() {
  return (
    <PreviewShell place="account" entry="membership">
      <PremiumOffer coachLabel="Executive Coach" recruiterLabel="Executive Recruiter" coachIncluded={COACH} recruiterIncluded={RECRUITER} marketIncluded={MARKET} knownContact={{ email: 'maya@example.com', firstName: 'Maya', lastName: 'Patel' }} />
    </PreviewShell>
  )
}

const PROFILE = {
  id: 'me', firstName: 'Maya', lastName: 'Patel', phone: '', streetAddress: '', currentCity: 'Boston', currentState: 'MA', profileConfirmedAt: null,
  resumePrefilledFields: [], linkedInConfirmedAt: new Date(), linkedInUrl: 'https://www.linkedin.com/in/example', profilePictureUrl: null,
  highestEducationLevel: 'MASTERS', hasJD: false, hasMD: false, hasMBA: true, industryContext: 'Healthcare', industryConfirmedAt: null,
  primaryFunction: 'Operations', resumeLatestJobTitle: 'VP Operations', yearsExperience: 14, functionConfirmedAt: new Date(),
  lastSalary: 240000, salaryConfirmedAt: new Date(), resumeKeywords: ['supply chain', 'P&L'], canTeach: '',
}

export function PersonalShort() {
  return (
    <PreviewShell place="account" entry="profile">
      <div className="space-y-6">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">← My Profile</p>
          <h1 className="font-display text-3xl leading-tight font-semibold tracking-tight text-ink">My personal information</h1>
        </div>
        <PersonalInformationView profile={PROFILE as never} email="maya@example.com" />
      </div>
    </PreviewShell>
  )
}
