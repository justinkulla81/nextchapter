import { pageSeo } from '@/lib/seo/keywords'
import { PORTALS } from '@/lib/marketing/portals'
import { shot } from '@/lib/marketing/screenshots'
import type { PortalPageDef } from './types'

// /outplacement: the Outplacement section of the employer lifecycle (departing employees). Contract-based and sales-led,
// so every plan says "Talk to us" and there is no self-serve sign-up. The title keeps the page's earlier search title.
// No placement-rate or speed claim for NextChapter (docs/COMPETITIVE_CLAIMS_SUBSTANTIATION.md, rows 18 and 19), and no
// price or cost wording (owner decision 2026-10-23).

const reporting = shot('outplacement-reporting', {
  title: 'Reporting for HR',
  alt: 'An outplacement reporting view for a sample cohort showing seats, activated seats, activation rate, engagement and time to placement by function and level.',
  why: 'Reporting is in aggregate, so HR sees how the program is running without any individual being identifiable from the numbers.',
})
const roster = shot('outplacement-roster', {
  title: 'Roster',
  alt: 'An outplacement roster grouped by cohort showing who holds a seat, whether it is activated, invited or not yet invited, and when the term ends.',
  why: 'It shows who holds a seat and whether the seat is in use. It never shows anyone’s activity, grade or progress.',
})
const compliance = shot('outplacement-compliance', {
  title: 'Compliance record',
  alt: 'A compliance record for one seat with the contract term, enrollment, activation and placement dates and a statement that it holds no job search activity.',
  why: 'Legal gets a record for each seat showing the outplacement benefit was made available, and it holds no job search, assessment or engagement detail.',
})

export const OUTPLACEMENT: PortalPageDef = {
  seo: {
    ...pageSeo('/outplacement'),
    path: '/outplacement',
    image: { src: reporting.src, width: reporting.width, height: reporting.height, alt: reporting.alt },
  },
  content: {
    analyticsKey: 'outplacement',
    path: '/outplacement',
    eyebrow: 'Outplacement',
    headline: 'Outplacement that leaves each person with a Dossier they keep',
    subhead:
      'Give each person leaving a seat with job search tools and a Dossier that stays theirs. HR sees reporting in counts, and legal gets a compliance record for each seat.',
    primary: { label: 'Talk to us', href: '#talk' },
    primaryNote: 'Outplacement is set up by contract with our team.',
    loginHref: PORTALS.outplacement.loginHref,
    parent: { href: '/employers', label: 'For employers' },
    proof: {
      kind: 'sample',
      heading: 'What your HR team sees',
      intro: 'This is reporting for a cohort as an HR team opens it. Northwind Foods and the numbers are invented.',
    },
    visuals: [reporting, roster, compliance],
    steps: [
      {
        title: 'Talk to us',
        body: 'We scope the program with you by contract: the plan, the number of seats and the term.',
      },
      {
        title: 'Enroll the people leaving',
        body: 'Add people one at a time or upload a list. Each person gets an invitation, a seat and a Dossier that is theirs to keep.',
      },
      {
        title: 'Track the program and keep the record',
        body: 'Follow seats and engagement in counts, and download the compliance record for each seat for your legal team.',
      },
    ],
    plansFor: ['outplacement'],
    plansIntro: 'Outplacement is set up by contract, and each plan below is a starting point we scope with you. Talk to us about it.',
    faq: [
      {
        q: 'Do you publish a placement rate?',
        a: 'No. We do not state a placement rate or a speed until we have outcome data to back it. Reporting shows seats, activation and engagement for your own cohorts, and time to placement once enough people have recorded a placement.',
      },
      {
        q: 'What can HR see about each person?',
        a: 'Who holds a seat and whether it is in use. HR never sees anyone’s activity, grade or progress. Reporting is in aggregate, and small cohorts are held back, rounded or reported quarterly so no individual can be identified.',
      },
      {
        q: 'What does legal get?',
        a: 'A record for each seat showing the outplacement benefit was made available and, where dated, activated or placed. It holds no job search, assessment or engagement detail.',
      },
      {
        q: 'What happens to a person’s access when the contract ends?',
        a: 'The Dossier, the references and an alumni account stay theirs. Your company’s reporting access ends with the contract term.',
      },
      {
        q: 'Do you cover a reduction across many countries?',
        a: 'NextChapter is built for reductions in the United States. If you are reducing across many countries with local labor-law needs, a provider with a global footprint may fit better.',
      },
      {
        q: 'Where can I read about security and data handling?',
        a: 'On https://launchyournextchapter.com/security, which includes our current SOC 2 status.',
      },
    ],
    asset: 'outplacement-rfp-kit',
    finalCta: {
      title: 'Talk to us about outplacement',
      intro: 'Tell us about the reduction you are planning or the program you run. We will show the reporting and the compliance record on your own seat count.',
      form: { audience: 'ORGANIZATION', source: 'outplacement', heading: 'Talk to us' },
    },
    footerLinks: [
      { href: '/employers', label: 'For employers' },
      { href: '/vs', label: 'Compare providers' },
      { href: '/rfp-template', label: 'RFP template' },
      { href: '/insights', label: 'Insights' },
      { href: '/ai-training', label: 'AI training for your people' },
    ],
    jsonLd: {
      serviceName: 'Outplacement',
      serviceType: 'Outplacement',
      audienceType: 'Employers with departing employees',
      description:
        'Outplacement for departing employees: a Dossier each person keeps, reporting in counts for HR and a compliance record for each seat for legal.',
      trail: [
        { name: 'For employers', path: '/employers' },
        { name: 'Outplacement', path: '/outplacement' },
      ],
    },
  },
}
