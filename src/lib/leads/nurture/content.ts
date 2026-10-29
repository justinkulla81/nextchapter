import { LTU_JAN_AUG } from '@/lib/press/figures'
import { STATE_UI } from '@/lib/data/state-ui'
import { stateName, stateSlug } from '@/lib/seo/states'
import type { LeadEmailContent } from '@/lib/leads/lifecycle/content'
import type { NurtureStep } from './config'
import type { NurtureContext, NurtureTrack } from './tracks'

// The words of the sequence (see docs/LEAD_NURTURE.md). Plain and specific, one job and one button per email, every number
// from a source the site already publishes, no pressure. The three steps:
//   next_step   (day 3)  the single most useful next step, with a link to the exact page or tool
//   data_point  (day 7)  one number from our own public data that bears on their situation
//   assessment  (day 14) start the Market Reality Assessment; the link opens on their situation (the /start page), so
//                        the answer they already gave carries over
// No AI writes any of it: it is templates and a few figures.

export interface NurtureEmail extends LeadEmailContent {
  /** Where the one button goes, as a path on this site; the sender adds the origin and tracking. Null: no button. */
  ctaPath: string | null
}

/** The live figures the data-point emails quote. The runner reads them once per run; anything missing falls back. */
export interface NurtureFacts {
  /** The AI-skill advertised-pay premium over all live postings, from the snapshot (src/lib/skills/ai-market). */
  ai: { rawPct: number; likePct: number | null; nAi: number; nBase: number; asOf: string } | null
}

export const NO_FACTS: NurtureFacts = { ai: null }

const SENDER_FOOTER: Record<NurtureStep, string> = {
  next_step: 'This is the first of three short notes over two weeks, then we stop.',
  data_point: 'One more after this, then we stop.',
  assessment: 'This is the last note. After it we leave you alone.',
}

const hello = (c: NurtureContext) => (c.firstName ? `Hi ${c.firstName},` : 'Hi,')
const num = (n: number) => n.toLocaleString('en-US')

/** "May 3" style date from the snapshot's ISO date, for "as of". */
function asOfLabel(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })
}

/** State benefit figures from the sourced state data, or null when the state is missing or its numbers are unconfirmed. */
export function stateBenefit(code: string | null): { name: string; maxWeeks: number; maxWeekly: number | null; varies: boolean } | null {
  if (!code) return null
  const s = STATE_UI[code]
  const weeks = s?.maxWeeks?.value
  if (!s || typeof weeks !== 'number' || weeks <= 0) return null
  const weekly = s.maxWeeklyBenefit?.value
  return { name: stateName(code), maxWeeks: weeks, maxWeekly: typeof weekly === 'number' && weekly > 0 ? weekly : null, varies: s.durationVaries?.value === true }
}

const cobraPath = (c: NurtureContext) => (c.stateCode ? `/resources/cobra-aca/${stateSlug(c.stateCode)}` : '/resources/cobra-aca')
const benefitsPath = (c: NurtureContext) => (c.stateCode ? `/unemployment-benefits/${stateSlug(c.stateCode)}` : '/unemployment-benefits')
const startPath = (c: NurtureContext) => `/start/${c.personaSlug}`

const LTU_SENTENCE = (() => {
  const s = LTU_JAN_AUG.whiteCollarShare
  return `Among unemployed white-collar workers, ${s.y2026}% had been out of work 27 weeks or more in January to August 2026, up from ${s.y2025}% a year earlier (+${s.change} points, ±${s.margin90} at the 90% level).`
})()

/** "16.9% higher" / "3% lower": a gap in words, never a bare sign. */
const gap = (pct: number) => `${Math.abs(Math.round(pct * 10) / 10)}% ${pct < 0 ? 'lower' : 'higher'}`

