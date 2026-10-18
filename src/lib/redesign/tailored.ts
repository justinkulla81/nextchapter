// "Improve your search": everything we use to tailor the site to a member, grouped by what it
// improves, with what each one changes and what would help most. Pure; the page loads the inputs.
// Facts are listed here once, with one place to change each (docs/personalization-audit/bundles.md).

import type { Signal } from '@/lib/personalization/signals'

export type CoachingStyle = 'TOUGH_LOVE' | 'GENTLE_ENCOURAGEMENT' | 'SOMEWHERE_IN_BETWEEN'

export interface TailoredInput {
  journeyLabel: string | null
  /** Week of the search, when there is one. */
  weekInSearch: number | null
  coachingStyle: CoachingStyle | null
  /** Job-matching signals (signals.ts), with their real payoffs. */
  signals: Signal[]
  relocationAnswered: boolean
  /** True or false once they have chosen; null until asked. */
  moneyHelp: boolean | null
  targetCompanies: number
  recruitersCanSee: boolean
  confidential: boolean
  skillsConfirmed: number
  skillsToBuild: number
  exploringOtherRoles: boolean
}

export interface TailoredRow {
  key: string
  label: string
  effect: string
  action: string
  /** What the main button says when this is the best next step. */
  cta: string
  href: string
  done: boolean
  /** Higher means it helps more. */
  weight: number
}

export interface TailoredGroup {
  title: string
  rows: TailoredRow[]
}

const STYLE_LABEL: Record<CoachingStyle, string> = {
  TOUGH_LOVE: 'Tell me straight',
  GENTLE_ENCOURAGEMENT: 'Gentle encouragement',
  SOMEWHERE_IN_BETWEEN: 'A mix of both',
}

export function buildTailored(i: TailoredInput): { groups: TailoredGroup[]; best: TailoredRow | null } {
  const journey: TailoredRow[] = [
    {
      key: 'journey',
      label: i.journeyLabel ? `Your journey: ${i.journeyLabel}${i.weekInSearch ? `, week ${i.weekInSearch}` : ''}` : 'Your journey: not set',
      effect: 'Sets your plan, your weekly target and which tools you see.',
      action: i.journeyLabel ? 'Change' : 'Choose',
      cta: 'Choose your journey',
      href: '/dashboard/privacy',
      done: !!i.journeyLabel,
      weight: 30,
    },
    {
      key: 'tone',
      label: i.coachingStyle ? `Tone: ${STYLE_LABEL[i.coachingStyle]}` : 'Tone: not chosen',
      effect: 'Changes how much we ask and how we say it.',
      action: i.coachingStyle ? 'Change' : 'Choose',
      cta: 'Choose your tone',
      href: '/dashboard/search-strategy',
      done: !!i.coachingStyle,
      weight: 20,
    },
  ]

  const jobs: TailoredRow[] = i.signals
    .filter((s) => s.key !== 'clearance' || s.known)
    .map((s) => ({
      key: `signal-${s.key}`,
      label: s.label,
      effect: s.effect.charAt(0).toUpperCase() + s.effect.slice(1) + '.',
      action: s.known ? 'Change' : 'Add',
      cta: s.known ? 'Change' : s.label,
      href: s.href,
      done: s.known,
      weight: s.weight,
    }))
  jobs.push({
    key: 'relocation',
    label: i.relocationAnswered ? 'Relocation: answered' : 'Relocation: not answered',
    effect: i.relocationAnswered ? 'Decides which other cities we search.' : 'Answering opens jobs in other cities.',
    action: i.relocationAnswered ? 'Change' : 'Answer',
    cta: 'Answer the relocation question',
    href: '/dashboard/search-strategy#relocation',
    done: i.relocationAnswered,
    weight: 12,
  })

  const people: TailoredRow[] = [
    {
      key: 'companies',
      label: i.targetCompanies > 0 ? `Target companies: ${i.targetCompanies}` : 'Target companies: none yet',
      effect: i.targetCompanies > 0 ? 'We look for who you know at each one.' : 'Naming a few lets us find who you know there.',
      action: i.targetCompanies > 0 ? 'Add more' : 'Add',
      cta: 'Add target companies',
      href: '/dashboard/companies',
      done: i.targetCompanies >= 3,
      weight: 18,
    },
  ]
  if (!i.confidential) {
    people.push({
      key: 'recruiters',
      label: i.recruitersCanSee ? 'Recruiters can find you: yes' : 'Recruiters can find you: no',
      effect: 'Controls whether recruiters in your field can see you.',
      action: 'Change',
      cta: 'Change who can find you',
      href: '/dashboard/privacy#recruiter-matching',
      done: i.recruitersCanSee,
      weight: 8,
    })
  }

  const learn: TailoredRow[] = [
    {
      key: 'skills',
      label: i.skillsConfirmed > 0 ? `Skills: ${i.skillsConfirmed} confirmed` : 'Skills: none confirmed',
      effect: 'Decides which skills and courses we suggest.',
      action: i.skillsConfirmed > 0 ? 'Review' : 'Confirm',
      cta: 'Confirm your skills',
      href: '/dashboard/skills-assessment',
      done: i.skillsConfirmed > 0,
      weight: 14,
    },
    {
      key: 'build',
      label: i.skillsToBuild > 0 ? `Skills to build: ${i.skillsToBuild}` : 'Skills to build: none chosen',
      effect: 'Picks the courses and shows the jobs each would open.',
      action: i.skillsToBuild > 0 ? 'Change' : 'Choose',
      cta: 'Choose skills to build',
      href: '/dashboard/learning',
      done: i.skillsToBuild > 0,
      weight: 10,
    },
    {
      key: 'direction',
      label: i.exploringOtherRoles ? 'Direction: exploring other roles' : 'Direction: same field',
      effect: 'Say if you want to see other roles you could do, and what each would take.',
      action: 'Explore',
      cta: 'Explore other roles',
      href: '/dashboard/pivot-paths',
      done: true,
      weight: 0,
    },
  ]

  const groups: TailoredGroup[] = [
    { title: 'Your journey and how you are doing', rows: journey },
    { title: 'Better jobs', rows: jobs },
    { title: 'Warmer introductions', rows: people },
    { title: 'Closer to hired', rows: learn },
  ]
  const open = groups.flatMap((g) => g.rows).filter((r) => !r.done)
  const best = open.sort((a, b) => b.weight - a.weight)[0] ?? null
  return { groups, best }
}
