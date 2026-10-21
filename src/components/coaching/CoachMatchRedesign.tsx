import { selectCoach, submitCoachPreferences } from '@/app/dashboard/coaching-match/actions'
import { COACHING_STYLE_ITEMS } from '@/lib/coach/coaching-style'
import type { CoachShortlistEntry } from '@/lib/coach/matching'
import { COACH_FEEDBACK_CHOICES, COACH_FEEDBACK_HINT, COACH_GENDER_CHOICES, coachReasons } from '@/lib/redesign/network-account'
import { ChoiceButtons } from '@/components/candidate/ChoiceButtons'
import { ChoiceField } from '@/components/candidate/ChoiceField'
import { ActionSubmit } from '@/components/candidate/ActionSubmit'
import { EmptyCard } from '@/components/candidate/EmptyCard'
import { RowList } from '@/components/candidate/RowList'

const RATING_CHOICES = [
  { value: '1', label: 'Not me' },
  { value: '2', label: 'A little' },
  { value: '3', label: 'Mostly' },
  { value: '4', label: 'Very me' },
]

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

const textInput ='h-11 w-full max-w-sm rounded-xl border border-border bg-white px-3.5 text-base text-ink'

// The coach-matching form after the old controls were replaced (docs/redesign-old-card-audit-network-account.md):
// "Coach gender" (four options) and "Feedback style" (three) were dropdowns and are now adjacent buttons. Everything is
// optional and says so. The twelve "how much is this like you" statements sit behind one control, because they sharpen
// the match but are not needed for it. Same fields, same action, same saved answers.
export function CoachPreferencesForm({
  gender,
  feedbackStyle,
  language,
  timezone,
  savedRatings,
}: {
  gender: string | null
  feedbackStyle: string | null
  language: string | null
  timezone: string | null
  savedRatings: Record<string, number>
}) {
  const answered = COACHING_STYLE_ITEMS.filter((i) => savedRatings[i.id]).length
  return (
    <form action={submitCoachPreferences} className="max-w-2xl space-y-8">
      <ChoiceField name="genderPreference" label="Coach gender" why="Skip this if it does not matter to you." options={COACH_GENDER_CHOICES} defaultValue={gender ?? ''} />

      <div className="space-y-2">
        <ChoiceField name="communicationStylePreference" label="How you like feedback" options={COACH_FEEDBACK_CHOICES} defaultValue={feedbackStyle ?? ''} />
        <p className="text-sm text-muted-foreground">
          Direct means {lowerFirst(COACH_FEEDBACK_HINT.direct)} Context first means {lowerFirst(COACH_FEEDBACK_HINT.context_first)}
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="languagePreference" className="block text-base font-semibold text-ink">
            Language
          </label>
          <input id="languagePreference" name="languagePreference" defaultValue={language ?? ''} placeholder="For example, English" className={textInput} />
        </div>
        <div className="space-y-2">
          <label htmlFor="timezonePreference" className="block text-base font-semibold text-ink">
            Time zone
          </label>
          <input id="timezonePreference" name="timezonePreference" defaultValue={timezone ?? ''} placeholder="For example, ET" className={textInput} />
        </div>
      </div>

      <details className="group space-y-5" open={answered > 0 || undefined}>
        <summary className="inline-flex h-10 cursor-pointer list-none items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted [&::-webkit-details-marker]:hidden">
          {answered > 0 ? `How you like to work (${answered} of ${COACHING_STYLE_ITEMS.length} answered)` : 'Optional: tell us how you like to work'}
        </summary>
        <fieldset className="space-y-5 pt-4">
          <legend className="text-base font-semibold text-ink">What do you want from a coach?</legend>
          <p className="text-sm text-muted-foreground">Say how much each statement sounds like you. We use this only to suggest coaches who work the way you want, and you can skip any of them.</p>
          {COACHING_STYLE_ITEMS.map((item) => (
            <div key={item.id} className="space-y-2">
              <p className="text-base text-ink">{item.text}</p>
              <ChoiceButtons name={`style-${item.id}`} label={item.text} options={RATING_CHOICES} defaultValue={savedRatings[item.id] ? String(savedRatings[item.id]) : undefined} />
            </div>
          ))}
        </fieldset>
      </details>

      <ActionSubmit pendingLabel="Finding coaches…" event="coach_match_preferences_saved" props={{ styleItemsAnswered: answered }}>
        See my matches
      </ActionSubmit>
    </form>
  )
}

// The shortlist as rows: the coach, the one reason they were picked, one fact, and one action. The other reasons and the
// industries open on demand. The college shows in the fact line instead of a grey pill.
export function CoachShortlistRedesign({ shortlist }: { shortlist: CoachShortlistEntry[] }) {
  if (shortlist.length === 0) {
    return <EmptyCard title="No coaches are free right now" why="Check back soon. We will not match you with someone who does not fit." />
  }
  return (
    <RowList
      label="Coaches matched to you"
      items={shortlist.map((coach) => {
        const { lead, rest } = coachReasons(coach.reasons)
        const first = coach.fullName.split(' ')[0]
        return {
          key: coach.id,
          title: coach.fullName,
          why: lead ?? undefined,
          fact: [coach.firmName ?? 'Independent', coach.focus, coach.collegeName].filter(Boolean).join(' · '),
          actions: (
            <form action={selectCoach.bind(null, coach.id)}>
              <ActionSubmit variant="secondary" pendingLabel="Confirming…" event="coach_chosen" props={{ coachId: coach.id }}>
                Choose {first}
              </ActionSubmit>
            </form>
          ),
          detailLabel: `Why we picked ${first}`,
          detail:
            rest.length > 0 || coach.industries.length > 0 ? (
              <>
                {rest.map((r) => (
                  <p key={r}>{r}</p>
                ))}
                {coach.industries.length > 0 && <p>Industries: {coach.industries.join(', ')}.</p>}
              </>
            ) : undefined,
        }
      })}
    />
  )
}
