import { addSkillToBuild, saveExploredTarget, updateIndustryInterest } from '@/app/dashboard/pivot-paths/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { pivotIdeas } from '@/lib/journey/pivot-ideas'

type Ideas = ReturnType<typeof pivotIdeas>

// For people who are thinking about a change and do not know where to start, or who feel nervous about it.
// Realistic options from what they already have. Looking is free: nothing here changes their job search.
export function PivotIdeas({ ideas, from }: { ideas: Ideas; from: string | null }) {
  return (
    <section className="space-y-4 rounded-lg border border-border p-4" aria-labelledby="ideas-heading">
      <div>
        <h2 id="ideas-heading" className="text-lg font-semibold tracking-tight">
          Not sure where to start?
        </h2>
        <p className="text-sm text-muted-foreground">
          Thinking about a change is not a decision, and plenty of people feel nervous about it. These are realistic places to look, based on what you already have
          {from ? ` as someone in ${from}` : ''}. Add the ones that catch your eye to your radar, and come back whenever you like.
        </p>
      </div>

      {ideas.functions.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Fields close to yours</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {ideas.functions.map((f) => (
              <div key={f.function} className="space-y-2 rounded-md border border-border p-3 text-sm">
                <p className="font-medium">
                  {f.function} <span className="font-normal text-muted-foreground">· {f.headline.toLowerCase()}</span>
                </p>
                <p className="text-muted-foreground">{f.why}</p>
                <p className="text-muted-foreground">Smallest first step: {f.smallestStep}</p>
                <form action={saveExploredTarget}>
                  <input type="hidden" name="target" value={f.function} />
                  <SubmitButton size="sm" variant="outline">
                    Put {f.function} on my radar
                  </SubmitButton>
                </form>
              </div>
            ))}
          </div>
        </div>
      )}

      {ideas.industries.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Industries where your work travels</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {ideas.industries.map((i) => (
              <div key={i.industry} className="space-y-2 rounded-md border border-border p-3 text-sm">
                <p className="font-medium">{i.industry}</p>
                <p className="text-muted-foreground">{i.why}</p>
                <p className="text-muted-foreground">Smallest first step: {i.smallestStep}</p>
                <form action={updateIndustryInterest}>
                  <input type="hidden" name="industry" value={i.industry} />
                  <SubmitButton size="sm" variant="outline" name="action" value="add">
                    Look into {i.industry}
                  </SubmitButton>
                </form>
              </div>
            ))}
          </div>
        </div>
      )}

      {ideas.skills.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Skills worth building either way</h3>
          <ul className="space-y-2 text-sm">
            {ideas.skills.map((s) => (
              <li key={s.skill} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {s.skill} <span className="text-muted-foreground">· useful for {s.forFunction}</span>
                </span>
                <form action={addSkillToBuild}>
                  <input type="hidden" name="skill" value={s.skill} />
                  <input type="hidden" name="forFunction" value={s.forFunction} />
                  <SubmitButton size="sm" variant="outline">
                    Start building {s.skill}
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Changes that are not a change of field{ideas.reasonLabel ? ` (you said: ${ideas.reasonLabel.toLowerCase()})` : ''}</h3>
        <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
          {ideas.stayAndShift.map((a) => (
            <li key={a.label}>
              <span className="font-medium text-foreground">{a.label}.</span> {a.why}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
