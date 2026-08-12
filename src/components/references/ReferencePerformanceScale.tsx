import { ANCHOR_LABELS, type AnchorScore } from '@/lib/references/anchored-scale'

// Reference Check Part A — one performance item. UI RULE, load-bearing
// (Assessment Layer spec §5.2): all four options at equal visual weight,
// no gradient, no highlighting/enlarging "Exceptional," no ordering that
// makes it read as the goal. If "Solid" looks like a C, raters inflate and
// the instrument stops discriminating. Every option below shares the same
// border, text size, and color — only the selected state changes, and
// identically for all four.
export function ReferencePerformanceScale({ itemKey, label }: { itemKey: string; label: string }) {
  const name = `perf-${itemKey}`
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm text-foreground">{label}</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
        {([1, 2, 3, 4] as AnchorScore[]).map((score) => (
          <label
            key={score}
            className="flex cursor-pointer items-start gap-2 rounded-md border border-border p-2.5 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand/5"
          >
            <input type="radio" name={name} value={score} className="mt-0.5" required />
            <span>{ANCHOR_LABELS[score]}</span>
          </label>
        ))}
        <label className="flex cursor-pointer items-start gap-2 rounded-md border border-dashed border-border p-2.5 text-sm text-muted-foreground has-[:checked]:border-foreground has-[:checked]:text-foreground">
          <input type="radio" name={name} value="" className="mt-0.5" />
          <span>Didn&apos;t see this</span>
        </label>
      </div>
    </fieldset>
  )
}
