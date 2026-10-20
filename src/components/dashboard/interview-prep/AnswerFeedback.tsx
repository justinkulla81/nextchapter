import type { PracticeEvaluation } from '@/lib/interview-prep/evaluate-practice-answer'

// Victoria's read on one drafted or typed answer, at reading size, for the redesigned interview tabs.
// The legacy tabs keep their own small boxed version.
export function AnswerFeedback({ evaluation }: { evaluation: PracticeEvaluation }) {
  return (
    <div className="max-w-2xl space-y-3 rounded-2xl border border-border p-5 text-base text-ink">
      <p>
        <span className="font-semibold">Structure.</span>{' '}
        {evaluation.usesStarStructure
          ? 'It shows the situation, your action and the result.'
          : 'It does not yet show the situation, your action and the result.'}
      </p>
      <p>
        <span className="font-semibold">Length.</span> {evaluation.lengthNote}
      </p>
      {evaluation.strengths.length > 0 && (
        <div>
          <p className="font-semibold">What is working</p>
          <ul className="list-disc space-y-1 pl-6">
            {evaluation.strengths.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      {evaluation.improvements.length > 0 && (
        <div>
          <p className="font-semibold">To sharpen</p>
          <ul className="list-disc space-y-1 pl-6">
            {evaluation.improvements.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
