import { ORG_SUBDOMAINS_ON, orgOrigin } from '@/lib/org-hosts'
import { PORTAL_ORDER, type PortalKey } from '@/lib/marketing/plans'

// The seven partner portals as the public site describes them: one card each on
// https://launchyournextchapter.com/for-organizations, each linking to its page and its log in.
// Plans live in plans.ts and are never repeated here. Names only, no amounts.

export interface PortalInfo {
  key: PortalKey
  name: string
  route: string
  /** Who it is for, one line. */
  who: string
  /** What they get, three lines at most, each stating something the product does today. */
  gets: string[]
  /** What it costs the buyer to start, in words. Never an amount. */
  start: string
  loginHref: string
  loginLabel: string
}

// College and workforce portals live on their own host when org subdomains are on (src/lib/org-hosts.ts).
const orgLogin = (kind: 'highered' | 'workforce') => (ORG_SUBDOMAINS_ON ? `${orgOrigin(kind)}/login` : `/${kind}/login`)

export const PORTALS: Record<PortalKey, PortalInfo> = {
  higher_education: {
    key: 'higher_education',
    name: 'Higher education',
    route: '/higher-education',
    who: 'Career services, alumni relations, development, executive education and administration.',
    gets: [
      'A workspace for your alumni and students, with your name and your services.',
      'Caseloads, alumni jobs, outcomes and layoff alerts in one place.',
      'A free workspace after a verified claim at your email domain.',
    ],
    start: 'Free workspace, then paid plans',
    loginHref: orgLogin('highered'),
    loginLabel: 'Higher education log in',
  },
  workforce: {
    key: 'workforce',
    name: 'Workforce and economic development',
    route: '/government-workforce',
    who: 'Workforce boards, economic development organizations and chambers. Nonprofits and community organizations can use it too.',
    gets: [
      'A program workspace for the job seekers in your region.',
      'Member companies, layoff sign-up pages and seats you can give out.',
      'A free workspace after a verified claim at your email domain.',
    ],
    start: 'Free workspace, then paid plans',
    loginHref: orgLogin('workforce'),
    loginLabel: 'Workforce log in',
  },
  hiring: {
    key: 'hiring',
    name: 'Hiring',
    route: '/talent',
    who: 'Employers hiring future employees.',
    gets: [
      'Post a role and see candidates matched on what they say they are looking for.',
      'An evidence brief for each candidate who chose to be seen.',
      'Ask for introductions. Candidates decide who sees what.',
    ],
    start: 'Post a role free, then team plans',
    loginHref: '/talent/login',
    loginLabel: 'Hiring log in',
  },
  employees: {
    key: 'employees',
    name: 'Employees',
    route: '/employees',
    who: 'Employers developing and keeping current employees.',
    gets: [
      'Retention: promotion and raise preparation, internal roles and paths into new functions.',
      'Learning and development: a skills plan for each person, starting with your courses.',
      'You see counts by team, never who.',
    ],
    start: 'Set up with you',
    loginHref: '/employer/login',
    loginLabel: 'Employer log in',
  },
  outplacement: {
    key: 'outplacement',
    name: 'Outplacement',
    route: '/outplacement',
    who: 'Employers supporting people who are leaving.',
    gets: [
      'A seat for each person leaving, with a Dossier they keep.',
      'Reporting in counts, with small groups held back.',
      'A compliance record for each seat.',
    ],
    start: 'By contract',
    loginHref: '/employer/login',
    loginLabel: 'Employer log in',
  },
  recruiters: {
    key: 'recruiters',
    name: 'Recruiters',
    route: '/recruiters',
    who: 'Search firms, agencies and in-house recruiters.',
    gets: [
      'Search candidates who opted in to be found.',
      'A submission packet in your firm’s logo, built from the Dossier.',
      'A résumé intake page in your logo.',
    ],
    start: 'Free for now',
    loginHref: '/recruiters/login',
    loginLabel: 'Recruiter log in',
  },
  coaches: {
    key: 'coaches',
    name: 'Coaches',
    route: '/coaches',
    who: 'Independent career coaches and coaching practices.',
    gets: [
      'Invite clients with a code. You keep billing them your way.',
      'A prep page before each session, from what each client shares.',
      'Session notes and follow-ups in one place.',
    ],
    start: 'Free for now',
    loginHref: '/support/coach/login',
    loginLabel: 'Coach log in',
  },
}

export const PORTAL_LIST: PortalInfo[] = PORTAL_ORDER.map((k) => PORTALS[k])

/** The three employer sections, in lifecycle order. */
export const EMPLOYER_SECTIONS: PortalKey[] = ['hiring', 'employees', 'outplacement']