function aiSentence(ai: NonNullable<NurtureFacts['ai']>): string {
  const lead =
    ai.likePct !== null
      ? `In the U.S. listings we read, postings that ask for a specific AI skill advertise pay ${gap(ai.likePct)} than similar postings that do not, matched on function, level and industry.`
      : `In the U.S. listings we read, postings that ask for a specific AI skill advertise pay ${gap(ai.rawPct)} than postings that never mention AI. That raw gap is not matched on level or industry.`
  return `${lead} It rests on ${num(ai.nAi)} paid postings that ask and ${num(ai.nBase)} that do not, as of ${asOfLabel(ai.asOf)}.`
}

const AI_CAUTION = 'That is advertised pay, not what anyone is paid, and it does not show that a skill causes a raise.'

const assessment = (c: NurtureContext, step: NurtureStep): NurtureEmail => ({
  subject: 'Where do you stand? Your Market Reality Assessment',
  headline: 'See how the market reads you',
  paragraphs: [
    hello(c),
    'Two weeks in, the most useful next step is to see where you stand: how a hiring manager scores you on 15 things, which gaps are worth closing first, and what you are worth. It takes about five minutes and it is free.',
    'The page below opens on your situation, so you do not answer that question again.',
  ],
  benefits: [],
  ctaLabel: 'Open your plan',
  ctaPath: startPath(c),
  footerNote: SENDER_FOOTER[step],
})

const ltuDataPoint = (c: NurtureContext, step: NurtureStep, extra: string[] = [], cta: { label: string; path: string } = { label: 'See the numbers', path: '/reports/white-collar-index' }): NurtureEmail => ({
  subject: 'How long searches are running now',
  headline: 'You are not the only one',
  paragraphs: [hello(c), LTU_SENTENCE, ...extra, 'We publish the method and the data.'],
  benefits: [],
  ctaLabel: cta.label,
  ctaPath: cta.path,
  footerNote: SENDER_FOOTER[step],
})

const aiDataPoint = (c: NurtureContext, step: NurtureStep, facts: NurtureFacts): NurtureEmail => {
  if (!facts.ai) return ltuDataPoint(c, step)
  return {
    subject: 'What employers advertise for AI skills',
    headline: 'The AI pay gap in live listings',
    paragraphs: [hello(c), aiSentence(facts.ai), AI_CAUTION, 'We publish the method and a table you can download.'],
    benefits: [],
    ctaLabel: 'See the table and method',
    ctaPath: '/resources/ai-skills-pay-premium',
    footerNote: SENDER_FOOTER[step],
  }
}

