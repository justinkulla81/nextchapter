import { TrackedLink } from '@/components/dashboard/TrackedLink'
import { courseForAiSkill, defaultCourseForAiSkill } from '@/lib/learning/ai-course-tags'
import { functionCode } from '@/lib/skills/ai-skill-market'
import { asOfText, paysMore, premiumPhrase, type AiMarketData } from '@/lib/skills/ai-market'
import { aiSkillItem } from '@/lib/skills/ai-skills'

export interface AiPayNoteView {
  fn: string
  fnLabel: string
  /** "posted pay is $32.5k (26%) higher raw, about 21% higher like-for-like (same level and industry)" */
  phrase: string
  nAi: number
  nBase: number
  asOf: string
  likePct: number
  skills: { id: string; label: string; course: { title: string; url: string } | null }[]
}

/**
 * The note for the member's function, or null: shown only when the live board's like-for-like
 * comparison says AI-skill postings pay more (raw and like-for-like, never one alone).
 */
export function aiPayNoteFor(fn: string | null | undefined, live: AiMarketData | null, catalog: { title: string; url: string }[] = []): AiPayNoteView | null {
  const code = functionCode(fn)
  const f = code ? live?.functions[code] : undefined
  if (!code || !f || !paysMore(f.premium)) return null
  const phrase = premiumPhrase(f.premium)
  if (!phrase) return null
  const skills = f.topItems
    .filter((i) => aiSkillItem(i.id))
    .slice(0, 3)
    .map((i) => {
      const course = courseForAiSkill(i.id, catalog) ?? defaultCourseForAiSkill(i.id)
      return { id: i.id, label: aiSkillItem(i.id)!.label, course: course ? { title: course.title, url: course.url } : null }
    })
  return { fn: code, fnLabel: f.label, phrase, nAi: f.premium!.nAi, nBase: f.premium!.nBase, asOf: live!.asOf, likePct: f.premium!.likePct!, skills }
}

/** "AI pays more in your field": the premium (raw and like-for-like) and the top 3 AI skills to learn, each with its tagged course. */
export function AiPaysMoreNote({ note, surface }: { note: AiPayNoteView; surface: string }) {
  return (
    <div className="space-y-2 rounded-lg border border-border p-4">
      <h3 className="text-sm font-semibold">AI pays more in {note.fnLabel}</h3>
      <p className="text-sm text-muted-foreground">
        In {note.fnLabel} jobs on our board that ask for a specific AI skill, {note.phrase}. Posted pay only ({note.nAi.toLocaleString()} AI and{' '}
        {note.nBase.toLocaleString()} comparison postings), as of {asOfText(note.asOf)}.
      </p>
      {note.skills.length > 0 && (
        <div className="text-sm">
          <p className="font-medium">The AI skills these jobs ask for most:</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5">
            {note.skills.map((s) => (
              <li key={s.id}>
                {s.label}
                {s.course && (
                  <>
                    {' · '}
                    <TrackedLink
                      href={s.course.url}
                      external
                      event="ai_pay_note_course_clicked"
                      properties={{ surface, fn: note.fn, skill: s.id, courseUrl: s.course.url, likePct: note.likePct }}
                      className="text-primary underline underline-offset-4"
                    >
                      {s.course.title}
                    </TrackedLink>
                  </>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
