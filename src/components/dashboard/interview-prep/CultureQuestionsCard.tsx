import Link from 'next/link'
import { interviewQuestions, offerChecks, parseCultureFit } from '@/lib/culture/culture-fit'

// Questions to ask, from what the member said matters about culture and working
// environment. Shows nothing at all if it does not matter to them.
export function CultureQuestionsCard({ cultureFit }: { cultureFit: unknown }) {
  const fit = parseCultureFit(cultureFit)
  const questions = interviewQuestions(fit)
  if (questions.length === 0) return null
  const checks = offerChecks(fit)
  return (
    <section aria-labelledby="culture-questions" className="space-y-3 rounded-lg border border-border p-4">
      <h2 id="culture-questions" className="text-base font-semibold">
        Questions to ask about culture
      </h2>
      <p className="text-sm text-muted-foreground">You said culture and working environment matter. Asking these shows you what the job is really like before you say yes.</p>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {questions.map((q) => (
          <li key={q}>{q}</li>
        ))}
      </ul>
      {checks.length > 0 && (
        <div>
          <h3 className="text-sm font-medium">Before you accept an offer</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {checks.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}
      <Link href="/dashboard/search-strategy" className="text-sm text-primary underline underline-offset-4">
        Change what matters
      </Link>
    </section>
  )
}