/** The email for a track and step. Pure: the same inputs give the same words, so it is tested and reviewable. */
export function nurtureContent(track: NurtureTrack, step: NurtureStep, c: NurtureContext, facts: NurtureFacts = NO_FACTS): NurtureEmail {
  if (step === 'assessment') {
    // "Before you need it" fits someone watching layoffs or who ran the risk check, not someone going for a promotion.
    if (track === 'layoff_watch' || c.source.startsWith('layoff_risk_check')) return { ...assessment(c, step), subject: 'Before you need it: your Market Reality Assessment' }
    return assessment(c, step)
  }

  const footerNote = SENDER_FOOTER[step]

  switch (track) {
    case 'laid_off': {
      if (step === 'next_step') {
        const place = c.stateCode ? stateName(c.stateCode) : null
        return {
          subject: 'Two deadlines after a layoff, side by side',
          headline: 'Two clocks are running on your health coverage',
          paragraphs: [
            hello(c),
            'Health coverage has deadlines. You generally have 60 days to elect COBRA, and a 60-day window to join a marketplace plan after losing job coverage. Which one costs less depends on your income and where you live.',
            place ? `Our ${place} page puts COBRA and a marketplace plan side by side, with the cost math and who should pick which.` : 'Our guide puts COBRA and a marketplace plan side by side, with the cost math and who should pick which.',
          ],
          benefits: [],
          ctaLabel: 'Compare COBRA and ACA',
          ctaPath: cobraPath(c),
          footerNote,
        }
      }
      const benefit = stateBenefit(c.stateCode)
      const extra = benefit
        ? [
            `${benefit.name} pays up to ${benefit.maxWeeks} weeks of regular unemployment benefits${benefit.maxWeekly ? `, at most $${num(benefit.maxWeekly)} a week` : ''}${benefit.varies ? ' (the length can vary)' : ''} (U.S. Department of Labor, July 2026), so a long search can outlast them.`,
          ]
        : []
      return ltuDataPoint(c, step, extra, benefit ? { label: `See ${benefit.name} benefits`, path: benefitsPath(c) } : undefined)
    }

    case 'searching': {
      if (step === 'next_step') {
        return {
          subject: 'Cover the bills while you keep looking',
          headline: 'Bridge income',
          paragraphs: [hello(c), 'A search often takes longer than people plan for. Our bridge income guide covers ways to bring in income while you search, without derailing it.'],
          benefits: [],
          ctaLabel: 'Read the bridge income guide',
          ctaPath: '/resources/bridge-income',
          footerNote,
        }
      }
      return ltuDataPoint(c, step)
    }

    case 'considering': {
      if (step === 'next_step') {
        if (c.source.startsWith('layoff_risk_check')) {
          return {
            subject: 'Know your runway before you need it',
            headline: 'How long could you cover?',
            paragraphs: [
              hello(c),
              'You looked at your layoff risk. The other half is runway: how many months your savings and any severance would cover, and what unemployment benefits would add in your state.',
              'The runway tool works it out from your own numbers. It is free and nothing is saved.',
            ],
            benefits: [],
            ctaLabel: 'Work out my runway',
            ctaPath: '/tools/layoff-runway',
            footerNote,
          }
        }
        return {
          subject: 'Is your pay in line with the market?',
          headline: 'Check your pay against live listings',
          paragraphs: [hello(c), 'Before you move, or ask for more, it helps to know what the market is paying. Our pay check compares your salary with the ranges employers advertise on live listings for your kind of role.'],
          benefits: [],
          ctaLabel: 'Check my pay',
          ctaPath: '/tools/pay-check',
          footerNote,
        }
      }
      return aiDataPoint(c, step, facts)
    }

    case 'changing': {
      if (step === 'next_step') {
        if (c.personaSlug === 'new-grad') {
          return {
            subject: 'Jobs that train you',
            headline: 'Roles that do not ask for experience',
            paragraphs: [hello(c), 'Many first jobs list years of experience as a requirement. Our no-experience page shows the roles that say they will train you, so you can spend your applications where they count.'],
            benefits: [],
            ctaLabel: 'See roles that train',
            ctaPath: '/noexperience',
            footerNote,
          }
        }
        return {
          subject: 'See what the next field pays and asks for',
          headline: 'Look at the field before you leap',
          paragraphs: [hello(c), 'A move into a new field starts with what it pays and what it asks for. Each job title page shows the openings, the pay employers state, and where the roles are.'],
          benefits: [],
          ctaLabel: 'Browse job titles',
          ctaPath: '/jobs/title',
          footerNote,
        }
      }
      return aiDataPoint(c, step, facts)
    }

    case 'layoff_watch': {
      if (step === 'next_step') {
        return {
          subject: 'What a layoff notice gives you',
          headline: 'Know your rights before the notice',
          paragraphs: [
            hello(c),
            'You asked to hear about layoff notices. If one is ever yours, the federal WARN Act generally requires 60 days of notice from covered employers. Our guide explains who is covered, the exceptions, and what a state law can add.',
          ],
          benefits: [],
          ctaLabel: 'Read the WARN Act guide',
          ctaPath: '/resources/warn-act',
          footerNote,
        }
      }
      return ltuDataPoint(c, step)
    }

    case 'pay': {
      if (step === 'next_step') {
        return {
          subject: 'Your pay check, with the full range',
          headline: 'See the whole range',
          paragraphs: [hello(c), 'Your pay check compared you with one number. The page for your kind of job shows the full range employers advertise, by state, and the openings behind it.'],
          benefits: [],
          ctaLabel: 'See the pay page',
          ctaPath: c.titleSlug ? `/salaries/${c.titleSlug}` : '/salaries',
          footerNote,
        }
      }
      return aiDataPoint(c, step, facts)
    }
  }
}
