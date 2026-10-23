// Learn in the redesign: why the featured course is first, from how much AI use is observed in the member's
// occupation (Anthropic Economic Index, src/lib/skills/ai-exposure.ts) plus what postings ask for. Pure, so the
// wording rules are tested without the database. Never "safe", "risk", "replaced" or "will lose".
import { RETRAINING_LINE, exposureSentence, retrainingNeed, type OccupationExposure, type RetrainingNeed } from '@/lib/skills/ai-exposure'
import { functionCode } from '@/lib/skills/ai-skill-market'
import { asOfText, type AiMarketData } from '@/lib/skills/ai-market'

export const WHY_FOOTNOTE = 'Exposure is from real usage and is not a forecast of job loss. Openings are what postings ask for, not a test of you.'

/** "31% of Finance openings on our board ask for a specific AI skill.", or null when the board has too few postings for the function. */
export function aiShareSentence(fn: string | null | undefined, live: AiMarketData | null | undefined): string | null {
  const code = functionCode(fn)
  const f = code ? live?.functions[code] : undefined
  if (!f || f.n < 200) return null
  return `${Math.round(f.sharePct)}% of ${f.label} openings on our board ask for a specific AI skill.`
}

/** The AI pay premium line, from the note aiPayNoteFor already vets (raw and like-for-like both higher). */
export function aiPaySentence(note: { fnLabel: string; phrase: string; asOf: string } | null | undefined): string | null {
  return note ? `Where ${note.fnLabel} openings ask for an AI skill, ${note.phrase}. Posted pay only, as of ${asOfText(note.asOf)}.` : null
}

export interface LearnWhy {
  need: RetrainingNeed
  lead: string
  facts: string[]
  /** The explanation under the facts; null when there is nothing measured to explain. */
  footnote: string | null
  /** The Anthropic Economic Index credit goes with any exposure figure and only then. */
  showCredit: boolean
}

export function learnWhyFirst(input: { exposure: OccupationExposure | null; shareLine: string | null; payLine: string | null }): LearnWhy {
  const { exposure } = input
  const need = retrainingNeed(exposure)
  if (!exposure) return { need, lead: RETRAINING_LINE.unknown, facts: [], footnote: null, showCredit: false }
  if (need === 'optional') {
    return { need, lead: RETRAINING_LINE.optional, facts: [exposureSentence(exposure), 'We do not put an AI course first for this role.'], footnote: WHY_FOOTNOTE, showCredit: true }
  }
  const facts = [exposureSentence(exposure), input.shareLine, input.payLine].filter((x): x is string => !!x)
  return { need, lead: RETRAINING_LINE[need], facts, footnote: WHY_FOOTNOTE, showCredit: true }
}

/** The AI Training section description in the full library: replaces the generic market line. Unknown keeps the old line. */
export function aiTrainingWhy(exposure: OccupationExposure | null, fallbackLine: string): string {
  const need = retrainingNeed(exposure)
  if (!exposure) return `${RETRAINING_LINE.unknown} ${fallbackLine}`
  return `${RETRAINING_LINE[need]} ${exposureSentence(exposure)}`
}
