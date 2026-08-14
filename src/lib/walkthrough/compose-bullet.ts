import type { GuidedBulletAnswers } from './types'

// Template/format only — never an LLM free-rewrite (§13.1: "guided
// extraction, not rewriting"). A blank answer is omitted entirely rather
// than papered over with a placeholder, per the "never fabricate a number"
// rule: if the candidate doesn't answer a question, that clause just isn't
// part of the bullet.
export function composeBulletFromAnswers(answers: GuidedBulletAnswers): string {
  const clauses = [answers.outcome, answers.scope, answers.elaboration]
    .map((clause) => clause?.trim().replace(/[.\s]+$/, ''))
    .filter((clause): clause is string => Boolean(clause))

  if (clauses.length === 0) return ''
  return clauses.join(' — ') + '.'
}
