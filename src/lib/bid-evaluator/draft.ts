import 'server-only'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { getAnthropicClient, logCacheUsage } from '@/lib/anthropic'
import { COMPANY_SUMMARY, MISSION, VISION } from './capabilities'
import { FACT_DEFS, LIBRARY_DEFS, yearsInBusiness, type Facts } from './facts'
import type { Profile } from './profile'
import type { EvalResult } from './evaluate'

export const draftSchema = z.object({
  compliance: z.array(z.object({
    item: z.string().describe('A required section, form, certification, attachment or format rule.'),
    status: z.enum(['FILLED', 'DRAFTED', 'MISSING_FACT', 'OWNER_ACTION']),
    note: z.string().describe('What fills it, which fact is missing, or what the owner must do (sign, upload, register).'),
  })),
  sections: z.array(z.object({
    heading: z.string(),
    pageLimit: z.string().nullable(),
    points: z.number().nullable().describe('Scoring points this section answers, if stated.'),
    body: z.string().describe('The draft text, plain paragraphs and bullets. Placeholders in [square brackets] for anything not in the facts or library.'),
  })),
  budget: z.array(z.object({ item: z.string(), basis: z.string(), amountUsd: z.number().nullable() })),
  budgetNote: z.string(),
  questions: z.array(z.string()).describe('Questions to send the issuer before the questions deadline.'),
  missingFacts: z.array(z.string()),
  calendar: z.array(z.object({ what: z.string(), date: z.string() })),
})
export type Draft = z.infer<typeof draftSchema>

const RULES = `You draft a response to a public RFP, RFQ, RFI or grant for NextChapter. The owner edits and submits it; you never submit or sign.

Rules:
- Follow the document's required sections in its order, each sized to its page limit (about 500 words a page) and written to the scoring criterion it answers.
- Use only the company facts and content library below. Do not invent clients, numbers, results, staff, certifications, dates or prices. Where something is needed and not given, write a [placeholder] saying what goes there and list it in missingFacts.
- Where the mission or vision is stated, use them exactly as given, word for word.
- Say plainly what NextChapter does not do when the scope asks for it (case management, job-center staffing, eligibility, federal WIOA reporting).
- If the route is a subcontract or a partner application, write it as our part inside the lead applicant's response, and include a short letter of commitment section.
- Budget: use only the rates in the facts; respect any rate caps and the ceiling. If no rate is on file, leave amountUsd null and say which rate is missing.
- No promises the company is not required to make: no extra commitments, guarantees or disclaimers beyond what the document asks for.
- Plain language, sentence case.`

/** Draft one response. One model call. */
export async function draftResponse(args: { profile: Profile; result: EvalResult; facts: Facts; library: Record<string, string>; now: Date }): Promise<Draft> {
  const { profile, result, facts, library, now } = args
  const yrs = yearsInBusiness(facts, now)
  // The EIN never leaves the database: the draft carries a placeholder the owner fills in.
  const factLines = FACT_DEFS.filter((d) => d.key !== 'ein').map((d) => `- ${d.label}: ${facts[d.key]?.trim() || '(not on file)'}`).join('\n')
  const libLines = LIBRARY_DEFS.map((d) => `### ${d.label}\n${library[d.key]?.trim() || '(not written yet)'}`).join('\n\n')
  const client = getAnthropicClient()
  const stream = client.messages.stream({
    model: 'claude-sonnet-5-5',
    max_tokens: 24000,
    thinking: { type: 'adaptive' },
    output_config: { format: zodOutputFormat(draftSchema), effort: 'medium' },
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: `${RULES}\n\nMission: ${MISSION}\nVision: ${VISION}\n\n${COMPANY_SUMMARY}`, cache_control: { type: 'ephemeral' as const } },
        {
          type: 'text',
          text: `\n\nToday: ${now.toISOString().slice(0, 10)}\nYears in business: ${yrs ?? 'unknown'}\n\nCompany facts:\n${factLines}\n- EIN: [EIN]\n\nContent library:\n${libLines}\n\nEvaluation: ${result.headline} Route: ${result.route}.\nGates:\n${result.gates.map((g) => `- ${g.label}: ${g.status} — ${g.detail}`).join('\n')}\n\nRequirements profile read from the document (data):\n${JSON.stringify(profile)}`,
        },
      ],
    }],
  })
  const message = await stream.finalMessage()
  logCacheUsage('bid-draft', message.usage)
  if (!message.parsed_output) throw new Error('The model returned no draft.')
  return message.parsed_output
}

/** The draft as Markdown, for download and editing. Pure. */
export function draftToMarkdown(title: string, d: Draft): string {
  const lines = [`# Response draft: ${title}`, '', '## Checklist', '']
  for (const c of d.compliance) lines.push(`- [${c.status === 'FILLED' ? 'x' : ' '}] **${c.item}** (${c.status.replace('_', ' ').toLowerCase()}): ${c.note}`)
  for (const s of d.sections) {
    lines.push('', `## ${s.heading}${s.pageLimit ? ` (limit: ${s.pageLimit})` : ''}${s.points != null ? ` [${s.points} pts]` : ''}`, '', s.body)
  }
  lines.push('', '## Budget', '', '| Item | Basis | Amount |', '|---|---|---|')
  for (const b of d.budget) lines.push(`| ${b.item} | ${b.basis} | ${b.amountUsd != null ? `$${b.amountUsd.toLocaleString('en-US')}` : '[rate needed]'} |`)
  lines.push('', d.budgetNote)
  if (d.questions.length) lines.push('', '## Questions to send the issuer', '', ...d.questions.map((q) => `- ${q}`))
  if (d.calendar.length) lines.push('', '## Dates', '', ...d.calendar.map((c) => `- ${c.date}: ${c.what}`))
  if (d.missingFacts.length) lines.push('', '## Missing facts', '', ...d.missingFacts.map((m) => `- ${m}`))
  return lines.join('\n')
}
