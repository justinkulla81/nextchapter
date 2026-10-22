import Link from 'next/link'
import { AEI_SOURCE_URL } from '@/lib/aei/job-exposure'
import type { SkillAiUse } from '@/lib/aei/skills'

// "How people use AI on your skills" (Anthropic Economic Index, src/lib/aei/skills.ts): which of the
// member's skills AI mostly augments (learn to use AI on them) and which it mostly automates. A note
// inside an existing card or section, never a card of its own. Renders nothing when no skill maps.

const names = (rows: SkillAiUse[]) =>
  rows.map((r) => (r.yourLabel.toLowerCase() === r.skill.toLowerCase() ? r.skill : `${r.skill} (your “${r.yourLabel}”)`)).join(', ')

export function SkillAiUseNote({ use, learnHref }: { use: { automated: SkillAiUse[]; augmented: SkillAiUse[] }; learnHref?: string }) {
  if (use.automated.length === 0 && use.augmented.length === 0) return null
  return (
    <div className="space-y-1.5 rounded-lg border border-border p-4 text-sm" data-skill-ai-use>
      <p className="font-semibold text-ink">How people use AI on your skills</p>
      {use.augmented.length > 0 && (
        <p className="text-ink">
          <span className="font-medium">AI mostly augments:</span> {names(use.augmented)}. People use AI alongside them on this work, so learning to use AI on
          these skills is the fastest gain.{' '}
          {learnHref && (
            <Link href={learnHref} className="text-primary underline underline-offset-4">
              AI training for your field
            </Link>
          )}
        </p>
      )}
      {use.automated.length > 0 && (
        <p className="text-ink">
          <span className="font-medium">AI mostly automates:</span> {names(use.automated)}. People already hand whole tasks in this work to AI.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        From Claude conversations on the tasks that use each skill (
        <a href={AEI_SOURCE_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
          Anthropic Economic Index
        </a>
        , June 2026 release). It shows how AI is used on the work, not whether a job goes away.
      </p>
    </div>
  )
}
