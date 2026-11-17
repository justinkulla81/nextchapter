import { coachProfileContext } from '@/lib/profile/touchpoints'
import { AREAS } from '@/lib/strengths-interview/areas'

// For the pre-session brief: where the client stands out (measured, and in their own words from Find your strengths), how they like to
// work, what they want to leave behind and toward, and market flags. Their
// private weak spots are never shown here.
export async function CoachProfileContextCard({ candidateId }: { candidateId: string }) {
  const c = await coachProfileContext(candidateId).catch(() => null)
  if (!c) return null
  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <p className="text-sm font-medium text-muted-foreground">What they bring and what they want</p>
      {c.strengths && (
        <div className="space-y-1">
          <p className="font-medium text-foreground">{c.strengths.headline}</p>
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
            {c.strengths.lead.map((l) => (
              <li key={l.label}>
                <span className="text-foreground">{l.label}:</span> {l.evidence.join('; ')}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="space-y-1">
        <p className="text-sm">
          <span className="text-muted-foreground">In their own words (Find your strengths, {c.ownDone} of {AREAS.length} areas done):</span>
          {c.ownWords.length === 0 && ' not started yet.'}
        </p>
        {c.ownWords.length > 0 && (
          <ul className="space-y-1.5 text-sm">
            {c.ownWords.map((w) => (
              <li key={w.areaTitle}>
                <span className="font-medium text-foreground">{w.strength}</span> <span className="text-muted-foreground">({w.areaTitle}). {w.proof}</span>
                {w.sayIt && <span className="block italic text-muted-foreground">&ldquo;{w.sayIt}&rdquo;</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
      {c.workStyle.length > 0 && (
        <p className="text-sm">
          <span className="text-muted-foreground">How they like to work: </span>
          {c.workStyle.join('; ')}.
        </p>
      )}
      {(c.less.length > 0 || c.more.length > 0) && (
        <p className="text-sm">
          {c.less.length > 0 && (
            <>
              <span className="text-muted-foreground">Wants less: </span>
              {c.less.join(', ').toLowerCase()}.{' '}
            </>
          )}
          {c.more.length > 0 && (
            <>
              <span className="text-muted-foreground">Wants more: </span>
              {c.more.join(', ').toLowerCase()}.
            </>
          )}
        </p>
      )}
      {c.market.length > 0 && (
        <ul className="space-y-1 text-sm">
          {c.market.map((m) => (
            <li key={m.title}>
              <span className="font-medium text-foreground">{m.title}.</span> <span className="text-muted-foreground">{m.detail}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        Good openers: ask which strength they want to lead with this week, and whether the market flags change where they’re looking.
        {c.ownDone < AREAS.length && ' If they are stuck on how to say what they are best at, have them answer the next Find your strengths area before you meet, or do one together.'}
        {c.ownWords.some((w) => w.sayIt) && ' Have them say one of their own lines out loud and tighten it with them.'}
      </p>
    </div>
  )
}
