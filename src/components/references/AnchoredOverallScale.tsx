import { ANCHOR_LABELS, type AnchorScore } from '@/lib/references/anchored-scale'

// Same anchored 1-4 scale as ReferencePerformanceScale (Below what the role
// needed / Solid — did the job well / Notably strong / Exceptional), reused
// for the single "overall" summary question instead of a generic 1-5
// Poor-Excellent slider. Two reasons: (1) a plain 1-5 scale with no anchor
// language regressed candidates toward the middle instead of using the
// same "2 is good, save 4 for the best you've worked with" calibration the
// rest of the form teaches; (2) one shared scale everywhere is easier for a
// rater to hold in their head than switching conventions mid-form.
export function AnchoredOverallScale({ name, label }: { name: string; label: string }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm text-foreground">{label}</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
        {([1, 2, 3, 4] as AnchorScore[]).map((score) => (
          <label
            key={score}
            className="flex cursor-pointer items-start gap-2 rounded-md border border-border p-2.5 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand/5"
          >
            <input type="radio" name={name} value={score} className="mt-0.5" required />
            <span>{ANCHOR_LABELS[score]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
