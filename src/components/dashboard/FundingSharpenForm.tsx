import { SELF_TAGS } from '@/lib/benefits/match'
import { saveFundingTags } from '@/app/dashboard/funding/actions'
import { ShowMore } from '@/components/candidate/ShowMore'
import { H2 } from '@/components/candidate/ui'

/** "Sharpen your matches": the member's own answers, and the opt-in to use their voluntary self-ID answers. */
export function FundingSharpenForm({ held, hasSelfId, useSelfId }: { held: string[]; hasSelfId: boolean; useSelfId: boolean }) {
  const heldSet = new Set(held)
  return (
      <section className="space-y-3" aria-labelledby="funding-sharpen">
        <ShowMore label="Sharpen your matches" event="funding_sharpen_opened">
          <form action={saveFundingTags} className="space-y-4">
            <div>
              <H2 id="funding-sharpen">Which of these are true for you?</H2>
              <p className="mt-1 text-sm text-muted-foreground">
                Why we ask: some programs are only for veterans, people 50 or older, people with a disability and so on. Until you answer, we keep them in the list in case they apply.
                Once you save, we hide the ones that do not. Private to you: never shown to employers, recruiters, schools or coaches.
              </p>
            </div>
            <div className="space-y-2">
              {SELF_TAGS.map((t) => (
                <label key={t.tag} className="flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" name="tag" value={t.tag} defaultChecked={heldSet.has(t.tag)} />
                  {t.label}
                </label>
              ))}
            </div>
            {hasSelfId && (
              <label className="flex items-start gap-2 rounded-xl bg-muted p-4 text-sm text-ink">
                <input type="checkbox" name="useSelfId" defaultChecked={useSelfId} className="mt-1" />
                <span>
                  <span className="font-semibold">Use my voluntary self-ID answers to find programs for my community.</span> You already answered some of these on your screening page
                  (race or ethnicity, gender, veteran status, disability status). Programs written for a community are shown only if you turn this on: we then read your answers to show and rank them for you on this page. We do not copy your answers, show them to anyone or send them to analytics. Turn it off any time.
                </span>
              </label>
            )}
            <button type="submit" className="inline-flex h-11 items-center rounded-full bg-action px-7 text-base font-semibold text-action-foreground hover:brightness-95">
              Save and re-rank
            </button>
          </form>
        </ShowMore>
      </section>
  )
}
