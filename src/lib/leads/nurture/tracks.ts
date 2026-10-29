import { GUIDES } from '@/lib/constants/guides'
import { getPersona } from '@/lib/constants/personas'
import { ALL_STATE_CODES } from '@/lib/seo/states'

// Which of the six short sequences a lead gets, from what they gave us. One address gets one track. The track decides the
// wording and the links; the persona slug decides where the last email sends them (the /start/<persona> page, whose
// button carries their situation into onboarding, so they do not answer it twice).

export type NurtureTrack = 'laid_off' | 'searching' | 'considering' | 'changing' | 'layoff_watch' | 'pay'
export type NurtureLeadKind = 'journey' | 'deadline' | 'layoff_alert' | 'pay_check' | 'guide'

export interface NurtureContext {
  /** A real persona slug (src/lib/constants/personas.ts): the /start page the last email links to. */
  personaSlug: string
  firstName: string | null
  /** Two-letter state code when the lead gave one. */
  stateCode: string | null
  /** The employer layoff-page slug a watcher chose. */
  employerSlug: string | null
  /** The job-title slug of a pay check. */
  titleSlug: string | null
  /** Which box the lead came through (a cobra_vs_aca:*, unemployment:*, severance:*, layoff_risk_check, warn_act source…). */
  source: string
  /** How long it has been going on, from the journey picker (just_starting | weeks | months | long). */
  followup: string | null
}

const TRACK_OF_PERSONA: Record<string, NurtureTrack> = {
  'laid-off': 'laid_off',
  resigned: 'searching',
  'searching-too-long': 'searching',
  'thinking-about-a-move': 'considering',
  'managing-my-career': 'considering',
  promotion: 'considering',
  returning: 'considering',
  'career-change': 'changing',
  'new-grad': 'changing',
  'next-act': 'changing',
  'taking-a-break': 'changing',
  'happy-with-fractional-work': 'changing',
  'building-something': 'changing',
}

export function trackOfPersona(slug: string): NurtureTrack | null {
  const persona = getPersona(slug)
  return persona ? (TRACK_OF_PERSONA[persona.slug] ?? null) : null
}

const stateOf = (code: string | null | undefined): string | null => {
  const c = (code ?? '').trim().toUpperCase()
  return (ALL_STATE_CODES as readonly string[]).includes(c) ? c : null
}

export interface RawLead {
  kind: NurtureLeadKind
  /** HomepageLead.situation for a journey (the persona slug); the last day of work for a deadline lead. */
  situation?: string | null
  source?: string | null
  searchQ?: string | null
  searchLoc?: string | null
  followup?: string | null
  guideSlug?: string | null
  firstName?: string | null
}

export interface Classified {
  track: NurtureTrack
  context: NurtureContext
}

/** The track and context for a lead, or null when it does not belong in any sequence (an unknown persona, say). */
export function classifyLead(raw: RawLead): Classified | null {
  const source = (raw.source ?? '').trim()
  const base = { firstName: raw.firstName?.trim() || null, stateCode: null as string | null, employerSlug: null as string | null, titleSlug: null as string | null, source, followup: raw.followup?.trim() || null }

  if (raw.kind === 'journey') {
    const persona = getPersona((raw.situation ?? '').trim())
    const track = persona ? trackOfPersona(persona.slug) : null
    if (!persona || !track) return null
    return { track, context: { ...base, personaSlug: persona.slug } }
  }

  if (raw.kind === 'deadline') {
    return { track: 'laid_off', context: { ...base, personaSlug: 'laid-off', stateCode: stateOf(raw.searchLoc) } }
  }

  if (raw.kind === 'layoff_alert') {
    const employer = (raw.searchQ ?? '').trim()
    const context = { ...base, personaSlug: 'thinking-about-a-move', stateCode: stateOf(raw.searchLoc), employerSlug: /^[a-z0-9-]+$/.test(employer) && employer ? employer : null }
    // The risk check is for people who are still employed and wondering; the watchers follow the news.
    return { track: source.startsWith('layoff_risk_check') ? 'considering' : 'layoff_watch', context }
  }

  if (raw.kind === 'pay_check') {
    const title = (raw.searchQ ?? '').trim()
    return { track: 'pay', context: { ...base, personaSlug: 'managing-my-career', titleSlug: /^[a-z0-9-]+$/.test(title) && title ? title : null } }
  }

  if (raw.kind === 'guide') {
    const guide = GUIDES.find((g) => g.slug === raw.guideSlug)
    if (!guide) return null
    const forLaidOff = guide.situations?.includes('LAID_OFF') ?? false
    return forLaidOff
      ? { track: 'laid_off', context: { ...base, personaSlug: 'laid-off' } }
      : { track: 'considering', context: { ...base, personaSlug: 'managing-my-career' } }
  }

  return null
}

/** When two leads share an address, the one that says the most about where the person is wins. */
export const KIND_PRIORITY: NurtureLeadKind[] = ['journey', 'deadline', 'layoff_alert', 'pay_check', 'guide']
